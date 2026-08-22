import {
  Logger,
} from '@nestjs/common';

import {
  ConnectedSocket,
  MessageBody,
  OnGatewayConnection,
  OnGatewayDisconnect,
  SubscribeMessage,
  WebSocketGateway,
  WebSocketServer,
} from '@nestjs/websockets';

import { JwtService } from '@nestjs/jwt';
import { role_enum } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import { type JwtPayload } from '../../common/types/jwt-payload.type';

import { Server, Socket } from 'socket.io';

// Every role room except the vendor one. Derived from the enum rather than
// listed, so a role added to `role_enum` later is internal by default and a
// second VENDOR-like role is the only thing that needs a thought here.
export const INTERNAL_ROLE_ROOMS = Object.values(role_enum)
  .filter((role) => role !== role_enum.VENDOR)
  .map((role) => `role:${role}`);

@WebSocketGateway({
  namespace: '/performx',
  cors: {
    origin: '*',
    credentials: true,
  },
})
export class NotificationsGateway
  implements OnGatewayConnection, OnGatewayDisconnect
{
  @WebSocketServer()
  server!: Server;

  private readonly logger = new Logger(
    NotificationsGateway.name,
  );

  constructor(
    private readonly jwtService: JwtService,
    private readonly prisma: PrismaService,
  ) {}

  /**
   * Whether this socket may join a room for `entity`.
   *
   * Joining used to be unauthorised: any valid token could join
   * `task:<id>` or `project:<id>` and receive everything broadcast there,
   * which is wider than the REST rules those rooms mirror. Harmless while
   * every token holder was an employee, and not harmless now that
   * role_enum.VENDOR logs in on the same namespace.
   *
   * Returns false rather than throwing. A gateway exception is delivered to
   * the client as an unhandled error event, and a refused join should just be
   * a refused join.
   */
  private async mayJoin(
    kind: 'task' | 'project',
    id: string,
    user: JwtPayload | undefined,
  ): Promise<boolean> {
    if (!user?.sub || !id) return false;

    // Vendors reach their work through the portal namespace, never a room.
    if (user.role === role_enum.VENDOR) return false;

    if (kind === 'project') {
      // Project visibility is company-wide for internal roles: any employee
      // may read a project, so any employee may watch its room. Membership
      // gates writing, and writing does not happen over the socket.
      const project = await this.prisma.projects.findFirst({
        where: { id, deleted_at: null },
        select: { id: true },
      });
      return !!project;
    }

    // Tasks are not company-wide. Mirror the REST rule: the assignee, the
    // assigner, and management.
    const task = await this.prisma.tasks.findFirst({
      where: {
        id,
        deleted_at: null,
        OR: [{ assigned_to_id: user.sub }, { assigned_by_id: user.sub }],
      },
      select: { id: true },
    });
    if (task) return true;

    const MANAGEMENT: role_enum[] = [
      role_enum.MD,
      role_enum.EA,
      role_enum.PA,
      role_enum.HOD,
      role_enum.DEPARTMENT_CONTROLLER,
      role_enum.ADMIN,
    ];
    return MANAGEMENT.includes(user.role);
  }

  async handleConnection(client: Socket) {
    try {
      const token =
        client.handshake.auth?.token ||
        client.handshake.headers?.authorization
          ?.split(' ')[1];

      if (!token) {
        client.disconnect();
        return;
      }

      const payload = this.jwtService.verify(token);

      client.data.user = payload;

      // Personal Room
      client.join(`user:${payload.sub}`);

      // Department Rooms
      const departmentIds = [...new Set([payload.departmentId, ...(payload.departmentIds || [])].filter(Boolean))];
      for (const departmentId of departmentIds) {
        client.join(`department:${departmentId}`);
      }

      // Role Room
      client.join(`role:${payload.role}`);

      this.logger.log(
        `Connected: ${payload.username} (${payload.role})`,
      );
    } catch (error) {
      this.logger.error(
        `Socket Auth Failed: ${client.id}`,
      );

      client.disconnect();
    }
  }

  handleDisconnect(client: Socket) {
    this.logger.log(
      `Disconnected: ${client.id}`,
    );
  }

  // =====================================================
  // TASK ROOM EVENTS
  // =====================================================

  @SubscribeMessage('task:join')
  async handleJoinTask(
    @MessageBody() taskId: string,
    @ConnectedSocket() client: Socket,
  ) {
    if (!(await this.mayJoin('task', taskId, client.data.user))) {
      return { success: false, room: null };
    }
    client.join(`task:${taskId}`);

    return {
      success: true,
      room: `task:${taskId}`,
    };
  }

  @SubscribeMessage('task:leave')
  handleLeaveTask(
    @MessageBody() taskId: string,
    @ConnectedSocket() client: Socket,
  ) {
    client.leave(`task:${taskId}`);

    return {
      success: true,
      room: `task:${taskId}`,
    };
  }

  // =====================================================
  // PROJECT ROOM EVENTS
  // =====================================================

  // Same shape as the task room above: the project detail page joins on mount
  // and leaves on unmount, and every project payload goes to this room rather
  // than to every socket.
  //
  // ponytail: joining is not authorised, exactly as task:join is not. Anyone
  // holding a valid token can join project:<id> and receive its thread, which
  // is wider than the REST rule that gives observers no read on messages. The
  // fix is a project_members lookup here, and it wants doing before Phase 2
  // puts external vendors on this namespace.
  @SubscribeMessage('project:join')
  async handleJoinProject(
    @MessageBody() projectId: string,
    @ConnectedSocket() client: Socket,
  ) {
    if (!(await this.mayJoin('project', projectId, client.data.user))) {
      return { success: false, room: null };
    }
    client.join(`project:${projectId}`);

  }

  @SubscribeMessage('project:leave')
  handleLeaveProject(
    @MessageBody() projectId: string,
    @ConnectedSocket() client: Socket,
  ) {
    client.leave(`project:${projectId}`);

    return {
      success: true,
      room: `project:${projectId}`,
    };
  }

  // =====================================================
  // NOTIFICATION EVENTS
  // =====================================================

  sendToUser(
    userId: string,
    event: string,
    payload: unknown,
  ) {
    this.server
      .to(`user:${userId}`)
      .emit(event, payload);
  }

  sendToDepartment(
    departmentId: string,
    event: string,
    payload: unknown,
  ) {
    this.server
      .to(`department:${departmentId}`)
      .emit(event, payload);
  }

  sendToRole(
    role: string,
    event: string,
    payload: unknown,
  ) {
    this.server
      .to(`role:${role}`)
      .emit(event, payload);
  }

  sendToTask(
    taskId: string,
    event: string,
    payload: unknown,
  ) {
    this.server
      .to(`task:${taskId}`)
      .emit(event, payload);
  }

  sendToProject(
    projectId: string,
    event: string,
    payload: unknown,
  ) {
    this.server
      .to(`project:${projectId}`)
      .emit(event, payload);
  }

  /**
   * Company-wide, employees only.
   *
   * This replaces a `broadcast()` that emitted to the whole namespace. From
   * Phase 2 that namespace includes external vendor logins, so a company-wide
   * emit reached them too. Vendors join `role:VENDOR` on connect like everyone
   * else, so naming the internal rooms is enough to leave them out.
   *
   * Socket.io deduplicates across the room list, so a socket in two of these
   * rooms still receives one copy.
   */
  sendToInternal(
    event: string,
    payload: unknown,
  ) {
    this.server.to(INTERNAL_ROLE_ROOMS).emit(event, payload);
  }

  // =====================================================
  // PREDEFINED HELPERS
  // =====================================================

  notifyUser(
    userId: string,
    notification: unknown,
  ) {
    this.sendToUser(
      userId,
      'notification:new',
      notification,
    );
  }

  refreshDashboard(userId: string) {
    this.sendToUser(
      userId,
      'dashboard:refresh',
      {
        type: 'notifications',
      },
    );
  }

  taskUpdated(
    taskId: string,
    payload: unknown,
  ) {
    this.sendToTask(
      taskId,
      'task:updated',
      payload,
    );
  }

  taskCommentAdded(
    taskId: string,
    payload: unknown,
  ) {
    this.sendToTask(
      taskId,
      'task:comment:new',
      payload,
    );
  }

  taskOverdue(
    taskId: string,
  ) {
    this.sendToTask(
      taskId,
      'task:overdue',
      {
        taskId,
      },
    );
  }

  projectMessageAdded(
    projectId: string,
    payload: unknown,
  ) {
    this.sendToProject(
      projectId,
      'project:message:new',
      payload,
    );
  }

  // Called from whichever service ticks an item. Two people working the same
  // checklist and seeing each other's ticks is the difference between this and
  // a shared document, and it is the reason the checklist owner does not have
  // to reach for the room name itself.
  projectChecklistUpdated(
    projectId: string,
    payload: unknown,
  ) {
    this.sendToProject(
      projectId,
      'project:checklist:updated',
      payload,
    );
  }
}
