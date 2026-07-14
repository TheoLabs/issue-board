-- CreateTable
CREATE TABLE "DailySummary" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "projectId" TEXT NOT NULL,
    "date" TEXT NOT NULL,
    "timezone" TEXT NOT NULL DEFAULT 'Asia/Seoul',
    "content" TEXT NOT NULL DEFAULT '',
    "model" TEXT,
    "status" TEXT NOT NULL DEFAULT 'ready',
    "error" TEXT,
    "activityCount" INTEGER NOT NULL DEFAULT 0,
    "createdBy" TEXT NOT NULL DEFAULT 'manual',
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "DailySummary_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateIndex
CREATE INDEX "DailySummary_projectId_idx" ON "DailySummary"("projectId");

-- CreateIndex
CREATE UNIQUE INDEX "DailySummary_projectId_date_key" ON "DailySummary"("projectId", "date");
