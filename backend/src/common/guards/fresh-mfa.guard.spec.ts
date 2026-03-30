import { ForbiddenException } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { UserRole } from '@prisma/client';
import { FreshMfaGuard } from './fresh-mfa.guard';

describe('FreshMfaGuard', () => {
  const reflector = {
    getAllAndOverride: jest.fn()
  };
  const guard = new FreshMfaGuard(reflector as unknown as Reflector);

  beforeEach(() => {
    jest.clearAllMocks();
    delete process.env.SENSITIVE_MFA_TTL_MINUTES;
    delete process.env.SENSITIVE_ACTION_MFA_WINDOW_MINUTES;
  });

  function createContext(user?: Record<string, unknown>) {
    return {
      getHandler: jest.fn(),
      getClass: jest.fn(),
      switchToHttp: () => ({
        getRequest: () => ({ user })
      })
    };
  }

  it('allows non-sensitive routes without checking freshness', () => {
    reflector.getAllAndOverride.mockReturnValue(undefined);

    expect(guard.canActivate(createContext() as never)).toBe(true);
  });

  it('rejects sensitive routes without a fresh MFA timestamp', () => {
    reflector.getAllAndOverride.mockReturnValue(true);

    expect(() =>
      guard.canActivate(
        createContext({ sub: 'admin-1', role: UserRole.admin }) as never
      )
    ).toThrow(ForbiddenException);
  });

  it('allows sensitive routes with a recent MFA verification', () => {
    reflector.getAllAndOverride.mockReturnValue(true);

    expect(
      guard.canActivate(
        createContext({
          sub: 'admin-1',
          role: UserRole.admin,
          mfaVerifiedAt: new Date().toISOString()
        }) as never
      )
    ).toBe(true);
  });
});
