// 일회성 백필: 추노 프로젝트의 기존 기획·와이어프레임·이슈를 두 앱으로 분류한다.
//   추노앱   ← 1·2차 MVP 기획, 와이어프레임 seq 0~10, 그 기획의 이슈
//   백오피스 ← 백오피스 1차 기획, 와이어프레임 seq 11~19, 그 기획의 이슈
// 도메인은 앱 공유이므로 건드리지 않는다. upsert/updateMany라 재실행해도 안전.
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

const project = await prisma.project.findFirst({ where: { name: '추노' } });
if (!project) {
  console.error('프로젝트 "추노"를 찾지 못했습니다.');
  process.exit(1);
}

const chuno = await prisma.application.upsert({
  where: { projectId_key: { projectId: project.id, key: 'chuno-app' } },
  update: { name: '추노앱', sequence: 0 },
  create: {
    projectId: project.id,
    key: 'chuno-app',
    name: '추노앱',
    description: 'GPS 실시간 러닝 경쟁 모바일 앱 (Flutter, Android/iOS)',
    sequence: 0,
  },
});
const bo = await prisma.application.upsert({
  where: { projectId_key: { projectId: project.id, key: 'backoffice' } },
  update: { name: '백오피스', sequence: 1 },
  create: {
    projectId: project.id,
    key: 'backoffice',
    name: '백오피스',
    description: '추노 앱 운영을 위한 사내 관리자용 백오피스',
    sequence: 1,
  },
});

// 기획
await prisma.plan.updateMany({
  where: { projectId: project.id, title: { in: ['1차 MVP 기획서', '2차 MVP 기획서'] } },
  data: { applicationId: chuno.id },
});
await prisma.plan.updateMany({
  where: { projectId: project.id, title: '백오피스 1차 기획서' },
  data: { applicationId: bo.id },
});

// 와이어프레임 (IA 순서 경계: 0~10 추노앱 / 11~ 백오피스)
await prisma.wireframe.updateMany({
  where: { projectId: project.id, sequence: { lte: 10 } },
  data: { applicationId: chuno.id },
});
await prisma.wireframe.updateMany({
  where: { projectId: project.id, sequence: { gte: 11 } },
  data: { applicationId: bo.id },
});

// 이슈 (소속 기획을 따라감)
const chunoPlans = await prisma.plan.findMany({
  where: { applicationId: chuno.id },
  select: { id: true },
});
const boPlans = await prisma.plan.findMany({
  where: { applicationId: bo.id },
  select: { id: true },
});
await prisma.issue.updateMany({
  where: { planId: { in: chunoPlans.map((p) => p.id) } },
  data: { applicationId: chuno.id },
});
await prisma.issue.updateMany({
  where: { planId: { in: boPlans.map((p) => p.id) } },
  data: { applicationId: bo.id },
});

// 검증 리포트
for (const [label, app] of [['추노앱', chuno], ['백오피스', bo]]) {
  const [plans, wfs, issues] = await Promise.all([
    prisma.plan.count({ where: { applicationId: app.id } }),
    prisma.wireframe.count({ where: { applicationId: app.id } }),
    prisma.issue.count({ where: { applicationId: app.id } }),
  ]);
  console.log(`${label} (${app.key}): 기획 ${plans} · 와이어프레임 ${wfs} · 이슈 ${issues}`);
}
const unassigned = {
  plans: await prisma.plan.count({ where: { projectId: project.id, applicationId: null } }),
  wfs: await prisma.wireframe.count({ where: { projectId: project.id, applicationId: null } }),
  issues: await prisma.issue.count({ where: { projectId: project.id, applicationId: null } }),
};
console.log(`미분류: 기획 ${unassigned.plans} · 와이어프레임 ${unassigned.wfs} · 이슈 ${unassigned.issues}`);

await prisma.$disconnect();
