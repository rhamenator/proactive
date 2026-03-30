'use client';

import { useCallback, useEffect, useState } from 'react';

import { ProtectedFrame } from '../../src/components/protected-frame';
import { Badge, Button, Card } from '../../src/components/ui';
import { getErrorMessage } from '../../src/lib/api';
import { useAuthedApi } from '../../src/lib/auth-context';
import type { ImportDuplicateReviewRecord } from '../../src/lib/types';

export default function ImportReviewsPage() {
  const api = useAuthedApi();
  const [reviews, setReviews] = useState<ImportDuplicateReviewRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      setReviews(await api.listImportReviewQueue({ take: 50 }));
    } catch (value) {
      setError(getErrorMessage(value));
    } finally {
      setLoading(false);
    }
  }, [api]);

  useEffect(() => {
    void load();
  }, [load]);

  async function resolve(review: ImportDuplicateReviewRecord, action: 'merge' | 'skip') {
    const promptText =
      action === 'merge'
        ? 'Optional merge note:'
        : 'Optional skip reason:';
    const defaultReason =
      action === 'merge'
        ? 'Reviewed and merged duplicate import row'
        : 'Reviewed and skipped duplicate import row';
    const reason = window.prompt(promptText, defaultReason) ?? undefined;

    try {
      await api.resolveImportReview(review.id, action, reason);
      setMessage(action === 'merge' ? 'Import row merged into existing address.' : 'Import row skipped.');
      await load();
    } catch (value) {
      setError(getErrorMessage(value));
    }
  }

  return (
    <ProtectedFrame title="Import Reviews" eyebrow="CSV Review Queue">
      <div className="stack">
        {message ? <div className="notice notice-success">{message}</div> : null}
        {error ? <div className="notice notice-error">{error}</div> : null}

        <Card className="stack">
          <div className="inline-actions inline-actions-between">
            <div>
              <p className="section-kicker">Pending Reviews</p>
              <h2 className="heading-reset">Duplicate rows that need reviewer action</h2>
            </div>
            <Button variant="ghost" onClick={() => void load()} disabled={loading}>
              {loading ? 'Refreshing...' : 'Refresh'}
            </Button>
          </div>

          <div className="stack">
            {reviews.map((review) => (
              <Card key={review.id} className="stack card-subtle">
                <div className="inline-actions inline-actions-between">
                  <div className="stack-tight">
                    <strong>{review.turfName || review.candidateAddress?.turf?.name || 'Imported Turf'}</strong>
                    <div className="muted">
                      Batch {review.importBatch.filename} • Row {review.rowIndex}
                    </div>
                  </div>
                  <Badge tone="gold">{review.status}</Badge>
                </div>

                <div className="stack-tight">
                  <div>
                    <strong>Imported row</strong>
                    <div className="muted">
                      {Object.entries(review.rawRow).map(([key, value]) => `${key}: ${String(value ?? '')}`).join(' • ')}
                    </div>
                  </div>
                  {review.candidateAddress ? (
                    <div>
                      <strong>Existing address candidate</strong>
                      <div className="muted">
                        {review.candidateAddress.addressLine1}, {review.candidateAddress.city}, {review.candidateAddress.state}
                        {review.candidateAddress.zip ? ` ${review.candidateAddress.zip}` : ''}
                        {review.candidateAddress.vanId ? ` • VAN ${review.candidateAddress.vanId}` : ''}
                      </div>
                    </div>
                  ) : null}
                </div>

                <div className="inline-actions">
                  <Button onClick={() => void resolve(review, 'merge')}>Merge Into Existing Address</Button>
                  <Button variant="danger" onClick={() => void resolve(review, 'skip')}>Skip Row</Button>
                </div>
              </Card>
            ))}

            {!reviews.length ? <div className="empty-state muted">No duplicate import rows are waiting for review.</div> : null}
          </div>
        </Card>
      </div>
    </ProtectedFrame>
  );
}
