-- AlterTable
ALTER TABLE "Workspace" ADD COLUMN     "nameKey" TEXT,
ADD COLUMN     "ownerId" UUID;

-- AddForeignKey
ALTER TABLE "Workspace" ADD CONSTRAINT "Workspace_ownerId_fkey" FOREIGN KEY ("ownerId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- Backfill the owner from the single OWNER membership.
UPDATE "Workspace" AS w
SET "ownerId" = m."userId"
FROM "WorkspaceMember" AS m
WHERE m."workspaceId" = w."id" AND m."role" = 'OWNER';

-- Backfill the name key for the oldest workspace of each (owner, name) group only. The newer rows of a legacy
-- duplicate keep a NULL key, so the unique index below can be created without renaming or deleting anyone's data.
-- The key mirrors workspaceNameKey() in the API (trim, lower case; NFKC is applied by the API for new writes).
UPDATE "Workspace" AS w
SET "nameKey" = lower(btrim(w."name"))
FROM (
    SELECT "id",
           row_number() OVER (
               PARTITION BY "ownerId", lower(btrim("name"))
               ORDER BY "createdAt" ASC, "id" ASC
           ) AS position
    FROM "Workspace"
    WHERE "ownerId" IS NOT NULL
) AS ranked
WHERE w."id" = ranked."id" AND ranked.position = 1;

-- CreateIndex
CREATE UNIQUE INDEX "Workspace_ownerId_nameKey_key" ON "Workspace"("ownerId", "nameKey");
