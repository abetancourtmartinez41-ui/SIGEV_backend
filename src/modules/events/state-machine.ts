import {
  BadRequestException,
  ForbiddenException,
} from '@nestjs/common';
import { EVENT_STATUS, REQUIRED_QUOTATIONS_COUNT } from '../../config/constants';

type Status = (typeof EVENT_STATUS)[keyof typeof EVENT_STATUS];

interface Transition {
  to: Status;
  roles: string[];
  requiresQuotations?: boolean;
  requiresItems?: boolean;
}

const validTransitions: Record<Status, Transition[]> = {
  [EVENT_STATUS.ABIERTO]: [
    { to: EVENT_STATUS.EN_EJECUCION, roles: ['approver'] },
    { to: EVENT_STATUS.DEVUELTO, roles: ['approver'] },
    { to: EVENT_STATUS.RECHAZADO, roles: ['approver'] },
  ],
  [EVENT_STATUS.EN_EJECUCION]: [
    { to: EVENT_STATUS.EJECUTADO, roles: ['approver'], requiresItems: true },
    { to: EVENT_STATUS.DEVUELTO, roles: ['approver'] },
    { to: EVENT_STATUS.RECHAZADO, roles: ['approver'] },
  ],
  [EVENT_STATUS.EJECUTADO]: [
    {
      to: EVENT_STATUS.CERRADO,
      roles: ['approver'],
      requiresQuotations: true,
    },
    { to: EVENT_STATUS.DEVUELTO, roles: ['approver'] },
  ],
  [EVENT_STATUS.DEVUELTO]: [
    { to: EVENT_STATUS.CERRADO, roles: ['approver'] },
  ],
  [EVENT_STATUS.CERRADO]: [
    { to: EVENT_STATUS.LEGALIZADO, roles: ['approver'] },
    { to: EVENT_STATUS.DEVUELTO, roles: ['approver'] },
  ],
  [EVENT_STATUS.LEGALIZADO]: [],
  [EVENT_STATUS.RECHAZADO]: [],
};

export class EventStateMachine {
  static canTransition(
    currentStatus: string,
    newStatus: string,
    userRoles: string[],
    options?: { quotationsCount?: number; itemsCount?: number; authorizeException?: boolean },
  ): boolean {
    const current = currentStatus as Status;
    const next = newStatus as Status;

    const allowed = validTransitions[current];
    const transition = allowed?.find((t) => t.to === next);
    if (!transition) {
      throw new BadRequestException(
        `No se puede pasar de "${currentStatus}" a "${newStatus}"`,
      );
    }

    const authorized = transition.roles.some((role) => userRoles.includes(role));
    if (!authorized) {
      throw new ForbiddenException(
        `Su perfil no está autorizado para la transición a "${newStatus}"`,
      );
    }

    if (
      transition.requiresItems &&
      (options?.itemsCount ?? 0) < 1
    ) {
      throw new BadRequestException(
        'Debe registrar al menos un ítem antes de continuar',
      );
    }

    if (
      transition.requiresQuotations &&
      !options?.authorizeException &&
      (options?.quotationsCount ?? 0) < REQUIRED_QUOTATIONS_COUNT
    ) {
      throw new BadRequestException(
        `Debe contar con al menos ${REQUIRED_QUOTATIONS_COUNT} cotizaciones para aprobar el evento`,
      );
    }

    return true;
  }
}
