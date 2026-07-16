---
name: ib-shared
description: 이슈보드 생성 스킬군이 공유하는 규약·템플릿의 단일 원본. 다른 ib-* 스킬이 상대링크로 인용한다.
disable-model-invocation: true
user-invocable: false
---

# ib-shared — 이슈보드 공유 스펙 (단일 원본)

`ib-plan` · `ib-wireframe` · `ib-domain` · `ib-issues` · `ib-generate` 등 생성 스킬이
**공통으로 따르는 규약과 템플릿**을 여기 한곳에 둔다. 각 스킬의 `SKILL.md`는 필요한
파일만 상대링크로 인용하고(점진적 로드), 스펙을 자기 안에 복붙하지 않는다.

> **규약/템플릿을 바꾸려면 이 폴더의 해당 파일만 고친다.** 모든 ib-* 스킬이 자동으로 따라온다.

## 파일 (필요할 때만 읽어라)

- [conventions.md](conventions.md) — 모든 생성 스킬 공통: MCP 전제 · cwd 규칙 · draft/upsert ·
  완료조건 체크박스 · "코드 구현 금지". **어떤 ib-* 스킬이든 적재 전에 읽는다.**
- [application-model.md](application-model.md) — 애플리케이션(전달 표면) 모델과 **이슈 키
  (`CH-12`) 규칙**. plan · wireframe · issue를 적재하기 전에 읽는다.
- [plan-spec.md](plan-spec.md) — 기획서 8섹션 마크다운 템플릿. `ib-plan` · `ib-generate` 1단계.
- [issue-spec.md](issue-spec.md) — 이슈 정규화 규격(제목 · 본문 · value/effort · 연동).
  `ib-issues` · `ib-generate` 4단계 · `ib-progress`.
- [wireframe-style.md](wireframe-style.md) — 와이어프레임 공통 스타일 CSS · 구조 컨벤션.
  `ib-wireframe` · `ib-generate` 2단계.
- [daily-report.md](daily-report.md) — 일일 업무 보고서 출력 포맷 계약. `ib-daily`와 앱 내부
  'AI 요약하기' / cron이 공유.
