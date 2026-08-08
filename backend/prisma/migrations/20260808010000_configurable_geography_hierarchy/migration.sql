CREATE TYPE "GeographyNodeKind" AS ENUM ('region', 'ward', 'territory', 'precinct_cluster', 'precinct', 'custom');

CREATE TABLE "geography_nodes" (
    "id" UUID NOT NULL,
    "organization_id" UUID NOT NULL,
    "external_id" TEXT NOT NULL,
    "kind" "GeographyNodeKind" NOT NULL,
    "name" TEXT NOT NULL,
    "parent_id" UUID,
    "depth" INTEGER NOT NULL DEFAULT 0,
    "sort_order" INTEGER NOT NULL DEFAULT 0,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "metadata_json" JSONB,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "geography_nodes_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "geography_closure" (
    "ancestor_id" UUID NOT NULL,
    "descendant_id" UUID NOT NULL,
    "depth" INTEGER NOT NULL,
    CONSTRAINT "geography_closure_pkey" PRIMARY KEY ("ancestor_id", "descendant_id"),
    CONSTRAINT "geography_closure_nonnegative_depth" CHECK ("depth" >= 0)
);

ALTER TABLE "users" ADD COLUMN "geography_node_id" UUID;
ALTER TABLE "turfs" ADD COLUMN "geography_node_id" UUID;
ALTER TABLE "import_batches" ADD COLUMN "geography_node_id" UUID;

CREATE UNIQUE INDEX "geography_nodes_organization_id_external_id_key" ON "geography_nodes"("organization_id", "external_id");
CREATE INDEX "geography_nodes_organization_id_parent_id_idx" ON "geography_nodes"("organization_id", "parent_id");
CREATE INDEX "geography_nodes_organization_id_kind_idx" ON "geography_nodes"("organization_id", "kind");
CREATE INDEX "geography_closure_descendant_id_depth_idx" ON "geography_closure"("descendant_id", "depth");
CREATE INDEX "users_geography_node_id_idx" ON "users"("geography_node_id");
CREATE INDEX "turfs_geography_node_id_idx" ON "turfs"("geography_node_id");
CREATE INDEX "import_batches_geography_node_id_idx" ON "import_batches"("geography_node_id");

ALTER TABLE "geography_nodes" ADD CONSTRAINT "geography_nodes_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "geography_nodes" ADD CONSTRAINT "geography_nodes_parent_id_fkey" FOREIGN KEY ("parent_id") REFERENCES "geography_nodes"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "geography_closure" ADD CONSTRAINT "geography_closure_ancestor_id_fkey" FOREIGN KEY ("ancestor_id") REFERENCES "geography_nodes"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "geography_closure" ADD CONSTRAINT "geography_closure_descendant_id_fkey" FOREIGN KEY ("descendant_id") REFERENCES "geography_nodes"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "users" ADD CONSTRAINT "users_geography_node_id_fkey" FOREIGN KEY ("geography_node_id") REFERENCES "geography_nodes"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "turfs" ADD CONSTRAINT "turfs_geography_node_id_fkey" FOREIGN KEY ("geography_node_id") REFERENCES "geography_nodes"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "import_batches" ADD CONSTRAINT "import_batches_geography_node_id_fkey" FOREIGN KEY ("geography_node_id") REFERENCES "geography_nodes"("id") ON DELETE SET NULL ON UPDATE CASCADE;
