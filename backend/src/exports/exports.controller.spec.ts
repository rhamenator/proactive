import type { Response } from 'express';
import { ExportsController } from './exports.controller';

describe('ExportsController', () => {
  const exportsService = {
    vanResultsCsv: jest.fn()
  };
  const controller = new ExportsController(exportsService as never);

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('returns the raw result when no response object is provided', async () => {
    exportsService.vanResultsCsv.mockResolvedValue({ csv: 'csv-data', count: 1 });

    await expect(
      controller.vanResultsCsv('turf-1', 'true', { sub: 'admin-1', email: 'admin@example.com', role: 'admin' as never })
    ).resolves.toEqual({ csv: 'csv-data', count: 1 });
  });

  it('writes CSV headers and body to the response when provided', async () => {
    const response = {
      setHeader: jest.fn(),
      send: jest.fn().mockReturnValue('sent')
    } as unknown as Response;
    exportsService.vanResultsCsv.mockResolvedValue({ csv: 'csv-data', count: 1 });

    await expect(
      controller.vanResultsCsv(
        'turf-1',
        'false',
        { sub: 'admin-1', email: 'admin@example.com', role: 'admin' as never },
        response
      )
    ).resolves.toBe('sent');

    expect(response.setHeader).toHaveBeenCalledWith('Content-Type', 'text/csv; charset=utf-8');
    expect(response.setHeader).toHaveBeenCalledWith(
      'Content-Disposition',
      'attachment; filename="van-results.csv"'
    );
  });
});
