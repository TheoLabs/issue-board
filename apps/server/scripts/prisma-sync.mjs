// schema.prisma가 바뀌면 자동으로 `prisma migrate dev`를 실행해 DB/Client를 동기화한다.
// 로컬 개발 전용 — 서버 dev 프로세스와 함께 병렬로 돈다(package.json의 dev 스크립트).
import { spawn } from 'node:child_process';
import { createHash } from 'node:crypto';
import { readFileSync, watch } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';

const here = dirname(fileURLToPath(import.meta.url));
const schemaPath = resolve(here, '../prisma/schema.prisma');

const DEBOUNCE_MS = 400;
let lastHash = hashSchema();
let timer = null;
let running = false;
let pending = false;

function hashSchema() {
  try {
    return createHash('sha1').update(readFileSync(schemaPath)).digest('hex');
  } catch {
    return '';
  }
}

function log(msg) {
  console.log(`[prisma-sync] ${msg}`);
}

function runMigrate() {
  if (running) {
    pending = true;
    return;
  }
  running = true;
  // migrate dev는 변경이 없으면 마이그레이션을 만들지 않고, 있으면 새 파일을 생성한다.
  // 완전 무인 자동화를 위해 타임스탬프 기반 이름을 부여한다.
  const name = `auto_${new Date().toISOString().replace(/[-:.TZ]/g, '').slice(0, 14)}`;
  log(`schema 변경 감지 → prisma migrate dev --name ${name}`);
  const child = spawn(
    'npx',
    ['prisma', 'migrate', 'dev', '--name', name, '--skip-seed'],
    { cwd: resolve(here, '..'), stdio: 'inherit', shell: process.platform === 'win32' },
  );
  child.on('exit', (code) => {
    running = false;
    log(code === 0 ? 'sync 완료 ✅' : `sync 실패 (exit ${code}) — 수동 확인 필요`);
    if (pending) {
      pending = false;
      runMigrate();
    }
  });
}

log(`watching ${schemaPath}`);
watch(schemaPath, () => {
  const next = hashSchema();
  if (next === lastHash) return; // 내용 동일한 저장 이벤트 무시
  lastHash = next;
  clearTimeout(timer);
  timer = setTimeout(runMigrate, DEBOUNCE_MS);
});
