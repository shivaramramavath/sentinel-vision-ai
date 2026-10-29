import { ExecutionContext } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { RolesGuard } from './roles.guard';

describe('RolesGuard', () => {
  let rolesGuard: RolesGuard;
  let reflector: Reflector;

  beforeEach(() => {
    reflector = new Reflector();
    rolesGuard = new RolesGuard(reflector);
  });

  function createMockContext(user: any): ExecutionContext {
    return {
      switchToHttp: () => ({
        getRequest: () => ({ user }),
      }),
      getHandler: () => ({}),
      getClass: () => ({}),
    } as unknown as ExecutionContext;
  }

  it('should allow access if no roles are required', () => {
    jest.spyOn(reflector, 'getAllAndOverride').mockReturnValue(undefined);
    const context = createMockContext({ role: 'Viewer' });
    expect(rolesGuard.canActivate(context)).toBe(true);
  });

  it('should allow Super Admin to access any role protected route', () => {
    jest.spyOn(reflector, 'getAllAndOverride').mockReturnValue(['Investigator']);
    const context = createMockContext({ role: 'Super Admin' });
    expect(rolesGuard.canActivate(context)).toBe(true);
  });

  it('should allow Investigator to access Investigator or Reviewer routes', () => {
    jest.spyOn(reflector, 'getAllAndOverride').mockReturnValue(['Reviewer']);
    const context = createMockContext({ role: 'Investigator' });
    expect(rolesGuard.canActivate(context)).toBe(true);
  });

  it('should prevent Viewer from accessing Investigator protected route', () => {
    jest.spyOn(reflector, 'getAllAndOverride').mockReturnValue(['Investigator']);
    const context = createMockContext({ role: 'Viewer' });
    expect(rolesGuard.canActivate(context)).toBe(false);
  });
});
