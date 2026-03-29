import { buildOtpAuthUri, decodeBase32, generateBase32Secret, generateTotp, verifyTotp } from './mfa.util';

describe('mfa util', () => {
  it('generates a valid base32 secret', () => {
    const secret = generateBase32Secret(10);

    expect(secret).toMatch(/^[A-Z2-7]+$/);
    expect(decodeBase32(secret).byteLength).toBeGreaterThan(0);
  });

  it('generates and verifies TOTP codes', () => {
    const secret = 'JBSWY3DPEHPK3PXP';
    const code = generateTotp(secret, new Date('2026-03-29T00:00:00.000Z').getTime());

    expect(code).toHaveLength(6);
    expect(
      verifyTotp(secret, code, {
        now: new Date('2026-03-29T00:00:00.000Z').getTime(),
        window: 0
      })
    ).toBe(true);
    expect(
      verifyTotp(secret, '000000', {
        now: new Date('2026-03-29T00:00:00.000Z').getTime(),
        window: 0
      })
    ).toBe(false);
  });

  it('builds an otpauth URI for authenticator apps', () => {
    expect(
      buildOtpAuthUri({
        issuer: 'PROACTIVE FCS',
        accountName: 'admin@example.com',
        secret: 'JBSWY3DPEHPK3PXP'
      })
    ).toContain('otpauth://totp/');
  });
});
