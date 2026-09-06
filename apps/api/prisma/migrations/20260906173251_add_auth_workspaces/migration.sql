/*
  Warnings:

  - A unique constraint covering the columns `[workspaceId]` on the table `WorkspaceMember` will be added. If there are existing duplicate values, this will fail.

*/
-- CreateIndex
CREATE UNIQUE INDEX "WorkspaceMember_single_owner" ON "WorkspaceMember"("workspaceId") WHERE ("role" = 'OWNER');
