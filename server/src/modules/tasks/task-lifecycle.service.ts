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
    allowedRoles: [role_enum.MD, role_enum.HOD],
  },
  {
    from: [task_status_enum.ASSIGNED],
    to: task_status_enum.ACCEPTED,
    allowedRoles: [role_enum.EMPLOYEE, role_enum.HOD],
  },
  {
    from: [task_status_enum.ASSIGNED],
    to: task_status_enum.REJECTED,
    allowedRoles: [role_enum.EMPLOYEE, role_enum.HOD],
    requiresReason: true,
  },
  {
    from: [task_status_enum.ACCEPTED],
    to: task_status_enum.IN_PROGRESS,
    allowedRoles: [role_enum.EMPLOYEE, role_enum.HOD],
  },
  {
    from: [task_status_enum.IN_PROGRESS],
    to: task_status_enum.COMPLETED,
    allowedRoles: [role_enum.EMPLOYEE],
  },
  {
    from: [task_status_enum.IN_PROGRESS],
    to: task_status_enum.PENDING,
    allowedRoles: [role_enum.EMPLOYEE, role_enum.HOD],
    requiresReason: true,
  },
  {
    from: [task_status_enum.PENDING],
    to: task_status_enum.IN_PROGRESS,
    allowedRoles: [role_enum.EMPLOYEE],
  },
  {
    from: [task_status_enum.COMPLETED],
    to: task_status_enum.REVIEWED,
    allowedRoles: [role_enum.MD, role_enum.HOD],
  },
  {
    from: [task_status_enum.REVIEWED],
    to: task_status_enum.CLOSED,
    allowedRoles: [role_enum.MD, role_enum.HOD],
  },
  {
    from: [task_status_enum.REVIEWED],
    to: task_status_enum.IN_PROGRESS,
    allowedRoles: [role_enum.MD, role_enum.HOD],
    requiresReason: true,
  },
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