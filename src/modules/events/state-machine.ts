import { BadRequestException } from '@nestjs/common';
import { EVENT_STATUS, REQUIRED_ATTACHMENTS_COUNT } from '../../config/constants';

type Status = (typeof EVENT_STATUS)[keyof typeof EVENT_STATUS];

const validTransitions: Record<Status, Status[]> = {
  [EVENT_STATUS.OPEN]: [EVENT_STATUS.IN_EXECUTION],
  [EVENT_STATUS.IN_EXECUTION]: [EVENT_STATUS.CLOSED],
  [EVENT_STATUS.CLOSED]: [EVENT_STATUS.LEGALIZED],
  [EVENT_STATUS.LEGALIZED]: [],
};

export class EventStateMachine {
  static canTransition(
    currentStatus: string,
    newStatus: string,
    options?: { attachmentsCount?: number },
  ): boolean {
    const current = currentStatus as Status;
    const next = newStatus as Status;

    const allowed = validTransitions[current];
    if (!allowed || !allowed.includes(next)) {
      throw new BadRequestException(
        `No se puede pasar de "${currentStatus}" a "${newStatus}"`,
      );
    }

    if (
      next === EVENT_STATUS.CLOSED &&
      (options?.attachmentsCount ?? 0) < REQUIRED_ATTACHMENTS_COUNT
    ) {
      throw new BadRequestException(
        `Debe tener al menos ${REQUIRED_ATTACHMENTS_COUNT} soportes cargados para cerrar el evento`,
      );
    }

    return true;
  }
}
