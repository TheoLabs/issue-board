// 기존 이슈에 앱 배정 + 이슈 키(CH-12)를 소급 부여한다.
// - applicationId가 없는 이슈는 프로젝트 기본 앱(가장 앞 순서, 없으면 생성)에 배정.
// - 각 앱에 issuePrefix가 없으면 이름에서 도출(프로젝트 내 유일).
// - 앱별로 createdAt 순으로 number(1..n)와 key를 부여하고 앱 카운터(issueSeq)를 맞춘다.
// upsert/guard 방식이라 재실행해도 안전(이미 번호가 있는 이슈는 건드리지 않는다).
import { PrismaClient } from '@prisma/client';

try {
  process.loadEnvFile(); // .env의 DATABASE_URL 로드 (없으면 실제 env 사용)
} catch {
  // .env 없음 — 무시
}

const prisma = new PrismaClient();

/** apps/server/src/common/issue-key.ts의 derivePrefix와 동일 규칙. */
function derivePrefix(name, taken = new Set()) {
  const letters = (String(name ?? '').match(/[A-Za-z]+/g) ?? []).join('');
  let base = letters.slice(0, 4).toUpperCase();
  if (base.length < 2) base = 'APP';
  let candidate = base;
  let n = 2;
  while (taken.has(candidate)) candidate = `${base}${n++}`;
  return candidate;
}

let assigned = 0;
const projects = await prisma.project.findMany();

for (const project of projects) {
  // 1) 앱 확보
  let apps = await prisma.application.findMany({
    where: { projectId: project.id },
    orderBy: [{ sequence: 'asc' }, { createdAt: 'asc' }],
  });
  if (apps.length === 0) {
    const app = await prisma.application.create({
      data: {
        projectId: project.id,
        key: 'default',
        name: project.name,
        sequence: 0,
        issuePrefix: derivePrefix(project.name),
      },
    });
    apps = [app];
    console.log(`  [${project.name}] 기본 앱 생성 (prefix=${app.issuePrefix})`);
  }
  const defaultApp = apps[0];

  // 2) 미분류 이슈 → 기본 앱
  const orphaned = await prisma.issue.updateMany({
    where: { projectId: project.id, applicationId: null },
    data: { applicationId: defaultApp.id },
  });
  if (orphaned.count > 0)
    console.log(`  [${project.name}] 미분류 이슈 ${orphaned.count}건 → 기본 앱(${defaultApp.name})`);

  // 3) 각 앱: 접두사 확보 + 번호/키 채번
  const taken = new Set(apps.map((a) => a.issuePrefix).filter(Boolean));
  for (const app of apps) {
    let prefix = app.issuePrefix;
    if (!prefix) {
      prefix = derivePrefix(app.name, taken);
      taken.add(prefix);
      await prisma.application.update({
        where: { id: app.id },
        data: { issuePrefix: prefix },
      });
      console.log(`  [${project.name}/${app.name}] 접두사 도출 → ${prefix}`);
    }

    const issues = await prisma.issue.findMany({
      where: { applicationId: app.id },
      orderBy: { createdAt: 'asc' },
    });
    let seq = 0;
    for (const issue of issues) {
      if (issue.number != null) {
        if (issue.number > seq) seq = issue.number;
        continue; // 이미 부여됨 — 재실행 안전
      }
      seq += 1;
      await prisma.issue.update({
        where: { id: issue.id },
        data: { number: seq, key: `${prefix}-${seq}` },
      });
      assigned += 1;
    }
    if (seq > app.issueSeq)
      await prisma.application.update({
        where: { id: app.id },
        data: { issueSeq: seq },
      });
    console.log(`  [${project.name}/${app.name}] ${prefix}-1..${seq} (${issues.length}건)`);
  }
}

console.log(`\n완료: 새로 키를 부여한 이슈 ${assigned}건`);
await prisma.$disconnect();
