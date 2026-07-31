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
}

const validTransitions: Record<Status, Transition[]> = {
  [EVENT_STATUS.POSTULADO]: [
    { to: EVENT_STATUS.EN_PREPARACION, roles: ['operator', 'functional_admin'] },
    { to: EVENT_STATUS.DEVUELTO, roles: ['approver', 'supervisor'] },
    { to: EVENT_STATUS.RECHAZADO, roles: ['approver'] },
  ],
  [EVENT_STATUS.EN_PREPARACION]: [
    { to: EVENT_STATUS.EN_REVISION, roles: ['operator', 'functional_admin'] },
    { to: EVENT_STATUS.DEVUELTO, roles: ['approver', 'supervisor'] },
  ],
  [EVENT_STATUS.EN_REVISION]: [
    {
      to: EVENT_STATUS.EN_EJECUCION,
      roles: ['approver'],
      requiresQuotations: true,
    },
    { to: EVENT_STATUS.DEVUELTO, roles: ['approver', 'supervisor'] },
    { to: EVENT_STATUS.RECHAZADO, roles: ['approver'] },
  ],
  [EVENT_STATUS.DEVUELTO]: [
    { to: EVENT_STATUS.EN_PREPARACION, roles: ['operator', 'analista', 'functional_admin'] },
    { to: EVENT_STATUS.EN_REVISION, roles: ['operator', 'functional_admin'] },
  ],
  [EVENT_STATUS.EN_EJECUCION]: [
    { to: EVENT_STATUS.CERRADO, roles: ['approver'] },
    { to: EVENT_STATUS.DEVUELTO, roles: ['supervisor'] },
  ],
  [EVENT_STATUS.CERRADO]: [
    { to: EVENT_STATUS.LEGALIZADO, roles: ['approver'] },
  ],
  [EVENT_STATUS.LEGALIZADO]: [],
  [EVENT_STATUS.RECHAZADO]: [],
};

export class EventStateMachine {
  static canTransition(
    currentStatus: string,
    newStatus: string,
    userRoles: string[],
    options?: { quotationsCount?: number; authorizeException?: boolean },
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
