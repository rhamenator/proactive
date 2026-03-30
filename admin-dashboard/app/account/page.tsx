'use client';

import { useEffect, useState } from 'react';

import { ProtectedFrame } from '../../src/components/protected-frame';
import { Button, Card, Input } from '../../src/components/ui';
import { getErrorMessage } from '../../src/lib/api';
import { useAuth, useAuthedApi } from '../../src/lib/auth-context';
import type { MfaStatusResponse } from '../../src/lib/types';

export default function AccountPage() {
  const { user, logout } = useAuth();
  const api = useAuthedApi();
  const [status, setStatus] = useState<MfaStatusResponse | null>(null);
  const [password, setPassword] = useState('');
  const [code, setCode] = useState('');
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    void api
      .mfaStatus()
      .then(setStatus)
      .catch((value) => setError(getErrorMessage(value)));
  }, [api]);

  async function handleDisableMfa() {
    setSubmitting(true);
    setError(null);
    setMessage(null);

    try {
      const result = await api.disableMfa(password, code);
      setStatus({
        enabled: false,
        required: result.setupRequiredOnNextLogin,
        backupCodeCount: 0
      });
      setPassword('');
      setCode('');
      setMessage('MFA was disabled. Admin accounts will be prompted to re-enroll at the next sign-in.');
    } catch (value) {
      setError(getErrorMessage(value));
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <ProtectedFrame title="Account" eyebrow="Security">
      <div className="stack">
        {message ? <div className="notice notice-success">{message}</div> : null}
        {error ? <div className="notice notice-error">{error}</div> : null}

        <Card className="stack">
          <div>
            <p className="section-kicker">Signed-In User</p>
            <h2 className="heading-reset-tight">
              {user?.firstName} {user?.lastName}
            </h2>
            <p className="muted">{user?.email}</p>
          </div>

          <div className="stack">
            <p className="muted">Role: {user?.role}</p>
            <p className="muted">
              MFA status:{' '}
              {status
                ? status.enabled
                  ? 'Enabled'
                  : status.required
                    ? 'Required but not currently enabled'
                    : 'Optional and disabled'
                : 'Loading...'}
            </p>
            <p className="muted">Unused backup codes: {status ? status.backupCodeCount : 'Loading...'}</p>
          </div>
        </Card>

        <Card className="stack">
          <div>
            <p className="section-kicker">Authenticator</p>
            <h2 className="heading-reset-tight">Manage MFA</h2>
            <p className="muted">
              {status?.required
                ? 'Admin and supervisor accounts must complete MFA enrollment before the next full login session.'
                : 'MFA is optional for this role.'}
            </p>
          </div>

          {status?.enabled ? (
            <>
              <div className="field-group">
                <label htmlFor="disable-password">Current password</label>
                <Input
                  id="disable-password"
                  type="password"
                  value={password}
                  onChange={(event) => setPassword(event.target.value)}
                />
              </div>
              <div className="field-group">
                <label htmlFor="disable-code">Current authenticator code</label>
                <Input
                  id="disable-code"
                  autoComplete="one-time-code"
                  value={code}
                  onChange={(event) => setCode(event.target.value)}
                />
              </div>
              <div className="inline-actions">
                <Button variant="danger" onClick={() => void handleDisableMfa()} disabled={submitting}>
                  {submitting ? 'Updating...' : 'Disable MFA'}
                </Button>
                <Button variant="ghost" onClick={() => void logout()}>
                  Sign out
                </Button>
              </div>
            </>
          ) : (
            <div className="notice notice-neutral">
              {status?.required
                ? 'Sign out and sign back in to begin MFA enrollment.'
                : 'MFA is not currently enabled for this account.'}
            </div>
          )}
        </Card>
      </div>
    </ProtectedFrame>
  );
}
