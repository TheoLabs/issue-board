-- 이슈 키 (CH-12): 앱별 순번(number) + 비정규화 키(key). 둘 다 nullable — 소프트 필수(서비스가 채움).
-- AlterTable
ALTER TABLE "Issue" ADD COLUMN "key" TEXT;
ALTER TABLE "Issue" ADD COLUMN "number" INTEGER;

-- CreateIndex
CREATE UNIQUE INDEX "Issue_applicationId_number_key" ON "Issue"("applicationId", "number");

-- CreateIndex
CREATE UNIQUE INDEX "Issue_projectId_key_key" ON "Issue"("projectId", "key");
