import { AuthController } from './auth.controller';

describe('AuthController', () => {
  const authService = {
    login: jest.fn(),
    refresh: jest.fn(),
    logout: jest.fn(),
    requestPasswordReset: jest.fn(),
    completePasswordReset: jest.fn(),
    activateAccount: jest.fn()
  };
  const usersService = {
    findById: jest.fn(),
    sanitize: jest.fn()
  };
  const controller = new AuthController(authService as never, usersService as never);

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('delegates login to the auth service', () => {
    controller.login({ email: 'user@example.com', password: 'Password123!' });

    expect(authService.login).toHaveBeenCalledWith('user@example.com', 'Password123!');
  });

  it('delegates refresh and logout to the auth service', () => {
    controller.refresh({ refreshToken: 'refresh-token' });
    controller.logout({ refreshToken: 'refresh-token' });

    expect(authService.refresh).toHaveBeenCalledWith('refresh-token');
    expect(authService.logout).toHaveBeenCalledWith('refresh-token');
  });

  it('delegates reset and activation flows to the auth service', () => {
    controller.requestPasswordReset({ email: 'user@example.com' });
    controller.confirmPasswordReset({ token: 'reset-token', password: 'Password123!' });
    controller.activate({ token: 'activation-token', password: 'Password123!' });

    expect(authService.requestPasswordReset).toHaveBeenCalledWith('user@example.com');
    expect(authService.completePasswordReset).toHaveBeenCalledWith('reset-token', 'Password123!');
    expect(authService.activateAccount).toHaveBeenCalledWith('activation-token', 'Password123!');
  });

  it('returns the current user from the users service', async () => {
    usersService.findById.mockResolvedValue({ id: 'user-1' });
    usersService.sanitize.mockReturnValue({ id: 'user-1', email: 'user@example.com' });

    await expect(
      controller.me({ sub: 'user-1', email: 'user@example.com', role: 'admin' as never })
    ).resolves.toEqual({ id: 'user-1', email: 'user@example.com' });
  });
});
