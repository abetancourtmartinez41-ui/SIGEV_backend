import { Prisma } from '../generated/prisma/client';

export type UserWithRoles = Prisma.UserGetPayload<{ include: { roles: true } }>;
export type EventWithRelations = Prisma.EventGetPayload<{
  include: { items: true; attachments: true; createdBy: true; disbursement: true };
}>;
export type EventWithItemsAndCreatedBy = Prisma.EventGetPayload<{
  include: { items: true; createdBy: true };
}>;
