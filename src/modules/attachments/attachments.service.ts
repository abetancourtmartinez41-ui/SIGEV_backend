import {
  Injectable,
  NotFoundException,
  BadRequestException,
  ForbiddenException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { createReadStream, promises as fs } from 'fs';
import * as path from 'path';
import { randomUUID } from 'crypto';
import { PrismaService } from '../../database/prisma.service';
import { Attachment } from '../../generated/prisma/client';
import { EVENT_STATUS, ROLES } from '../../config/constants';
import { STATIC_FOLDERS } from './attachments-folders';

@Injectable()
export class AttachmentsService {
  private readonly uploadDest: string;

  constructor(
    private readonly prisma: PrismaService,
    private readonly configService: ConfigService,
  ) {
    this.uploadDest = this.configService.get<string>('upload.dest', './uploads');
  }

  private resolvePath(relativePath: string): string {
    return path.resolve(process.cwd(), this.uploadDest, relativePath);
  }

  private sanitizeFileName(originalName: string): string {
    const base = path.posix.basename(originalName);
    const sanitized = base.replace(/[^a-zA-Z0-9._-]/g, '_');
    return sanitized || 'file';
  }

  private async removeExistingForCategory(
    eventId: string,
    category: string,
  ): Promise<void> {
    const existing = await this.prisma.attachment.findMany({
      where: { eventId, category },
      select: { id: true, storedPath: true },
    });
    for (const attachment of existing) {
      try {
        await fs.unlink(this.resolvePath(attachment.storedPath));
      } catch {
        // Archivo ausente: se ignora y se limpia el registro
      }
      await this.prisma.attachment.delete({ where: { id: attachment.id } });
    }
  }

  private async assertEventModifiable(
    eventId: string,
    category: string,
  ): Promise<{ status: string; devolucionLegalizacion: boolean }> {
    const event = await this.prisma.event.findUnique({
      where: { id: eventId },
      select: { id: true, status: true, devolucionLegalizacion: true },
    });
    if (!event) {
      throw new NotFoundException('Evento no encontrado');
    }

    const isStatic = (STATIC_FOLDERS as readonly string[]).includes(category);

    let allowed: boolean;
    if (isStatic) {
      allowed =
        event.status === EVENT_STATUS.ABIERTO ||
        event.status === EVENT_STATUS.EN_EJECUCION ||
        (event.status === EVENT_STATUS.DEVUELTO &&
          !event.devolucionLegalizacion);
    } else {
      allowed =
        event.status === EVENT_STATUS.ABIERTO ||
        event.status === EVENT_STATUS.EN_EJECUCION ||
        event.status === EVENT_STATUS.EJECUTADO ||
        event.status === EVENT_STATUS.CERRADO ||
        event.status === EVENT_STATUS.DEVUELTO;
    }

    if (!allowed) {
      throw new ForbiddenException(
        isStatic
          ? 'Las carpetas 1-4 son inmutables en el estado actual del evento'
          : 'La carpeta no es modificable en el estado actual del evento',
      );
    }
    return event;
  }

  private assertUserAllowed(
    event: { status: string },
    user: { roles: { name: string }[] },
  ): void {
    const roles = user.roles.map((role) => role.name);
    const isEditor = roles.some((role) =>
      [ROLES.FUNCTIONAL_ADMIN, ROLES.OPERATOR, ROLES.SUPERVISOR].includes(
        role as never,
      ),
    );
    const isAnalista = roles.includes(ROLES.ANALISTA);
    const isSolicitante = roles.includes(ROLES.SOLICITANTE);

    if (isEditor) return;
    if ((isAnalista || isSolicitante) && event.status === EVENT_STATUS.DEVUELTO) {
      return;
    }
    throw new ForbiddenException(
      'Su perfil no puede modificar los adjuntos de este evento',
    );
  }

  async uploadFile(params: {
    eventId: string;
    category: string;
    originalName: string;
    mimeType: string;
    fileSize: number;
    buffer: Buffer;
    uploadedById: string;
    uploadedByRoles: { name: string }[];
  }): Promise<Attachment> {
    const event = await this.assertEventModifiable(
      params.eventId,
      params.category,
    );
    this.assertUserAllowed(event, { roles: params.uploadedByRoles });

    const relativePath = path.posix.join(
      'attachments',
      params.eventId,
      `${randomUUID()}-${this.sanitizeFileName(params.originalName)}`,
    );
    const absolutePath = this.resolvePath(relativePath);

    await fs.mkdir(path.dirname(absolutePath), { recursive: true });
    await fs.writeFile(absolutePath, params.buffer);

    await this.removeExistingForCategory(params.eventId, params.category);

    return this.prisma.attachment.create({
      data: {
        originalName: params.originalName,
        storedPath: relativePath,
        mimeType: params.mimeType.slice(0, 50),
        fileSize: params.fileSize,
        category: params.category,
        eventId: params.eventId,
        uploadedById: params.uploadedById,
      },
    });
  }

  async listByEvent(eventId: string): Promise<Attachment[]> {
    return this.prisma.attachment.findMany({
      where: { eventId },
      orderBy: { createdAt: 'asc' },
    });
  }

  async remove(
    id: string,
    user: { roles: { name: string }[] },
  ): Promise<{ success: boolean }> {
    const attachment = await this.prisma.attachment.findUnique({
      where: { id },
    });
    if (!attachment) {
      throw new NotFoundException('Adjunto no encontrado');
    }
    if (!attachment.category) {
      throw new BadRequestException('Este adjunto no puede eliminarse');
    }

    const event = await this.assertEventModifiable(
      attachment.eventId,
      attachment.category,
    );
    this.assertUserAllowed(event, user);

    try {
      await fs.unlink(this.resolvePath(attachment.storedPath));
    } catch {
      // Archivo ausente: se ignora y se elimina el registro
    }
    await this.prisma.attachment.delete({ where: { id } });
    return { success: true };
  }

  async saveGeneratedPdf(params: {
    eventId: string;
    category: string;
    fileName: string;
    buffer: Buffer;
    uploadedById: string;
  }): Promise<Attachment> {
    const relativePath = path.posix.join(
      'attachments',
      params.eventId,
      params.fileName,
    );
    const absolutePath = this.resolvePath(relativePath);

    await fs.mkdir(path.dirname(absolutePath), { recursive: true });
    await fs.writeFile(absolutePath, params.buffer);

    await this.removeExistingForCategory(params.eventId, params.category);

    return this.prisma.attachment.create({
      data: {
        originalName: params.fileName,
        storedPath: relativePath,
        mimeType: 'application/pdf',
        fileSize: params.buffer.length,
        category: params.category,
        eventId: params.eventId,
        uploadedById: params.uploadedById,
      },
    });
  }

  async getForDownload(
    id: string,
  ): Promise<{ attachment: Attachment; stream: NodeJS.ReadableStream }> {
    const attachment = await this.prisma.attachment.findUnique({
      where: { id },
    });
    if (!attachment) {
      throw new NotFoundException('Adjunto no encontrado');
    }
    const absolutePath = this.resolvePath(attachment.storedPath);
    try {
      await fs.access(absolutePath);
    } catch {
      throw new NotFoundException(
        'El archivo del adjunto no existe en el servidor',
      );
    }
    return { attachment, stream: createReadStream(absolutePath) };
  }
}
