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

import { Server, Socket } from 'socket.io';

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
  ) {}

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
  handleJoinTask(
    @MessageBody() taskId: string,
    @ConnectedSocket() client: Socket,
  ) {
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
  handleJoinProject(
    @MessageBody() projectId: string,
    @ConnectedSocket() client: Socket,
  ) {
    client.join(`project:${projectId}`);

    return {
      success: true,
      room: `project:${projectId}`,
    };
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

  // Reaches every connected socket in the namespace, which from Phase 2 includes
  // external vendor logins. It has no callers and should not gain one: anything
  // company-wide wants sendToRole or a per-department fan-out instead.
  broadcast(
    event: string,
    payload: unknown,
  ) {
    this.server.emit(event, payload);
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
