import {
  Controller, Get, Post, Res, Param, UseGuards,
} from '@nestjs/common';
import { Response } from 'express';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { AuthGuard } from '@nestjs/passport';
import { BackupService } from './backup.service';
import { RolesGuard } from '../../common/guards';
import { Roles } from '../../common/decorators';
import { ROLES } from '../../config/constants';

@ApiTags('Respaldo')
@ApiBearerAuth()
@UseGuards(AuthGuard('jwt'), RolesGuard)
@Roles(ROLES.TECHNICAL_ADMIN)
@Controller('backup')
export class BackupController {
  constructor(private readonly backupService: BackupService) {}

  @Post()
  @ApiOperation({ summary: 'Generar respaldo de la base de datos (Admin. Técnico)' })
  async create() {
    return this.backupService.createBackup();
  }

  @Get()
  @ApiOperation({ summary: 'Listar respaldos disponibles (Admin. Técnico)' })
  async findAll() {
    return this.backupService.listBackups();
  }

  @Get(':id/download')
  @ApiOperation({ summary: 'Descargar un respaldo (Admin. Técnico)' })
  async download(@Param('id') id: string, @Res() res: Response) {
    const filePath = await this.backupService.getBackupPath(id);
    res.download(filePath);
  }
}
