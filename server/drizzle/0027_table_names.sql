-- Tables get a unique, editable name.
--
-- Until now a table was identified only by `number`, which had NO uniqueness
-- constraint of any kind: nothing stopped two tables both being "5", and the
-- admin form defaulted a new table to `tables.length + 1`, so deleting any
-- table made the next one collide immediately.
--
-- The backfill is written to guarantee the unique index can actually be built
-- on existing data. Rows that already share a number inside a tenant would
-- otherwise produce duplicate names, so those get a numeric suffix rather than
-- failing the migration mid-deploy.
ALTER TABLE "tables" ADD COLUMN IF NOT EXISTS "name" text;
--> statement-breakpoint

UPDATE "tables" AS t
SET "name" = x.new_name
FROM (
  SELECT
    id,
    CASE
      WHEN cnt = 1 THEN 'Table ' || number
      ELSE 'Table ' || number || ' (' || rn || ')'
    END AS new_name
  FROM (
    SELECT
      id,
      number,
      row_number() OVER (PARTITION BY tenant_id, number ORDER BY id) AS rn,
      count(*)     OVER (PARTITION BY tenant_id, number)            AS cnt
    FROM "tables"
  ) ranked
) AS x
WHERE t.id = x.id AND t."name" IS NULL;
--> statement-breakpoint

ALTER TABLE "tables" ALTER COLUMN "name" SET NOT NULL;
--> statement-breakpoint

-- Scoped to the tenant, not global: two different venues may both have a
-- "Terrace 1" and that is correct.
CREATE UNIQUE INDEX IF NOT EXISTS "tables_tenant_name_unique" ON "tables" ("tenant_id", "name");

-- Deliberately NO unique index on (tenant_id, number).
--
-- The backfill above only guarantees unique NAMES; it does not renumber
-- anything. A tenant that already has two tables numbered 5 would make that
-- index fail, and a migration that dies partway through a deploy is worse than
-- the duplicate it was trying to prevent. Renumbering them automatically is
-- worse still — staff know their floor by those numbers.
--
-- Number collisions are rejected at the API instead (routes/tables.ts), where
-- the caller gets a message they can act on and existing data is left alone.
