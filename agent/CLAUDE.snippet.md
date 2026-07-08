<!--
  대상 프로젝트의 CLAUDE.md에 아래 블록을 복사해 넣으면,
  그 프로젝트의 모든 Claude 세션이 이슈보드를 자동으로 활용한다. (진행용 상시 규칙)
-->

## Issue Board 연동

이 프로젝트의 기획·이슈는 issue-board(`http://localhost:4000/mcp`, MCP)로 관리된다.

- **작업 시작 전**: `get_project_context(repoPath=<이 저장소의 절대경로>)`로 기획서와
  이슈를 읽어 현재 맥락을 파악한다.
- **이슈 착수 시**: 해당 이슈를 `update_issue_status(issueId, "in_progress")`로 표시.
- **이슈 완료 시**: `update_issue_status(issueId, "done")`.
- **작업 중 새 할 일 발견 시**: `create_issue`로 등록해 보드에 남긴다.
- **기획에 결정/변경이 생기면**: `append_plan_note`로 기획서에 진행 메모를 덧붙인다.

MCP 툴이 보이지 않으면 이 저장소에 `.mcp.json`이 있는지, 서버가 떠 있는지 확인하라.
