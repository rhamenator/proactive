# Configurable geography hierarchy

## Purpose

PROACTIVE supports optional organization-specific geography trees without assuming that every client uses the same political or field structure. A tree may contain any supported combination of regions, wards, territories, precinct clusters, precincts, and custom levels. Organizations that do not need this feature can continue using campaigns, teams, and `regionCode` unchanged.

## Data contract

Each `GeographyNode` has a database UUID, an organization-scoped `externalId`, a `kind`, display name, optional parent, calculated depth, ordering, active state, and optional non-sensitive metadata. `externalId` is immutable after creation and is the stable identifier used by import mappings and external integrations. It must match `[A-Za-z0-9][A-Za-z0-9._:-]{0,99}`.

The `GeographyClosure` table stores every ancestor/descendant pair, including a depth-zero self-link. This supports bounded descendant filters without relying on names or a fixed number of levels. Parent changes rebuild the affected cross-tree links transactionally and reject cycles. Nodes are deactivated rather than deleted when historical references exist.

All nodes, parent lookups, user assignments, and filters are constrained to one organization. Nullable `geographyNodeId` references on users, turfs, and import batches preserve existing records and APIs. The migration does not infer nodes from legacy `regionCode` values; administrators may create matching region nodes deliberately and retain `regionCode` as a compatibility/reporting projection.

## Inheritance and access

- Assigning a supervisor to a node grants visibility to that node and all descendants, never its parent or sibling branches.
- A turf assigned to a leaf is included in reports for every ancestor of that leaf.
- Administrators remain restricted to their organization and may create, edit, move, deactivate, and assign nodes after fresh MFA.
- Supervisors may list and obtain reporting filters only inside their assigned branch.
- A supervisor without a geography assignment receives no geography-scoped results. Existing team/region authorization continues to apply to existing endpoints until a caller opts into geography filtering.
- Names, kinds, and parents may change; `externalId` does not. This keeps imports and saved workflows stable.

## API workflow

The authenticated endpoints are under `/admin/geographies`:

- `GET /admin/geographies` lists visible nodes; optional filters are `parentId`, `kind`, and `includeInactive`.
- `POST /admin/geographies` creates a node.
- `PATCH /admin/geographies/:id` changes display/configuration or moves a subtree. The `externalId` is intentionally not accepted.
- `PUT /admin/geographies/:id/users/:userId` assigns a user's primary scope and requires a reason.
- `GET /admin/geographies/:id/reporting-filter` returns descendant node IDs plus matching turf and user IDs for composing report filters.

Every mutation records an audit event with the actor and before/after values. Assignment changes also require a reason.

## Imports and reports

CSV mappings may map the canonical field `geographyExternalId`; recognized default headers include `geography_external_id`, `geography_id`, `geography_code`, and `scope_code`. A multipart import may instead provide `geographyExternalId` as a fallback for every row. A single turf cannot contain rows mapped to multiple geography IDs. Unknown or inactive IDs fail the import rather than silently dropping scope. Imported turfs and their import batch retain the resolved node.

Reporting callers select a node and use the reporting-filter endpoint. The response expands descendants and returns concrete IDs, so existing reporting APIs need no breaking parameter change. This also makes the applied authorization boundary explicit and testable.

## Example

```text
North Region (region:NORTH)
└── Ward 4 (ward:WARD-4)
    ├── East Cluster (precinct_cluster:W4-EAST)
    │   ├── Precinct 4-01 (precinct:PCT-4-01)
    │   └── Precinct 4-02 (precinct:PCT-4-02)
    └── Campus Territory (territory:W4-CAMPUS)
```

A supervisor assigned to `WARD-4` may report on both branches. One assigned to `W4-EAST` cannot see the campus territory or Ward 4 aggregate outside its descendants.
