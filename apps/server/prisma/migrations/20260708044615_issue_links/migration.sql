-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_Issue" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "projectId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "body" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'todo',
    "priority" TEXT NOT NULL DEFAULT 'medium',
    "labels" TEXT NOT NULL DEFAULT '[]',
    "parentId" TEXT,
    "planId" TEXT,
    "screenId" TEXT,
    "version" INTEGER NOT NULL DEFAULT 1,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "Issue_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "Issue_parentId_fkey" FOREIGN KEY ("parentId") REFERENCES "Issue" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "Issue_planId_fkey" FOREIGN KEY ("planId") REFERENCES "Plan" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);
INSERT INTO "new_Issue" ("body", "createdAt", "id", "labels", "parentId", "priority", "projectId", "status", "title", "updatedAt", "version") SELECT "body", "createdAt", "id", "labels", "parentId", "priority", "projectId", "status", "title", "updatedAt", "version" FROM "Issue";
DROP TABLE "Issue";
ALTER TABLE "new_Issue" RENAME TO "Issue";
CREATE INDEX "Issue_projectId_idx" ON "Issue"("projectId");
CREATE INDEX "Issue_parentId_idx" ON "Issue"("parentId");
CREATE INDEX "Issue_planId_idx" ON "Issue"("planId");
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;
