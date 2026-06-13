import { Injectable, CanActivate, ExecutionContext } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { Request } from 'express';
import { JwtPayload, UserRole } from '@verity/shared';
import { ROLES_KEY } from '../decorators/roles.decorator';

@Injectable()
export class RolesGuard implements CanActivate {
  constructor(private readonly reflector: Reflector) {}

  canActivate(context: ExecutionContext): boolean {
    const required = this.reflector.getAllAndOverride<UserRole[]>(ROLES_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);
    if (!required) return true;

    const { user } = context
      .switchToHttp()
      .getRequest<Request & { user: JwtPayload }>();
    if (user.role === 'super_admin') return true;
    return required.includes(user.role);
  }
}
