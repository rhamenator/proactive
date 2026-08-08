'use client';

import { FormEvent, useCallback, useEffect, useState } from 'react';

import { ProtectedFrame } from '../../src/components/protected-frame';
import { Badge, Button, Card, Input } from '../../src/components/ui';
import { getErrorMessage } from '../../src/lib/api';
import { useAuth, useAuthedApi } from '../../src/lib/auth-context';
import type { RecoveryCaseRecord, RecoveryCaseType, RecoveryTargetRecord } from '../../src/lib/types';
import { formatLocalDateTime } from '../../src/lib/datetime';

const recoveryLabels: Record<RecoveryCaseType, string> = {
  help_desk_mfa_reset: 'Help-desk MFA reset',
  help_desk_account_recovery: 'Help-desk account recovery',
  break_glass_account_recovery: 'Break-glass admin recovery'
};

export default function RecoveryPage() {
  const api = useAuthedApi();
  const { user, runSensitiveAction } = useAuth();
  const [cases, setCases] = useState<RecoveryCaseRecord[]>([]);
  const [targets, setTargets] = useState<RecoveryTargetRecord[]>([]);
  const [targetUserId, setTargetUserId] = useState('');
  const [type, setType] = useState<RecoveryCaseType>('help_desk_mfa_reset');
  const [reason, setReason] = useState('');
  const [reviewReasons, setReviewReasons] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true); setError(null);
    try {
      const [nextCases, nextTargets] = await Promise.all([api.listRecoveryCases(), api.listRecoveryTargets()]);
      setCases(nextCases); setTargets(nextTargets);
    } catch (value) { setError(getErrorMessage(value)); } finally { setLoading(false); }
  }, [api]);

  useEffect(() => { void load(); }, [load]);

  async function requestRecovery(event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); setSaving(true); setError(null); setMessage(null);
    try {
      await runSensitiveAction('request privileged account recovery', (freshApi) =>
        freshApi.requestRecovery({ targetUserId, type, reason: reason.trim() })
      );
      setTargetUserId(''); setReason(''); setType('help_desk_mfa_reset');
      setMessage('Recovery case created. A distinct admin must review it before any account change occurs.');
      await load();
    } catch (value) { setError(getErrorMessage(value)); } finally { setSaving(false); }
  }

  async function review(caseId: string, action: 'approve' | 'reject') {
    const reviewReason = reviewReasons[caseId]?.trim() ?? '';
    if (reviewReason.length < 10) { setError('Enter a review reason of at least 10 characters.'); return; }
    setSaving(true); setError(null); setMessage(null);
    try {
      await runSensitiveAction(`${action} privileged account recovery`, (freshApi) =>
        action === 'approve'
          ? freshApi.approveRecovery(caseId, reviewReason)
          : freshApi.rejectRecovery(caseId, reviewReason)
      );
      setMessage(action === 'approve' ? 'Recovery executed; sessions and old recovery artifacts were revoked.' : 'Recovery case rejected.');
      await load();
    } catch (value) { setError(getErrorMessage(value)); } finally { setSaving(false); }
  }

  return (
    <ProtectedFrame title="Account Recovery" eyebrow="Two-person Security Workflow">
      <div className="stack">
        {message ? <div className="notice notice-success">{message}</div> : null}
        {error ? <div className="notice notice-error">{error}</div> : null}
        <Card className="stack">
          <div><p className="section-kicker">Policy</p><h2 className="heading-reset">Recovery is never a silent reset</h2></div>
          <p className="muted">Every request needs recent MFA and a reason. A different admin must approve it. Approval revokes refresh sessions, impersonation sessions, MFA challenges and backup codes, activation links, and older password-reset links. Admin targets require the explicitly enabled break-glass path.</p>
        </Card>
        <Card>
          <form className="stack" onSubmit={requestRecovery}>
            <div><p className="section-kicker">Request</p><h2 className="heading-reset">Open a recovery case</h2></div>
            <div className="grid two">
              <div className="field-group"><label htmlFor="recovery-target">Affected account</label><select id="recovery-target" className="select" required value={targetUserId} onChange={(event) => setTargetUserId(event.target.value)}><option value="">Select an account</option>{targets.map((target) => <option key={target.id} value={target.id} disabled={target.id === user?.id}>{target.firstName} {target.lastName} · {target.email} · {target.role}{target.id === user?.id ? ' (self-recovery prohibited)' : ''}</option>)}</select></div>
              <div className="field-group"><label htmlFor="recovery-type">Recovery type</label><select id="recovery-type" className="select" value={type} onChange={(event) => setType(event.target.value as RecoveryCaseType)}>{Object.entries(recoveryLabels).map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select></div>
            </div>
            <div className="field-group"><label htmlFor="recovery-reason">Request reason and identity evidence reference</label><Input id="recovery-reason" required minLength={10} value={reason} onChange={(event) => setReason(event.target.value)} placeholder="Record why recovery is needed and the approved evidence/checklist reference; do not enter secrets." /></div>
            <div className="inline-actions"><Button type="submit" disabled={saving || !targetUserId || reason.trim().length < 10}>{saving ? 'Submitting...' : 'Create Recovery Case'}</Button></div>
          </form>
        </Card>
        <Card className="stack">
          <div className="inline-actions inline-actions-between"><div><p className="section-kicker">Review queue</p><h2 className="heading-reset">Recovery cases and notification status</h2></div><Button variant="ghost" onClick={() => void load()} disabled={loading}>{loading ? 'Loading...' : 'Refresh'}</Button></div>
          {cases.map((recovery) => (
            <Card key={recovery.id} className="stack card-subtle">
              <div className="inline-actions inline-actions-between"><div className="stack-tight"><strong>{recovery.targetUser.firstName} {recovery.targetUser.lastName}</strong><span className="muted">{recovery.targetUser.email} · {recoveryLabels[recovery.type]}</span></div><Badge tone={recovery.status === 'executed' ? 'success' : recovery.status === 'pending' ? 'warning' : 'default'}>{recovery.status}</Badge></div>
              <div className="muted">Requested by {recovery.requestedByUser.firstName} {recovery.requestedByUser.lastName} at {formatLocalDateTime(recovery.createdAt)} · expires {formatLocalDateTime(recovery.expiresAt)}</div>
              <div>{recovery.reasonText}</div>
              <div className="muted">Independent notification: {recovery.notificationStatus}{recovery.notificationError ? ` (${recovery.notificationError})` : ''}</div>
              {recovery.reviewedByUser ? <div className="muted">Reviewed by {recovery.reviewedByUser.firstName} {recovery.reviewedByUser.lastName}{recovery.reviewReason ? ` · ${recovery.reviewReason}` : ''}</div> : null}
              {recovery.status === 'pending' ? <div className="stack"><div className="field-group"><label htmlFor={`review-${recovery.id}`}>Independent review reason</label><Input id={`review-${recovery.id}`} value={reviewReasons[recovery.id] ?? ''} onChange={(event) => setReviewReasons((current) => ({ ...current, [recovery.id]: event.target.value }))} placeholder={recovery.requestedByUser.id === user?.id ? 'Another admin must review this case' : 'Record the independent verification and decision'} /></div><div className="inline-actions"><Button disabled={saving || recovery.requestedByUser.id === user?.id} onClick={() => void review(recovery.id, 'approve')}>Approve and Execute</Button><Button variant="danger" disabled={saving} onClick={() => void review(recovery.id, 'reject')}>Reject</Button></div></div> : null}
            </Card>
          ))}
          {!cases.length ? <div className="empty-state muted">No recovery cases have been recorded.</div> : null}
        </Card>
      </div>
    </ProtectedFrame>
  );
}
