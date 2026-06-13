import { createParamDecorator, ExecutionContext } from '@nestjs/common';
import { Request } from 'express';
import { JwtPayload } from '@verity/shared';

export const CurrentUser = createParamDecorator(
  (_data: unknown, ctx: ExecutionContext): JwtPayload => {
    const req = ctx.switchToHttp().getRequest<Request & { user: JwtPayload }>();
    return req.user;
  },
);
