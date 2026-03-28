import { UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { JwtAuthGuard } from './jwt-auth.guard';

describe('JwtAuthGuard', () => {
  const jwtService = {
    verifyAsync: jest.fn()
  };

  const guard = new JwtAuthGuard(jwtService as unknown as JwtService);

  beforeEach(() => {
    jest.clearAllMocks();
    delete process.env.JWT_SECRET;
  });

  function createContext(headers: Record<string, string | undefined>) {
    const request: { headers: Record<string, string | undefined>; user?: unknown } = { headers };
    return {
      switchToHttp: () => ({
        getRequest: () => request
      }),
      request
    };
  }

  it('rejects requests without a bearer token', async () => {
    const context = createContext({});

    await expect(guard.canActivate(context as never)).rejects.toBeInstanceOf(UnauthorizedException);
    expect(jwtService.verifyAsync).not.toHaveBeenCalled();
  });

  it('accepts a valid bearer token and attaches the payload to the request', async () => {
    const context = createContext({ authorization: 'Bearer token-123' });
    jwtService.verifyAsync.mockResolvedValue({ sub: 'user-1', email: 'user@example.com', role: 'admin' });
    process.env.JWT_SECRET = 'unit-test-secret';

    await expect(guard.canActivate(context as never)).resolves.toBe(true);

    expect(jwtService.verifyAsync).toHaveBeenCalledWith('token-123', {
      secret: 'unit-test-secret'
    });
    expect(context.request.user).toEqual({
      sub: 'user-1',
      email: 'user@example.com',
      role: 'admin'
    });
  });

  it('rejects invalid bearer tokens', async () => {
    const context = createContext({ Authorization: 'Bearer invalid-token' });
    jwtService.verifyAsync.mockRejectedValue(new Error('bad token'));

    await expect(guard.canActivate(context as never)).rejects.toBeInstanceOf(UnauthorizedException);
    expect(jwtService.verifyAsync).toHaveBeenCalledWith('invalid-token', {
      secret: 'dev-secret'
    });
  });
});
