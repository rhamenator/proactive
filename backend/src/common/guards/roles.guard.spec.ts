import { ExecutionContext } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { UserRole } from '@prisma/client';
import { RolesGuard } from './roles.guard';

function createHttpContext(role?: UserRole) {
  return {
    getHandler: jest.fn(),
    getClass: jest.fn(),
    switchToHttp: () => ({
      getRequest: () => ({
        user: role ? { sub: 'user-1', email: 'user@example.com', role } : undefined
      })
    })
  } as unknown as ExecutionContext;
}

describe('RolesGuard', () => {
  const reflector = {
    getAllAndOverride: jest.fn()
  };

  const guard = new RolesGuard(reflector as unknown as Reflector);

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('allows access when no role metadata is present', () => {
    reflector.getAllAndOverride.mockReturnValue(undefined);

    expect(guard.canActivate(createHttpContext())).toBe(true);
  });

  it('allows access when the request user matches an allowed role', () => {
    reflector.getAllAndOverride.mockReturnValue([UserRole.admin, UserRole.supervisor]);

    expect(guard.canActivate(createHttpContext(UserRole.supervisor))).toBe(true);
  });

  it('blocks access when the request user does not match an allowed role', () => {
    reflector.getAllAndOverride.mockReturnValue([UserRole.admin, UserRole.supervisor]);

    expect(guard.canActivate(createHttpContext(UserRole.canvasser))).toBe(false);
  });

  it('blocks access when metadata requires roles but the request is anonymous', () => {
    reflector.getAllAndOverride.mockReturnValue([UserRole.admin]);

    expect(guard.canActivate(createHttpContext())).toBe(false);
  });
});
