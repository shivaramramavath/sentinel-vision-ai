import {
  Injectable,
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  UnauthorizedException,
} from '@nestjs/common';
import { RbacService } from '../rbac.service';

@Injectable()
export class StepUpGuard implements CanActivate {
  constructor(private readonly rbacService: RbacService) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest();
    const user = request.user;

    if (!user || !user.id) {
      throw new UnauthorizedException('Authentication required');
    }

    const stepUpHeader =
      (request.headers['x-step-up-token'] as string) ||
      (request.headers['x-step-up'] as string);

    const isValid = await this.rbacService.validateStepUp(
      user.id,
      user.sessionId,
      stepUpHeader,
    );

    if (!isValid) {
      throw new ForbiddenException({
        statusCode: 403,
        error: 'Forbidden',
        code: 'STEP_UP_REQUIRED',
        message:
          'Elevated operation requires step-up authentication within the last 5 minutes.',
        stepUpRequired: true,
      });
    }

    return true;
  }
}
