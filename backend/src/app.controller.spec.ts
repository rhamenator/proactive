import { AppController } from './app.controller';

describe('AppController', () => {
  const appService = {
    getHealth: jest.fn()
  };
  const usersService = {
    findById: jest.fn(),
    sanitize: jest.fn()
  };
  const controller = new AppController(appService as never, usersService as never);

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('returns the health response from the app service', () => {
    appService.getHealth.mockReturnValue({ ok: true });

    expect(controller.getHealth()).toEqual({ ok: true });
  });

  it('returns the sanitized current user payload', async () => {
    usersService.findById.mockResolvedValue({ id: 'user-1' });
    usersService.sanitize.mockReturnValue({ id: 'user-1', email: 'user@example.com' });

    await expect(
      controller.getMe({ sub: 'user-1', email: 'user@example.com', role: 'admin' as never })
    ).resolves.toEqual({ id: 'user-1', email: 'user@example.com' });
  });
});
