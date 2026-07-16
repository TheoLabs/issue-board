-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_Application" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "projectId" TEXT NOT NULL,
    "key" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "sequence" INTEGER NOT NULL DEFAULT 0,
    "issuePrefix" TEXT,
    "issueSeq" INTEGER NOT NULL DEFAULT 0,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "Application_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);
INSERT INTO "new_Application" ("createdAt", "description", "id", "key", "name", "projectId", "sequence", "updatedAt") SELECT "createdAt", "description", "id", "key", "name", "projectId", "sequence", "updatedAt" FROM "Application";
DROP TABLE "Application";
ALTER TABLE "new_Application" RENAME TO "Application";
CREATE INDEX "Application_projectId_idx" ON "Application"("projectId");
CREATE UNIQUE INDEX "Application_projectId_key_key" ON "Application"("projectId", "key");
CREATE UNIQUE INDEX "Application_projectId_issuePrefix_key" ON "Application"("projectId", "issuePrefix");
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;
