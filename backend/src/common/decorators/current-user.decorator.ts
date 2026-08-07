import { createParamDecorator, type ExecutionContext } from '@nestjs/common';
import type { JwtUserPayload } from '../interfaces/jwt-user-payload.interface.js';

export const CurrentUser = createParamDecorator(
  (_data: unknown, context: ExecutionContext): JwtUserPayload | undefined => {
    const request = context.switchToHttp().getRequest<{ user?: JwtUserPayload }>();
    return request.user;
  }
);
