-- CreateTable
CREATE TABLE "PlanVersion" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "planId" TEXT NOT NULL,
    "version" INTEGER NOT NULL,
    "title" TEXT NOT NULL,
    "content" TEXT NOT NULL,
    "status" TEXT NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "PlanVersion_planId_fkey" FOREIGN KEY ("planId") REFERENCES "Plan" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateIndex
CREATE INDEX "PlanVersion_planId_idx" ON "PlanVersion"("planId");

-- CreateIndex
CREATE UNIQUE INDEX "PlanVersion_planId_version_key" ON "PlanVersion"("planId", "version");
