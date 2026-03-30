'use client';

import { useCallback, useEffect, useState } from 'react';

import { ProtectedFrame } from '../../src/components/protected-frame';
import { Badge, Button, Card } from '../../src/components/ui';
import { getErrorMessage } from '../../src/lib/api';
import { useAuthedApi } from '../../src/lib/auth-context';
import type { AddressRequestRecord } from '../../src/lib/types';

export default function AddressRequestsPage() {
  const api = useAuthedApi();
  const [requests, setRequests] = useState<AddressRequestRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      setRequests(await api.listAddressRequestsForReview({ take: 50 }));
    } catch (value) {
      setError(getErrorMessage(value));
    } finally {
      setLoading(false);
    }
  }, [api]);

  useEffect(() => {
    void load();
  }, [load]);

  async function approve(request: AddressRequestRecord) {
    const reason = window.prompt('Optional approval note:', 'Validated by reviewer') ?? undefined;
    try {
      await api.approveAddressRequest(request.id, reason);
      setMessage('Address request approved.');
      await load();
    } catch (value) {
      setError(getErrorMessage(value));
    }
  }

  async function reject(request: AddressRequestRecord) {
    const reason = window.prompt('Rejection reason:', request.reviewReason ?? 'Duplicate or invalid address');
    if (!reason) {
      return;
    }
    try {
      await api.rejectAddressRequest(request.id, reason);
      setMessage('Address request rejected.');
      await load();
    } catch (value) {
      setError(getErrorMessage(value));
    }
  }

  return (
    <ProtectedFrame title="Address Requests" eyebrow="Field Review">
      <div className="stack">
        {message ? <div className="notice notice-success">{message}</div> : null}
        {error ? <div className="notice notice-error">{error}</div> : null}

        <Card className="stack">
          <div className="inline-actions inline-actions-between">
            <div>
              <p className="section-kicker">Review Queue</p>
              <h2 className="heading-reset">Requested missing addresses</h2>
            </div>
            <Button variant="ghost" onClick={() => void load()} disabled={loading}>
              {loading ? 'Refreshing...' : 'Refresh'}
            </Button>
          </div>

          <div className="stack">
            {requests.map((request) => (
              <Card key={request.id} className="stack card-subtle">
                <div className="inline-actions inline-actions-between">
                  <div>
                    <strong>{request.requestedAddress.addressLine1}</strong>
                    <div className="muted">
                      {request.requestedAddress.city}, {request.requestedAddress.state}
                      {request.requestedAddress.zip ? ` ${request.requestedAddress.zip}` : ''}
                    </div>
                  </div>
                  <Badge tone={request.status === 'approved' ? 'success' : request.status === 'rejected' ? 'warning' : 'gold'}>
                    {request.status}
                  </Badge>
                </div>
                <div className="muted">
                  Turf: {request.turf.name} • Requested by {request.requestedBy.firstName} {request.requestedBy.lastName}
                </div>
                {request.notes ? <div className="muted">{request.notes}</div> : null}
                {request.status === 'pending' ? (
                  <div className="inline-actions">
                    <Button onClick={() => void approve(request)}>Approve</Button>
                    <Button variant="danger" onClick={() => void reject(request)}>Reject</Button>
                  </div>
                ) : (
                  <div className="muted">
                    {request.reviewedBy ? `Reviewed by ${request.reviewedBy.firstName} ${request.reviewedBy.lastName}` : 'Review completed'}
                    {request.reviewReason ? ` • ${request.reviewReason}` : ''}
                  </div>
                )}
              </Card>
            ))}
            {!requests.length ? <div className="empty-state muted">No address requests are waiting for review.</div> : null}
          </div>
        </Card>
      </div>
    </ProtectedFrame>
  );
}
