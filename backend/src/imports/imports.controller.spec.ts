import { ImportsController } from './imports.controller';

describe('ImportsController', () => {
  const importsService = {
    importCsv: jest.fn()
  };

  const controller = new ImportsController(importsService as never);

  beforeEach(() => {
    jest.clearAllMocks();
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
});
