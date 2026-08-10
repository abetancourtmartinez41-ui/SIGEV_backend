import {
  BadRequestException,
  ForbiddenException,
} from '@nestjs/common';
import { EVENT_STATUS } from '../../config/constants';

type Status = (typeof EVENT_STATUS)[keyof typeof EVENT_STATUS];

interface Transition {
  to: Status;
  roles: string[];
  requiresItems?: boolean;
  devolucionOrigen?: Status[];
}

const validTransitions: Record<Status, Transition[]> = {
  [EVENT_STATUS.ABIERTO]: [
    { to: EVENT_STATUS.EN_EJECUCION, roles: ['approver', 'supervisor'] },
    { to: EVENT_STATUS.DEVUELTO, roles: ['approver', 'supervisor'] },
    { to: EVENT_STATUS.RECHAZADO, roles: ['approver', 'supervisor'] },
  ],
  [EVENT_STATUS.EN_EJECUCION]: [
    { to: EVENT_STATUS.EJECUTADO, roles: ['approver', 'supervisor'], requiresItems: true },
    { to: EVENT_STATUS.DEVUELTO, roles: ['approver', 'supervisor'] },
    { to: EVENT_STATUS.RECHAZADO, roles: ['approver', 'supervisor'] },
  ],
  [EVENT_STATUS.EJECUTADO]: [
    { to: EVENT_STATUS.CERRADO, roles: ['approver', 'supervisor'] },
    { to: EVENT_STATUS.DEVUELTO, roles: ['approver', 'supervisor'] },
  ],
  [EVENT_STATUS.DEVUELTO]: [
    { to: EVENT_STATUS.ABIERTO, roles: ['approver', 'supervisor'] },
    { to: EVENT_STATUS.EN_EJECUCION, roles: ['approver', 'supervisor'] },
    { to: EVENT_STATUS.EJECUTADO, roles: ['approver', 'supervisor'] },
    { to: EVENT_STATUS.CERRADO, roles: ['approver', 'supervisor'] },
  ],
  [EVENT_STATUS.CERRADO]: [
    { to: EVENT_STATUS.LEGALIZADO, roles: ['approver'] },
    { to: EVENT_STATUS.DEVUELTO, roles: ['approver', 'supervisor'] },
  ],
  [EVENT_STATUS.LEGALIZADO]: [],
  [EVENT_STATUS.RECHAZADO]: [],
};

export class EventStateMachine {
  static canTransition(
    currentStatus: string,
    newStatus: string,
    userRoles: string[],
    options?: {
      quotationsCount?: number;
      itemsCount?: number;
      authorizeException?: boolean;
      devueltoDesde?: string | null;
    },
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

    // Regla de oro: al salir del estado "Devuelto" la orden debe regresar
    // al estado del que provenía antes de ser devuelta.
    if (current === EVENT_STATUS.DEVUELTO) {
      const origin = options?.devueltoDesde ?? null;
      const legacyAllowed =
        origin === null &&
        (next === EVENT_STATUS.EN_EJECUCION || next === EVENT_STATUS.CERRADO);
      if (!legacyAllowed && next !== origin) {
        throw new BadRequestException(
          origin
            ? `Para salir del estado "${EVENT_STATUS.DEVUELTO}" la orden debe regresar al estado "${origin}" del que provenía`
            : 'No es posible determinar el estado de origen de la devolución',
        );
      }
    }

    if (
      transition.requiresItems &&
      (options?.itemsCount ?? 0) < 1
    ) {
      throw new BadRequestException(
        'Debe registrar al menos un ítem antes de continuar',
      );
    }

    return true;
  }
}
