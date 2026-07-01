import { Injectable, BadRequestException, ForbiddenException } from '@nestjs/common';
import { task_status_enum , role_enum } from '@prisma/client';
import { JwtPayload } from '../../common/types/jwt-payload.type';

type Transition = {
  from: task_status_enum[];
  to: task_status_enum;
  allowedRoles: role_enum[];
  requiresReason?: boolean;
};

const TRANSITIONS: Transition[] = [
  {
    from: [task_status_enum.CREATED],
    to: task_status_enum.ASSIGNED,
    allowedRoles: [role_enum.MD, role_enum.HOD, role_enum.EA, role_enum.PA, role_enum.PURCHASE_HEAD],
  },
  {
    from: [task_status_enum.CREATED, task_status_enum.ASSIGNED],
    to: task_status_enum.ACCEPTED,
    allowedRoles: [role_enum.MD, role_enum.EMPLOYEE, role_enum.HOD, role_enum.EA, role_enum.PA],
  },
  {
    from: [task_status_enum.ACCEPTED, task_status_enum.CREATED, task_status_enum.ASSIGNED],
    to: task_status_enum.IN_PROGRESS,
    allowedRoles: [role_enum.MD, role_enum.EMPLOYEE, role_enum.HOD, role_enum.EA, role_enum.PA],
  },
  {
    from: [task_status_enum.IN_PROGRESS],
    to: task_status_enum.COMPLETED,
    allowedRoles: [role_enum.MD, role_enum.EMPLOYEE, role_enum.HOD, role_enum.EA, role_enum.PA],
  },
  {
    from: [task_status_enum.COMPLETED],
    to: task_status_enum.HOD_VERIFIED_PENDING,
    allowedRoles: [role_enum.MD, role_enum.EMPLOYEE, role_enum.HOD, role_enum.EA, role_enum.PA],
  },
  {
    from: [task_status_enum.HOD_VERIFIED_PENDING],
    to: task_status_enum.HOD_VERIFIED,
    allowedRoles: [role_enum.MD, role_enum.HOD, role_enum.EA, role_enum.PA, role_enum.PURCHASE_HEAD],
  },
  {
    from: [task_status_enum.HOD_VERIFIED],
    to: task_status_enum.REVIEWED,
    allowedRoles: [role_enum.MD, role_enum.HOD, role_enum.EA, role_enum.PA, role_enum.PURCHASE_HEAD],
  },
  {
    from: [task_status_enum.REVIEWED],
    to: task_status_enum.CLOSED,
    allowedRoles: [role_enum.MD, role_enum.HOD, role_enum.EA, role_enum.PA, role_enum.PURCHASE_HEAD],
  },
  {
    from: [task_status_enum.CREATED, task_status_enum.ASSIGNED, task_status_enum.ACCEPTED, task_status_enum.IN_PROGRESS],
    to: task_status_enum.REJECTED,
    allowedRoles: [role_enum.MD, role_enum.EMPLOYEE, role_enum.HOD, role_enum.EA, role_enum.PA],
    requiresReason: true,
  },
  {
    from: [task_status_enum.COMPLETED, task_status_enum.HOD_VERIFIED_PENDING, task_status_enum.HOD_VERIFIED, task_status_enum.REVIEWED],
    to: task_status_enum.IN_PROGRESS,
    allowedRoles: [role_enum.MD, role_enum.HOD, role_enum.EA, role_enum.PA, role_enum.PURCHASE_HEAD],
    requiresReason: true,
  },
  {
    from: [task_status_enum.CLOSED],
    to: task_status_enum.REJECTED,
    allowedRoles: [role_enum.MD, role_enum.HOD, role_enum.EA, role_enum.PA, role_enum.PURCHASE_HEAD],
  }
];

@Injectable()
export class TaskLifecycleService {
  validate(
    currentStatus: task_status_enum,
    toStatus: task_status_enum,
    user: JwtPayload,
    reason?: string,
  ): void {
    const transition = TRANSITIONS.find(
      (t) => t.to === toStatus && t.from.includes(currentStatus),
    );

    if (!transition) {
      throw new BadRequestException(
        `Invalid transition: ${currentStatus} → ${toStatus}`,
      );
    }

    if (!transition.allowedRoles.includes(user.role)) {
      throw new ForbiddenException(
        `Role ${user.role} cannot perform this transition`,
      );
    }

    if (transition.requiresReason && !reason) {
      throw new BadRequestException(
        `Reason is required for transition to ${toStatus}`,
      );
    }
  }
}
