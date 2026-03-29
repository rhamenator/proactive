import type { Response } from 'express';
import { ExportsController } from './exports.controller';

describe('ExportsController', () => {
  const exportsService = {
    vanResultsCsv: jest.fn(),
    internalMasterCsv: jest.fn(),
    exportHistory: jest.fn()
  };
  const usersService = {
    findById: jest.fn()
  };
  const controller = new ExportsController(exportsService as never, usersService as never);

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('returns the raw result when no response object is provided', async () => {
    exportsService.vanResultsCsv.mockResolvedValue({ csv: 'csv-data', count: 1, filename: 'van-results.csv' });

    await expect(
      controller.vanResultsCsv('turf-1', 'true', {
        sub: 'admin-1',
        email: 'admin@example.com',
        role: 'admin' as never,
        organizationId: null
      })
    ).resolves.toEqual({ csv: 'csv-data', count: 1, filename: 'van-results.csv' });

    expect(exportsService.vanResultsCsv).toHaveBeenCalledWith({
      turfId: 'turf-1',
      markExported: true,
      actorUserId: 'admin-1',
      organizationId: null
    });
  });

  it('writes CSV headers and body to the response when provided', async () => {
    const response = {
      setHeader: jest.fn(),
      send: jest.fn().mockReturnValue('sent')
    } as unknown as Response;
    exportsService.vanResultsCsv.mockResolvedValue({ csv: 'csv-data', count: 1, filename: 'van-results.csv' });

    await expect(
      controller.vanResultsCsv(
        'turf-1',
        'false',
        { sub: 'admin-1', email: 'admin@example.com', role: 'admin' as never, organizationId: 'org-1' },
        response
      )
    ).resolves.toBe('sent');

    expect(response.setHeader).toHaveBeenCalledWith('Content-Type', 'text/csv; charset=utf-8');
    expect(response.setHeader).toHaveBeenCalledWith(
      'Content-Disposition',
      'attachment; filename="van-results.csv"'
    );
    expect(exportsService.vanResultsCsv).toHaveBeenCalledWith({
      turfId: 'turf-1',
      markExported: false,
      actorUserId: 'admin-1',
      organizationId: 'org-1'
    });
  });

  it('returns export history and supports the internal master export endpoint', async () => {
    const response = {
      setHeader: jest.fn(),
      send: jest.fn().mockReturnValue('sent-internal')
    } as unknown as Response;
    exportsService.exportHistory.mockResolvedValue([{ id: 'batch-1' }]);
    exportsService.internalMasterCsv.mockResolvedValue({
      csv: 'csv-data',
      count: 1,
      filename: 'internal-master.csv'
    });

    await expect(
      controller.exportHistory({
        sub: 'admin-1',
        email: 'admin@example.com',
        role: 'admin' as never,
        organizationId: 'org-1'
      })
    ).resolves.toEqual([{ id: 'batch-1' }]);
    await expect(
      controller.internalMasterCsv(
        'turf-1',
        { sub: 'admin-1', email: 'admin@example.com', role: 'admin' as never, organizationId: 'org-1' },
        response
      )
    ).resolves.toBe('sent-internal');

    expect(exportsService.exportHistory).toHaveBeenCalledWith('org-1');
    expect(exportsService.internalMasterCsv).toHaveBeenCalledWith({
      turfId: 'turf-1',
      actorUserId: 'admin-1',
      organizationId: 'org-1'
    });
    expect(response.setHeader).toHaveBeenCalledWith(
      'Content-Disposition',
      'attachment; filename="internal-master.csv"'
    );
  });
});
