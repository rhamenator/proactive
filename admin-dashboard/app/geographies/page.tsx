'use client';

import { FormEvent, useCallback, useEffect, useMemo, useState } from 'react';

import { ProtectedFrame } from '../../src/components/protected-frame';
import { Badge, Button, Card, Input } from '../../src/components/ui';
import { getErrorMessage } from '../../src/lib/api';
import { useAuth, useAuthedApi } from '../../src/lib/auth-context';
import type { FieldUserRecord, GeographyNodeKind, GeographyNodeRecord } from '../../src/lib/types';

const kinds: GeographyNodeKind[] = ['region', 'ward', 'territory', 'precinct_cluster', 'precinct', 'custom'];
type NodeForm = { name: string; kind: GeographyNodeKind; parentId: string; sortOrder: string; isActive: boolean; reason: string };

function editForm(node: GeographyNodeRecord): NodeForm {
  return {
    name: node.name,
    kind: node.kind,
    parentId: node.parentId ?? '',
    sortOrder: String(node.sortOrder),
    isActive: node.isActive,
    reason: ''
  };
}

function kindLabel(kind: GeographyNodeKind) {
  return kind.replaceAll('_', ' ').replace(/\b\w/g, (value) => value.toUpperCase());
}

export default function GeographiesPage() {
  const api = useAuthedApi();
  const { user, runSensitiveAction } = useAuth();
  const isAdmin = user?.role === 'admin';
  const [nodes, setNodes] = useState<GeographyNodeRecord[]>([]);
  const [users, setUsers] = useState<FieldUserRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [editForms, setEditForms] = useState<Record<string, NodeForm>>({});
  const [assignment, setAssignment] = useState<Record<string, { userId: string; reason: string }>>({});
  const [createForm, setCreateForm] = useState({
    externalId: '', name: '', kind: 'region' as GeographyNodeKind, parentId: '', sortOrder: '0', isActive: true
  });

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [nextNodes, nextUsers] = await Promise.all([
        api.listGeographies({ includeInactive: isAdmin }),
        isAdmin ? api.listCanvassers() : Promise.resolve([])
      ]);
      setNodes(nextNodes);
      setUsers(nextUsers);
      setEditForms(Object.fromEntries(nextNodes.map((node) => [node.id, editForm(node)])));
    } catch (value) {
      setError(getErrorMessage(value));
    } finally {
      setLoading(false);
    }
  }, [api, isAdmin]);

  useEffect(() => { void load(); }, [load]);

  const nodeById = useMemo(() => new Map(nodes.map((node) => [node.id, node])), [nodes]);
  const parentOptions = (excludedId?: string) => nodes.filter((node) => node.id !== excludedId && node.isActive);

  async function createNode(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSaving(true); setError(null); setMessage(null);
    try {
      await runSensitiveAction('create a geography node', (freshApi) => freshApi.createGeography({
        externalId: createForm.externalId.trim(),
        name: createForm.name.trim(),
        kind: createForm.kind,
        parentId: createForm.parentId || null,
        sortOrder: Number(createForm.sortOrder || 0),
        isActive: createForm.isActive
      }));
      setCreateForm({ externalId: '', name: '', kind: 'region', parentId: '', sortOrder: '0', isActive: true });
      setMessage('Geography node created. Its external ID is now stable.');
      await load();
    } catch (value) { setError(getErrorMessage(value)); } finally { setSaving(false); }
  }

  async function saveNode(nodeId: string) {
    const form = editForms[nodeId];
    if (!form) return;
    setSaving(true); setError(null); setMessage(null);
    try {
      await runSensitiveAction('update a geography node', (freshApi) => freshApi.updateGeography(nodeId, {
        name: form.name.trim(), kind: form.kind, parentId: form.parentId || null,
        sortOrder: Number(form.sortOrder || 0), isActive: form.isActive, reason: form.reason.trim() || undefined
      }));
      setMessage('Geography node updated and audited.');
      await load();
    } catch (value) { setError(getErrorMessage(value)); } finally { setSaving(false); }
  }

  async function assignUser(nodeId: string) {
    const value = assignment[nodeId];
    if (!value?.userId || !value.reason.trim()) {
      setError('Select a field user and enter an assignment reason.');
      return;
    }
    setSaving(true); setError(null); setMessage(null);
    try {
      await runSensitiveAction('assign a geography scope', (freshApi) =>
        freshApi.assignUserGeography(nodeId, value.userId, value.reason.trim())
      );
      setAssignment((current) => ({ ...current, [nodeId]: { userId: '', reason: '' } }));
      setMessage('User geography scope assigned and audited.');
      await load();
    } catch (value) { setError(getErrorMessage(value)); } finally { setSaving(false); }
  }

  return (
    <ProtectedFrame title="Geographies" eyebrow="Nested Scope Management">
      <div className="stack">
        {message ? <div className="notice notice-success">{message}</div> : null}
        {error ? <div className="notice notice-error">{error}</div> : null}

        <Card className="stack">
          <div>
            <p className="section-kicker">Hierarchy contract</p>
            <h2 className="heading-reset">Organization-specific field geography</h2>
          </div>
          <p className="muted">
            Build regions, wards, territories, precinct clusters, or custom levels. External IDs are permanent integration keys; names and parent relationships may be changed with an audit trail.
          </p>
        </Card>

        {isAdmin ? (
          <Card>
            <form className="stack" onSubmit={createNode}>
              <div><p className="section-kicker">Create</p><h2 className="heading-reset">Add a geography node</h2></div>
              <div className="grid two">
                <div className="field-group"><label htmlFor="geo-external-id">Stable external ID</label><Input id="geo-external-id" required placeholder="WARD-4" value={createForm.externalId} onChange={(event) => setCreateForm((current) => ({ ...current, externalId: event.target.value }))} /></div>
                <div className="field-group"><label htmlFor="geo-name">Display name</label><Input id="geo-name" required placeholder="Ward 4" value={createForm.name} onChange={(event) => setCreateForm((current) => ({ ...current, name: event.target.value }))} /></div>
              </div>
              <div className="grid two">
                <div className="field-group"><label htmlFor="geo-kind">Kind</label><select id="geo-kind" className="select" value={createForm.kind} onChange={(event) => setCreateForm((current) => ({ ...current, kind: event.target.value as GeographyNodeKind }))}>{kinds.map((kind) => <option key={kind} value={kind}>{kindLabel(kind)}</option>)}</select></div>
                <div className="field-group"><label htmlFor="geo-parent">Parent</label><select id="geo-parent" className="select" value={createForm.parentId} onChange={(event) => setCreateForm((current) => ({ ...current, parentId: event.target.value }))}><option value="">Root level</option>{parentOptions().map((node) => <option key={node.id} value={node.id}>{'—'.repeat(node.depth)} {node.name} ({node.externalId})</option>)}</select></div>
              </div>
              <div className="inline-actions inline-actions-between"><Button type="button" variant={createForm.isActive ? 'secondary' : 'ghost'} onClick={() => setCreateForm((current) => ({ ...current, isActive: !current.isActive }))}>{createForm.isActive ? 'Active' : 'Inactive'}</Button><Button type="submit" disabled={saving}>{saving ? 'Saving...' : 'Create Node'}</Button></div>
            </form>
          </Card>
        ) : null}

        <Card className="stack">
          <div className="inline-actions inline-actions-between"><div><p className="section-kicker">Tree</p><h2 className="heading-reset">Visible geography scopes</h2></div><Button variant="ghost" onClick={() => void load()} disabled={loading}>{loading ? 'Loading...' : 'Refresh'}</Button></div>
          {nodes.map((node) => {
            const form = editForms[node.id] ?? editForm(node);
            const assign = assignment[node.id] ?? { userId: '', reason: '' };
            return (
              <Card key={node.id} className="stack card-subtle">
                <div className="inline-actions inline-actions-between">
                  <div className="stack-tight" style={{ paddingLeft: `${Math.min(node.depth, 8) * 18}px` }}><strong>{node.name}</strong><span className="muted">{node.externalId} · {kindLabel(node.kind)}{node.parentId ? ` · under ${nodeById.get(node.parentId)?.name ?? node.parentId}` : ' · root'}</span></div>
                  <Badge tone={node.isActive ? 'success' : 'warning'}>{node.isActive ? 'Active' : 'Inactive'}</Badge>
                </div>
                <div className="muted">{node._count?.children ?? 0} children · {node._count?.users ?? 0} assigned users · {node._count?.turfs ?? 0} turfs</div>
                {isAdmin ? <div className="stack">
                  <div className="grid two"><div className="field-group"><label htmlFor={`geo-name-${node.id}`}>Name</label><Input id={`geo-name-${node.id}`} value={form.name} onChange={(event) => setEditForms((current) => ({ ...current, [node.id]: { ...form, name: event.target.value } }))} /></div><div className="field-group"><label htmlFor={`geo-kind-${node.id}`}>Kind</label><select id={`geo-kind-${node.id}`} className="select" value={form.kind} onChange={(event) => setEditForms((current) => ({ ...current, [node.id]: { ...form, kind: event.target.value as GeographyNodeKind } }))}>{kinds.map((kind) => <option key={kind} value={kind}>{kindLabel(kind)}</option>)}</select></div></div>
                  <div className="grid two"><div className="field-group"><label htmlFor={`geo-parent-${node.id}`}>Parent</label><select id={`geo-parent-${node.id}`} className="select" value={form.parentId} onChange={(event) => setEditForms((current) => ({ ...current, [node.id]: { ...form, parentId: event.target.value } }))}><option value="">Root level</option>{parentOptions(node.id).map((candidate) => <option key={candidate.id} value={candidate.id}>{candidate.name} ({candidate.externalId})</option>)}</select></div><div className="field-group"><label htmlFor={`geo-reason-${node.id}`}>Change reason</label><Input id={`geo-reason-${node.id}`} placeholder="Required by local policy when applicable" value={form.reason} onChange={(event) => setEditForms((current) => ({ ...current, [node.id]: { ...form, reason: event.target.value } }))} /></div></div>
                  <div className="inline-actions inline-actions-between"><Button type="button" variant={form.isActive ? 'secondary' : 'ghost'} onClick={() => setEditForms((current) => ({ ...current, [node.id]: { ...form, isActive: !form.isActive } }))}>{form.isActive ? 'Active' : 'Inactive'}</Button><Button type="button" variant="secondary" disabled={saving} onClick={() => void saveNode(node.id)}>Save Node</Button></div>
                  <div className="grid two"><div className="field-group"><label htmlFor={`geo-user-${node.id}`}>Assign field user</label><select id={`geo-user-${node.id}`} className="select" value={assign.userId} onChange={(event) => setAssignment((current) => ({ ...current, [node.id]: { ...assign, userId: event.target.value } }))}><option value="">Select a user</option>{users.map((fieldUser) => <option key={fieldUser.id} value={fieldUser.id}>{fieldUser.firstName} {fieldUser.lastName} ({fieldUser.role})</option>)}</select></div><div className="field-group"><label htmlFor={`geo-assignment-reason-${node.id}`}>Assignment reason</label><Input id={`geo-assignment-reason-${node.id}`} value={assign.reason} onChange={(event) => setAssignment((current) => ({ ...current, [node.id]: { ...assign, reason: event.target.value } }))} /></div></div>
                  <div className="inline-actions"><Button type="button" variant="secondary" disabled={saving || !assign.userId || !assign.reason.trim()} onClick={() => void assignUser(node.id)}>Assign Scope</Button></div>
                </div> : null}
              </Card>
            );
          })}
          {!nodes.length ? <div className="empty-state muted">No geography nodes are configured or visible.</div> : null}
        </Card>
      </div>
    </ProtectedFrame>
  );
}
