import {
  Controller,
  Get,
  Post,
  Delete,
  Param,
  Body,
  Res,
  Req,
  UseGuards,
  UseInterceptors,
  ParseUUIDPipe,
  BadRequestException,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { memoryStorage } from 'multer';
import * as path from 'path';
import { ConfigService } from '@nestjs/config';
import { ApiTags, ApiOperation, ApiBearerAuth, ApiConsumes } from '@nestjs/swagger';
import { AuthGuard } from '@nestjs/passport';
import { Response } from 'express';
import { AttachmentsService } from './attachments.service';
import { UploadAttachmentDto } from './dto';
import { CurrentUser, Roles } from '../../common/decorators';
import { RolesGuard } from '../../common/guards';
import { UserWithRoles } from '../../database/types';
import { ROLES } from '../../config/constants';
import { ALLOWED_EXTENSIONS } from './attachments-folders';

@ApiTags('Adjuntos')
@ApiBearerAuth()
@UseGuards(AuthGuard('jwt'), RolesGuard)
@Controller('attachments')
export class AttachmentsController {
  constructor(
    private readonly attachmentsService: AttachmentsService,
    private readonly configService: ConfigService,
  ) {}

  @Get('event/:eventId')
  @ApiOperation({ summary: 'Listar adjuntos de un evento' })
  listByEvent(@Param('eventId', ParseUUIDPipe) eventId: string) {
    return this.attachmentsService.listByEvent(eventId);
  }

  @Post('event/:eventId')
  @Roles(
    ROLES.FUNCTIONAL_ADMIN,
    ROLES.OPERATOR,
    ROLES.SUPERVISOR,
    ROLES.ANALISTA,
    ROLES.SOLICITANTE,
    ROLES.APPROVER,
  )
  @UseInterceptors(
    FileInterceptor('file', {
      storage: memoryStorage(),
      limits: { fileSize: 10485760 },
      fileFilter: (_req, file, cb) => {
        const ext = path.extname(file.originalname).toLowerCase();
        if ((ALLOWED_EXTENSIONS as readonly string[]).includes(ext)) {
          cb(null, true);
        } else {
          cb(
            new BadRequestException(
              `Extensión no permitida: ${ext || file.originalname}`,
            ),
            false,
          );
        }
      },
    }),
  )
  @ApiConsumes('multipart/form-data')
  @ApiOperation({ summary: 'Subir adjunto a una carpeta del evento (reemplaza el existente)' })
  async upload(
    @Param('eventId', ParseUUIDPipe) eventId: string,
    @Body() dto: UploadAttachmentDto,
    @Req() req: { file: Express.Multer.File },
    @CurrentUser() user: UserWithRoles,
  ) {
    const maxSize = this.configService.get<number>(
      'upload.maxFileSize',
      10485760,
    );
    const file = req.file;
    if (!file) {
      throw new BadRequestException('Debe adjuntar un archivo');
    }
    if (file.size > maxSize) {
      throw new BadRequestException(
        `El archivo supera el tamaño máximo permitido (${Math.round(maxSize / 1048576)} MB)`,
      );
    }
    return this.attachmentsService.uploadFile({
      eventId,
      category: dto.category,
      originalName: file.originalname,
      mimeType: file.mimetype || 'application/octet-stream',
      fileSize: file.size,
      buffer: file.buffer,
      uploadedById: user.id,
      uploadedByRoles: user.roles,
      uploadedByAllyId: user.allyId,
      quotationId: dto.quotationId,
    });
  }

  @Delete(':id')
  @Roles(
    ROLES.FUNCTIONAL_ADMIN,
    ROLES.OPERATOR,
    ROLES.SUPERVISOR,
    ROLES.ANALISTA,
    ROLES.SOLICITANTE,
  )
  @ApiOperation({ summary: 'Eliminar un adjunto' })
  remove(@Param('id', ParseUUIDPipe) id: string, @CurrentUser() user: UserWithRoles) {
    return this.attachmentsService.remove(id, user);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Descargar un adjunto por ID' })
  async download(@Param('id', ParseUUIDPipe) id: string, @Res() res: Response) {
    const { attachment, buffer } =
      await this.attachmentsService.getForDownload(id);
    res.setHeader('Content-Type', attachment.mimeType);
    res.setHeader('Content-Length', buffer.length);
    res.setHeader(
      'Content-Disposition',
      `inline; filename="${attachment.originalName}"`,
    );
    res.end(buffer);
  }
}
