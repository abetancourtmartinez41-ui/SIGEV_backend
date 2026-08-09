import {
  Injectable,
  NotFoundException,
  BadRequestException,
  ForbiddenException,
  ServiceUnavailableException,
} from '@nestjs/common';
import { randomUUID } from 'crypto';
import { PrismaService } from '../../database/prisma.service';
import { Attachment } from '../../generated/prisma/client';
import { EVENT_STATUS, ROLES } from '../../config/constants';
import { STATIC_FOLDERS, MULTI_DOCUMENT_FOLDERS } from './attachments-folders';
import { SupabaseService } from '../supabase/supabase.service';

@Injectable()
export class AttachmentsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly supabaseService: SupabaseService,
  ) {}

  private sanitizeFileName(originalName: string): string {
    const base = originalName.replace(/\\/g, '/').split('/').pop() || originalName;
    const sanitized = base.replace(/[^a-zA-Z0-9._-]/g, '_');
    return sanitized || 'file';
  }

  private getObjectPath(eventId: string, fileName: string): string {
    return `attachments/${eventId}/${fileName}`;
  }

  private async assertSupabaseConfigured(): Promise<void> {
    const url = this.supabaseService.storage;
    if (!url) {
      throw new ServiceUnavailableException(
        'Supabase Storage no está configurado',
      );
    }
  }

  private async removeObject(path: string): Promise<void> {
    await this.assertSupabaseConfigured();
    const { error } = await this.supabaseService.storage
      .from(this.supabaseService.bucket)
      .remove([path]);
    if (error) {
      // El objeto puede no existir (archivo ausente): se ignora y se limpia el registro
      console.warn(`Supabase: no se pudo eliminar ${path}: ${error.message}`);
    }
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
      await this.removeObject(attachment.storedPath);
      await this.prisma.attachment.delete({ where: { id: attachment.id } });
    }
  }

  private async assertEventModifiable(
    eventId: string,
    category: string,
  ): Promise<{
    status: string;
    devolucionLegalizacion: boolean;
    generalAllyId: string | null;
    cotizacionSeleccionadaId: string | null;
  }> {
    const event = await this.prisma.event.findUnique({
      where: { id: eventId },
      select: {
        id: true,
        status: true,
        devolucionLegalizacion: true,
        generalAllyId: true,
        cotizacionSeleccionadaId: true,
      },
    });
    if (!event) {
      throw new NotFoundException('Evento no encontrado');
    }

    const isStatic = (STATIC_FOLDERS as readonly string[]).includes(category);

    const goldenRuleLocked =
      isStatic &&
      category === 'Formato de requerimiento' &&
      event.cotizacionSeleccionadaId !== null;
    if (goldenRuleLocked) {
      throw new ForbiddenException(
        'El Formato de requerimiento es inmutable porque la cotización fue aprobada y se creó el presupuesto final',
      );
    }

    let allowed: boolean;
    if (isStatic) {
      allowed =
        event.status === EVENT_STATUS.ABIERTO ||
        event.status === EVENT_STATUS.EN_EJECUCION ||
        (event.status === EVENT_STATUS.DEVUELTO &&
          !event.devolucionLegalizacion);
    } else {
      allowed =
        event.status === EVENT_STATUS.EN_EJECUCION ||
        (event.status === EVENT_STATUS.DEVUELTO &&
          event.devolucionLegalizacion);
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
    event: { status: string; devolucionLegalizacion: boolean },
    user: { roles: { name: string }[] },
    category: string,
  ): void {
    const roles = user.roles.map((role) => role.name);
    const isEditor = roles.some((role) =>
      [ROLES.FUNCTIONAL_ADMIN, ROLES.OPERATOR, ROLES.SUPERVISOR].includes(
        role as never,
      ),
    );
    const isAnalista = roles.includes(ROLES.ANALISTA);
    const isSolicitante = roles.includes(ROLES.SOLICITANTE);
    const isApprover = roles.includes(ROLES.APPROVER);

    if (isEditor) return;
    if (
      (isAnalista || isSolicitante) &&
      event.status === EVENT_STATUS.DEVUELTO
    ) {
      return;
    }
    // El Solicitante/Analista sube el Formato de requerimiento al crear la orden
    if (
      (isAnalista || isSolicitante) &&
      category === 'Formato de requerimiento' &&
      event.status === EVENT_STATUS.ABIERTO
    ) {
      return;
    }
    // El Aprobador sube el Comunicado de aprobación al seleccionar la cotización definitiva
    if (
      isApprover &&
      category === 'Comunicado de aprobación' &&
      (event.status === EVENT_STATUS.ABIERTO ||
        event.status === EVENT_STATUS.EN_EJECUCION ||
        (event.status === EVENT_STATUS.DEVUELTO &&
          !event.devolucionLegalizacion))
    ) {
      return;
    }
    throw new ForbiddenException(
      'Su perfil no puede modificar los adjuntos de este evento',
    );
  }

  private assertAllyScope(
    event: { generalAllyId: string | null },
    user: { allyId?: string | null; roles: { name: string }[] },
  ): void {
    const roles = user.roles.map((role) => role.name);
    if (!roles.includes(ROLES.OPERATOR)) return;
    if (event.generalAllyId && event.generalAllyId === user.allyId) return;
    throw new ForbiddenException(
      'Este evento pertenece a otro Aliado y su perfil solo gestiona eventos de su Aliado asignado',
    );
  }

  private async storeBuffer(params: {
    eventId: string;
    fileName: string;
    buffer: Buffer;
    contentType: string;
  }): Promise<string> {
    await this.assertSupabaseConfigured();
    const objectPath = this.getObjectPath(
      params.eventId,
      `${randomUUID()}-${this.sanitizeFileName(params.fileName)}`,
    );
    const { error } = await this.supabaseService.storage
      .from(this.supabaseService.bucket)
      .upload(objectPath, params.buffer, {
        contentType: params.contentType,
        upsert: false,
      });
    if (error) {
      throw new ServiceUnavailableException(
        `No se pudo guardar el archivo en el almacenamiento: ${error.message}`,
      );
    }
    return objectPath;
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
    uploadedByAllyId?: string | null;
    quotationId?: string;
  }): Promise<Attachment> {
    const event = await this.assertEventModifiable(
      params.eventId,
      params.category,
    );
    this.assertUserAllowed(event, { roles: params.uploadedByRoles }, params.category);
    this.assertAllyScope(event, {
      allyId: params.uploadedByAllyId,
      roles: params.uploadedByRoles,
    });

    if (params.quotationId) {
      const quotation = await this.prisma.quotation.findUnique({
        where: { id: params.quotationId },
        select: { eventId: true },
      });
      if (!quotation || quotation.eventId !== params.eventId) {
        throw new BadRequestException(
          'La cotización indicada no pertenece a este evento',
        );
      }
    }

    const storedPath = await this.storeBuffer({
      eventId: params.eventId,
      fileName: params.originalName,
      buffer: params.buffer,
      contentType: params.mimeType || 'application/octet-stream',
    });

    // Las carpetas multi-documento acumulan varios documentos (una o más por carga);
    // el resto de carpetas conservan un único adjunto (reemplazo).
    if (!(MULTI_DOCUMENT_FOLDERS as readonly string[]).includes(params.category)) {
      await this.removeExistingForCategory(params.eventId, params.category);
    }

    return this.prisma.attachment.create({
      data: {
        originalName: params.originalName,
        storedPath,
        mimeType: params.mimeType.slice(0, 50),
        fileSize: params.fileSize,
        category: params.category,
        eventId: params.eventId,
        quotationId: params.quotationId ?? null,
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
    user: { allyId?: string | null; roles: { name: string }[] },
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
    this.assertUserAllowed(event, user, attachment.category);
    this.assertAllyScope(event, user);

    await this.removeObject(attachment.storedPath);
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
    const storedPath = await this.storeBuffer({
      eventId: params.eventId,
      fileName: params.fileName,
      buffer: params.buffer,
      contentType: 'application/pdf',
    });

    await this.removeExistingForCategory(params.eventId, params.category);

    return this.prisma.attachment.create({
      data: {
        originalName: params.fileName,
        storedPath,
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
  ): Promise<{ attachment: Attachment; buffer: Buffer }> {
    await this.assertSupabaseConfigured();
    const attachment = await this.prisma.attachment.findUnique({
      where: { id },
    });
    if (!attachment) {
      throw new NotFoundException('Adjunto no encontrado');
    }
    const { data, error } = await this.supabaseService.storage
      .from(this.supabaseService.bucket)
      .download(attachment.storedPath);
    if (error || !data) {
      throw new NotFoundException(
        'El archivo del adjunto no existe en el almacenamiento',
      );
    }
    return { attachment, buffer: Buffer.from(await data.arrayBuffer()) };
  }
}
