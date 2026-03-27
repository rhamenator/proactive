'use client';

import { FormEvent, useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';

import { Button, Card, Input } from '../../src/components/ui';
import { getBaseUrl, getErrorMessage } from '../../src/lib/api';
import { useAuth } from '../../src/lib/auth-context';

export default function LoginPage() {
  const { ready, token, login } = useAuth();
  const router = useRouter();
  const [email, setEmail] = useState('admin@proactive.local');
  const [password, setPassword] = useState('Password123!');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const apiUrl = useMemo(() => getBaseUrl(), []);

  useEffect(() => {
    if (ready && token) {
      router.replace('/dashboard');
    }
  }, [ready, router, token]);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSubmitting(true);
    setError(null);

    try {
      await login(email.trim(), password);
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
            <h2 className="heading-reset-tight">Sign in to the operations dashboard</h2>
            <p className="muted heading-reset">
              API target: {apiUrl}
            </p>
          </div>

          <form className="stack" onSubmit={handleSubmit}>
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

          {error ? <div className="notice notice-error">{error}</div> : null}

          <div className="notice notice-neutral">
            Seed credentials default to <strong>admin@proactive.local</strong> / <strong>Password123!</strong>.
          </div>
        </Card>
      </div>
    </div>
  );
}
