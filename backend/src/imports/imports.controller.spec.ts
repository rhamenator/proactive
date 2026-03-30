import { ImportsController } from './imports.controller';

describe('ImportsController', () => {
  const importsService = {
    importCsv: jest.fn(),
    importHistory: jest.fn(),
    downloadImportBatch: jest.fn()
  };
  const usersService = {
    findById: jest.fn()
  };

  const controller = new ImportsController(importsService as never, usersService as never);

  beforeEach(() => {
    jest.clearAllMocks();
    usersService.findById.mockResolvedValue({
      id: 'admin-1',
      organizationId: 'org-1',
      campaignId: null
    });
  });

  it('delegates CSV imports after parsing mapping JSON and policy options', async () => {
    const file = {
      buffer: Buffer.from('address,city,state\n100 Main,Detroit,MI\n')
    } as Express.Multer.File;

    await controller.importCsv(
      file,
      {
        turfName: 'North',
        mapping: JSON.stringify({ addressLine1: 'address' }),
        mode: 'upsert',
        duplicateStrategy: 'merge'
      },
      { sub: 'admin-1', email: 'admin@example.com', role: 'admin' as never }
    );

    expect(importsService.importCsv).toHaveBeenCalledWith({
      csv: 'address,city,state\n100 Main,Detroit,MI\n',
      createdById: 'admin-1',
      turfName: 'North',
      mapping: { addressLine1: 'address' },
      mode: 'upsert',
      duplicateStrategy: 'merge'
    });
  });

  it('lists and downloads import history within the caller scope', async () => {
    importsService.importHistory.mockResolvedValue([{ id: 'batch-1' }]);
    importsService.downloadImportBatch.mockResolvedValue({
      csv: 'address,city,state\n100 Main,Detroit,MI\n',
      filename: 'import-batch.csv'
    });
    const response = {
      setHeader: jest.fn(),
      send: jest.fn()
    };
    const user = { sub: 'admin-1', email: 'admin@example.com', role: 'admin' as never };

    const history = await controller.importHistory(user);
    await controller.downloadImportBatch('batch-1', user, response as never);

    expect(importsService.importHistory).toHaveBeenCalledWith({
      organizationId: 'org-1',
      campaignId: null
    });
    expect(importsService.downloadImportBatch).toHaveBeenCalledWith('batch-1', {
      organizationId: 'org-1',
      campaignId: null
    });
    expect(history).toEqual([{ id: 'batch-1' }]);
    expect(response.setHeader).toHaveBeenCalledWith('Content-Type', 'text/csv; charset=utf-8');
    expect(response.send).toHaveBeenCalledWith('address,city,state\n100 Main,Detroit,MI\n');
  });
});
