import { Injectable, CanActivate, ExecutionContext, UnauthorizedException, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

@Injectable()
export class InternalApiGuard implements CanActivate {
  private readonly logger = new Logger(InternalApiGuard.name);

  constructor(private configService: ConfigService) {}

  canActivate(context: ExecutionContext): boolean {
    const request = context.switchToHttp().getRequest();
    const apiKey = request.headers['x-internal-api-key'];

    const expectedApiKey = this.configService.get<string>('INTERNAL_API_KEY');

    if (!apiKey || apiKey !== expectedApiKey) {
      this.logger.warn(`Unauthorized internal API access attempt`);
      throw new UnauthorizedException('Invalid Internal API Key');
    }

    return true;
  }
}
