import { Prisma } from '../generated/prisma/client';

export type UserWithRoles = Prisma.UserGetPayload<{ include: { roles: true } }>;

const eventRelationsInclude = {
  items: true,
  attachments: true,
  createdBy: true,
  disbursement: true,
  selectedQuotation: { include: { ally: true } },
  quotations: { where: { isActive: true }, include: { ally: true }, orderBy: { createdAt: 'asc' as const } },
};

export type EventWithRelations = Prisma.EventGetPayload<{ include: typeof eventRelationsInclude }>;
export type EventWithItemsAndCreatedBy = Prisma.EventGetPayload<{
  include: { items: true; createdBy: true };
}>;
