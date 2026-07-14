# Issue Board — Claude Code 연동 자산

이슈보드의 산출물을 **Claude Code로 생성/갱신**하기 위한 슬래시 커맨드와 규칙.
원본은 여기서 버전관리하고, 사용 시 유저 스코프로 복사한다.

## 구성

| 파일 | 성격 | 용도 |
|------|------|------|
| `commands/ib-generate.md` | **오케스트레이터** | 기획→와이어프레임→도메인→이슈를 한 번에 순차 생성 (단계 사이 체크포인트) |
| `commands/ib-plan.md` | 생성 1단계 | 아이디어 → 기획서 적재 (모호할 때만 명확화 질문) |
| `commands/ib-wireframe.md` | 생성 2단계 | 기획 → 클릭스루 프로토타입 적재 |
| `commands/ib-domain.md` | 생성 3단계 | 도메인/컬럼 → 표로 정리해 적재 (첫 설계는 초안) |
| `commands/ib-issues.md` | 생성 4단계 | 기획 → 이슈 트리 적재 (제목 `[영역]`, 완료 조건 `- [ ]` 체크박스, 기획/화면/도메인 연동) |
| `commands/ib-design.md` | 별도 | 메인 색 → 디자인 토큰 시스템 생성 (오케스트레이션과 별개) |
| `commands/ib-progress.md` | 유지보수 | 실제 진행도에 맞춰 이슈 완료 조건 체크박스·상태 재조정 |
| `commands/ib-daily.md` | 회고 | 오늘의 활동을 일일 업무 요약으로 정리해 구글 드라이브에 업로드 |
| `CLAUDE.snippet.md` | 진행 규칙 | 대상 프로젝트 CLAUDE.md에 붙여 상시 연동 |

`/ib-generate`로 한 번에 돌리거나, 단계를 나눠 개별 커맨드로 돌릴 수 있다 (둘은 같은
규칙을 공유한다).

생성 단계 커맨드는 **보드를 공유 상태로 읽어** 이어진다: `/ib-wireframe`·`/ib-domain`·
`/ib-issues`는 직전 단계가 적재한 기획을 `get_project_context`로 읽는다. 그래서 다른
세션에서 이어받아도 동작한다.

## 설치 (유저 스코프)

```bash
# 어느 프로젝트에서든 /ib-plan 등을 쓸 수 있게 유저 스코프로 복사
mkdir -p ~/.claude/commands
cp agent/commands/ib-*.md ~/.claude/commands/
```

> 원본을 계속 따라가려면 복사 대신 심링크:
> `ln -sf "$(pwd)/agent/commands/"ib-*.md ~/.claude/commands/`

## 사용 흐름

대상 프로젝트 루트에 `.mcp.json`을 두고 (issue-board 서버가 떠 있어야 함):

```json
{ "mcpServers": { "issue-board": { "type": "http", "url": "http://localhost:4000/mcp" } } }
```

그 디렉토리에서 — 한 번에:

```
/ib-generate 팀 협업용 칸반 앱을 만들고 싶어
   → 기획 → [확인] → 와이어프레임 → [확인] → 이슈
```

또는 단계를 나눠서 (각 단계를 대시보드에서 충분히 검토하고 싶을 때):

```
/ib-plan 팀 협업용 칸반 앱을 만들고 싶어
      ↓ (대시보드에서 기획 검토·수정)
/ib-wireframe
      ↓
/ib-issues
```

이후 실제 개발 세션에서는 `CLAUDE.snippet.md`를 대상 프로젝트 CLAUDE.md에 넣어두면
`get_project_context`로 맥락을 읽고 `update_issue_status`로 진행을 갱신한다.
