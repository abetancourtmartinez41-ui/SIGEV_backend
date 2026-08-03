import { Injectable, BadRequestException, NotFoundException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { spawn } from 'child_process';
import * as fs from 'fs';
import * as path from 'path';

export interface BackupFile {
  id: string;
  file: string;
  size: number;
  createdAt: string;
}

@Injectable()
export class BackupService {
  private readonly backupDir: string;
  private readonly pgDumpPath: string;

  constructor(private readonly configService: ConfigService) {
    this.backupDir = path.resolve(
      process.cwd(),
      this.configService.get<string>('backup.dir') || './backups',
    );
    this.pgDumpPath =
      this.configService.get<string>('backup.pgDumpPath') ||
      'C:\\Program Files\\PostgreSQL\\14\\bin\\pg_dump.exe';
  }

  private parseDatabaseUrl(): {
    host: string;
    port: string;
    user: string;
    password: string;
    database: string;
  } {
    const raw = process.env.DATABASE_URL || '';
    const url = new URL(raw);
    return {
      host: url.hostname,
      port: url.port || '5432',
      user: decodeURIComponent(url.username),
      password: decodeURIComponent(url.password),
      database: url.pathname.replace(/^\//, ''),
    };
  }

  async createBackup(): Promise<BackupFile> {
    await fs.promises.mkdir(this.backupDir, { recursive: true });

    const stamp = new Date()
      .toISOString()
      .replace(/[:.]/g, '-')
      .slice(0, 19)
      .replace('T', '_');
    const fileName = `sigev-backup-${stamp}.sql`;
    const outputPath = path.join(this.backupDir, fileName);

    const { host, port, user, password, database } = this.parseDatabaseUrl();
    const args = [
      '-h', host,
      '-p', port,
      '-U', user,
      '--no-owner',
      '--no-privileges',
      '-f', outputPath,
      database,
    ];

    const child = spawn(this.pgDumpPath, args, {
      env: { ...process.env, PGPASSWORD: password },
    });

    const stderr: string[] = [];
    child.stderr.on('data', (chunk: Buffer) => {
      stderr.push(chunk.toString());
    });

    const exitCode: number = await new Promise((resolve, reject) => {
      child.on('error', reject);
      child.on('close', resolve);
    });

    if (exitCode !== 0) {
      throw new BadRequestException(
        `No se pudo generar el respaldo (pg_dump exit ${exitCode}): ${stderr.join(' ').trim()}`,
      );
    }

    const stat = await fs.promises.stat(outputPath);
    return {
      id: fileName,
      file: fileName,
      size: stat.size,
      createdAt: new Date().toISOString(),
    };
  }

  async listBackups(): Promise<BackupFile[]> {
    if (!fs.existsSync(this.backupDir)) return [];
    const entries = await fs.promises.readdir(this.backupDir);
    const files = entries
      .filter((entry) => entry.endsWith('.sql'))
      .sort()
      .reverse();

    const backups: BackupFile[] = [];
    for (const file of files) {
      const stat = await fs.promises.stat(path.join(this.backupDir, file));
      backups.push({
        id: file,
        file,
        size: stat.size,
        createdAt: stat.mtime.toISOString(),
      });
    }
    return backups;
  }

  async getBackupPath(id: string): Promise<string> {
    const safe = path.basename(id);
    const target = path.join(this.backupDir, safe);
    if (safe !== id || !fs.existsSync(target)) {
      throw new NotFoundException('Respaldo no encontrado');
    }
    return target;
  }
}
