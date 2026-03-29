'use client';

import { FormEvent, useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';

import { Button, Card, Input, TextArea } from '../../src/components/ui';
import { getBaseUrl, getErrorMessage } from '../../src/lib/api';
import { useAuth } from '../../src/lib/auth-context';
import type { MfaChallengeResponse } from '../../src/lib/types';

export default function LoginPage() {
  const { ready, token, login, initializeMfaSetup, completeMfaSetup, verifyMfa } = useAuth();
  const router = useRouter();
  const [email, setEmail] = useState('admin@proactive.local');
  const [password, setPassword] = useState('Password123!');
  const [mfaCode, setMfaCode] = useState('');
  const [challenge, setChallenge] = useState<MfaChallengeResponse | null>(null);
  const [setupSecret, setSetupSecret] = useState<string | null>(null);
  const [otpauthUri, setOtpAuthUri] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const apiUrl = useMemo(() => getBaseUrl(), []);

  useEffect(() => {
    if (ready && token) {
      router.replace('/dashboard');
    }
  }, [ready, router, token]);

  function resetMfaState() {
    setChallenge(null);
    setMfaCode('');
    setSetupSecret(null);
    setOtpAuthUri(null);
  }

  async function handleCredentialsSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSubmitting(true);
    setError(null);

    try {
      const result = await login(email.trim(), password);
      if (result) {
        setChallenge(result);
        setMfaCode('');
        if (result.setupRequired) {
          const setup = await initializeMfaSetup(result.challengeToken);
          setSetupSecret(setup.secret);
          setOtpAuthUri(setup.otpauthUri);
        }
      }
    } catch (value) {
      setError(getErrorMessage(value));
    } finally {
      setSubmitting(false);
    }
  }

  async function handleMfaSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!challenge) {
      return;
    }

    setSubmitting(true);
    setError(null);

    try {
      if (challenge.setupRequired) {
        await completeMfaSetup(challenge.challengeToken, mfaCode.trim());
      } else {
        await verifyMfa(challenge.challengeToken, mfaCode.trim());
      }
    } catch (value) {
      setError(getErrorMessage(value));
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="login-shell">
      <div className="login-grid">
        <section className="login-hero">
          <p className="eyebrow">PROACTIVE FCS</p>
          <h1>Field operations without the clipboard drag.</h1>
          <p>
            This admin dashboard handles turf imports, canvasser staffing, live progress, and VAN-ready
            exports for the first PROACTIVE release.
          </p>

          <div className="login-callouts">
            <div className="login-callout">
              <strong>Import CSVs</strong>
              <p>Map VAN columns, create turfs, and load addresses in one flow.</p>
            </div>
            <div className="login-callout">
              <strong>Run the field</strong>
              <p>Track active canvassers, completion rates, and export-ready visit totals.</p>
            </div>
          </div>
        </section>

        <Card className="login-card">
          <div>
            <p className="section-kicker">Admin Login</p>
            <h2 className="heading-reset-tight">
              {challenge
                ? challenge.setupRequired
                  ? 'Set up multi-factor authentication'
                  : 'Enter your authentication code'
                : 'Sign in to the operations dashboard'}
            </h2>
            <p className="muted heading-reset">
              API target: {apiUrl}
            </p>
          </div>

          {!challenge ? (
            <form className="stack" onSubmit={handleCredentialsSubmit}>
              <div className="field-group">
                <label htmlFor="email">Email</label>
                <Input id="email" type="email" value={email} onChange={(event) => setEmail(event.target.value)} />
              </div>

              <div className="field-group">
                <label htmlFor="password">Password</label>
                <Input
                  id="password"
                  type="password"
                  value={password}
                  onChange={(event) => setPassword(event.target.value)}
                />
              </div>

              <Button type="submit" disabled={submitting}>
                {submitting ? 'Signing In...' : 'Open Dashboard'}
              </Button>
            </form>
          ) : (
            <form className="stack" onSubmit={handleMfaSubmit}>
              <div className="notice notice-neutral">
                {challenge.setupRequired
                  ? 'Admins must enroll in multi-factor authentication before the first dashboard session is issued.'
                  : 'Enter the 6-digit code from your authenticator app to finish signing in.'}
              </div>

              {challenge.setupRequired && setupSecret ? (
                <>
                  <div className="field-group">
                    <label htmlFor="mfa-secret">Authenticator secret</label>
                    <Input id="mfa-secret" value={setupSecret} readOnly />
                  </div>
                  <div className="field-group">
                    <label htmlFor="otpauth-uri">OTPAuth URI</label>
                    <TextArea id="otpauth-uri" value={otpauthUri ?? ''} readOnly rows={4} />
                  </div>
                </>
              ) : null}

              <div className="field-group">
                <label htmlFor="mfa-code">Authentication code</label>
                <Input
                  id="mfa-code"
                  inputMode="numeric"
                  autoComplete="one-time-code"
                  value={mfaCode}
                  onChange={(event) => setMfaCode(event.target.value)}
                />
              </div>

              <div className="inline-actions">
                <Button type="submit" disabled={submitting}>
                  {submitting
                    ? challenge.setupRequired
                      ? 'Enabling MFA...'
                      : 'Verifying...'
                    : challenge.setupRequired
                      ? 'Enable MFA and Continue'
                      : 'Verify and Continue'}
                </Button>
                <Button variant="ghost" onClick={resetMfaState}>
                  Start Over
                </Button>
              </div>
            </form>
          )}

          {error ? <div className="notice notice-error">{error}</div> : null}

          {!challenge ? (
            <div className="notice notice-neutral">
              Seed credentials default to <strong>admin@proactive.local</strong> / <strong>Password123!</strong>.
            </div>
          ) : null}
        </Card>
      </div>
    </div>
  );
}
