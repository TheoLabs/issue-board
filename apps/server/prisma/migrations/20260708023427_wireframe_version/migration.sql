-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_Wireframe" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "projectId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "format" TEXT NOT NULL DEFAULT 'html',
    "content" TEXT NOT NULL,
    "version" INTEGER NOT NULL DEFAULT 1,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "Wireframe_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);
INSERT INTO "new_Wireframe" ("content", "createdAt", "format", "id", "name", "projectId") SELECT "content", "createdAt", "format", "id", "name", "projectId" FROM "Wireframe";
DROP TABLE "Wireframe";
ALTER TABLE "new_Wireframe" RENAME TO "Wireframe";
CREATE INDEX "Wireframe_projectId_idx" ON "Wireframe"("projectId");
CREATE INDEX "Wireframe_projectId_name_idx" ON "Wireframe"("projectId", "name");
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;
