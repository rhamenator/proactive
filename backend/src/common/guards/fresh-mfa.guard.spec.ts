import { ForbiddenException } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { UserRole } from '@prisma/client';
import { FreshMfaGuard } from './fresh-mfa.guard';

describe('FreshMfaGuard', () => {
  const reflector = {
    getAllAndOverride: jest.fn()
  };
  const policiesService = {
    getEffectivePolicy: jest.fn().mockResolvedValue({ sensitiveMfaWindowMinutes: 5 })
  };
  const guard = new FreshMfaGuard(reflector as unknown as Reflector, policiesService as never);

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

  it('allows non-sensitive routes without checking freshness', async () => {
    reflector.getAllAndOverride.mockReturnValue(undefined);

    await expect(guard.canActivate(createContext() as never)).resolves.toBe(true);
  });

  it('rejects sensitive routes without a fresh MFA timestamp', async () => {
    reflector.getAllAndOverride.mockReturnValue(true);

    await expect(
      guard.canActivate(
        createContext({ sub: 'admin-1', role: UserRole.admin }) as never
      )
    ).rejects.toThrow(ForbiddenException);
  });

  it('allows sensitive routes with a recent MFA verification', async () => {
    reflector.getAllAndOverride.mockReturnValue(true);

    await expect(
      guard.canActivate(
        createContext({
          sub: 'admin-1',
          role: UserRole.admin,
          mfaVerifiedAt: new Date().toISOString()
        }) as never
      )
    ).resolves.toBe(true);
  });
});
