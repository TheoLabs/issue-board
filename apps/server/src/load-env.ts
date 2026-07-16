// 서버 설정을 .env(단일 출처)에서 읽어 process.env로 로드한다.
// 반드시 main.ts 최상단에서 **가장 먼저** import 되어야 한다 —
// AppModule(및 그 안에서 모듈 로드 시점에 process.env를 읽는 코드,
// 예: daily-summary.service의 CLAUDE_CLI_TIMEOUT_MS)보다 앞서 실행돼야
// .env 값이 반영된다. 파일이 없으면(배포 환경 등) 무시하고 실제 환경변수를 쓴다.
try {
  process.loadEnvFile();
} catch {
  // .env 없음 — 프로세스에 이미 설정된 환경변수만 사용
}
