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
}
