export interface CreateAuditLogDto {
  entityType: string;
  entityId: string;
  action: string;
  previousValue?: Record<string, unknown> | null;
  newValue?: Record<string, unknown> | null;
  userId: string;
  userEmail?: string;
  ipAddress?: string;
}
