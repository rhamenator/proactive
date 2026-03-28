import { AppService } from './app.service';

describe('AppService', () => {
  it('returns a health payload', () => {
    const service = new AppService();

    const result = service.getHealth();

    expect(result).toEqual(
      expect.objectContaining({
        ok: true,
        service: 'proactive-backend',
        timestamp: expect.any(String)
      })
    );
  });
});
