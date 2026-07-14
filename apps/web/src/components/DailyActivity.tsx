import { useState } from 'react';
import type {
  Issue,
  Activity,
  ActivityEntity,
  ActivityAction,
  DailySummary,
} from '@issue-board/shared';
import {
  uploadDailyReport,
  isDriveConfigured,
  type DriveUploadResult,
} from '../api/drive';
import { renderDailyReport, dailyReportFileName } from '../api/dailyReport';

/**
 * 하루치 활동 요약을 표시하는 공용 조각들.
 * - DailyActivityGroups: 엔티티별로 묶은 활동 목록
 * - DriveUpload: 그 요약을 구글 드라이브에 올리는 버튼
 * 대시보드(개요)의 "오늘의 작업" 카드와 "일일 업무" 탭이 함께 쓴다.
 */

// 엔티티/액션 한글 라벨 및 표시 순서
export const ENTITY_META: { key: ActivityEntity; label: string; icon: string }[] =
  [
    { key: 'plan', label: '기획', icon: '🗂' },
    { key: 'domain', label: '도메인', icon: '🧩' },
    { key: 'issue', label: '이슈', icon: '✅' },
    { key: 'wireframe', label: '와이어프레임', icon: '🖼' },
    { key: 'design', label: '디자인', icon: '🎨' },
    { key: 'project', label: '프로젝트', icon: '📁' },
  ];

export const ACTION_LABEL: Record<ActivityAction, string> = {
  created: '신규',
  updated: '수정',
  status_changed: '상태변경',
  snapshot: '스냅샷',
  linked: '연동',
  deleted: '삭제',
};

function activityDetail(a: Activity): string {
  const st = a.changes?.status;
  if (a.action === 'status_changed' && st) return `${st.from} → ${st.to}`;
  const label = a.changes?.label;
  if (a.action === 'snapshot' && label?.to) return label.to;
  return '';
}

/** 하루치 활동을 엔티티별로 묶어 보여준다. 이슈는 클릭 시 상세로 이동. */
export function DailyActivityGroups({
  summary,
  issues,
  onSelectIssue,
  emptyText = '기록된 변경이 없습니다.',
}: {
  summary: DailySummary;
  issues: Issue[];
  onSelectIssue: (issue: Issue) => void;
  emptyText?: string;
}) {
  if (summary.total === 0) {
    return <p className="ov-daily-empty">{emptyText}</p>;
  }

  const grouped = ENTITY_META.map((meta) => ({
    meta,
    items: summary.activities.filter((a) => a.entityType === meta.key),
  })).filter((g) => g.items.length > 0);

  return (
    <div className="ov-daily-groups">
      {grouped.map(({ meta, items }) => (
        <div key={meta.key} className="ov-daily-group">
          <div className="ov-daily-group-head">
            <span className="ov-daily-icon">{meta.icon}</span>
            {meta.label}
            <b>{items.length}</b>
          </div>
          <ul className="ov-daily-list">
            {items.map((a) => {
              const detail = activityDetail(a);
              const issue =
                a.entityType === 'issue'
                  ? issues.find((i) => i.id === a.entityId)
                  : undefined;
              const clickable = Boolean(issue);
              return (
                <li
                  key={a.id}
                  className={
                    'ov-daily-item' + (clickable ? ' ov-daily-item--btn' : '')
                  }
                  onClick={clickable ? () => onSelectIssue(issue!) : undefined}
                >
                  <span className={`ov-daily-badge ov-daily-badge--${a.action}`}>
                    {ACTION_LABEL[a.action]}
                  </span>
                  <span className="ov-daily-title">{a.title}</span>
                  {detail && <span className="ov-daily-detail">{detail}</span>}
                  {a.source === 'agent' && (
                    <span className="ov-daily-src" title="Claude/MCP">
                      🤖
                    </span>
                  )}
                </li>
              );
            })}
          </ul>
        </div>
      ))}
    </div>
  );
}

/**
 * 해당 요약을 구글 드라이브에 업로드하는 버튼.
 * 브라우저에서 직접(GIS access_token) 올린다 — 서버·secret 불필요.
 * 같은 날짜 문서가 있으면 갱신, 없으면 새 Google Docs 문서를 만든다.
 */
export function DriveUpload({
  summary,
  projectName,
}: {
  summary: DailySummary;
  projectName: string;
}) {
  type State =
    | { kind: 'idle' }
    | { kind: 'uploading' }
    | { kind: 'done'; result: DriveUploadResult }
    | { kind: 'error'; message: string };
  const [state, setState] = useState<State>({ kind: 'idle' });

  const configured = isDriveConfigured();
  const disabled =
    !configured ||
    !projectName ||
    summary.total === 0 ||
    state.kind === 'uploading';

  const upload = async (): Promise<void> => {
    setState({ kind: 'uploading' });
    try {
      const markdown = renderDailyReport(summary, projectName);
      const fileName = dailyReportFileName(summary.date, projectName);
      const result = await uploadDailyReport({
        projectName,
        fileName,
        markdown,
      });
      setState({ kind: 'done', result });
    } catch (err) {
      setState({
        kind: 'error',
        message: err instanceof Error ? err.message : String(err),
      });
    }
  };

  const title = !configured
    ? 'VITE_GOOGLE_CLIENT_ID 미설정 — 웹 앱 .env 에 구글 클라이언트 ID를 넣어주세요'
    : summary.total === 0
      ? '기록된 변경이 없어 업로드할 내용이 없습니다'
      : '이 날짜의 요약을 구글 드라이브에 올립니다';

  return (
    <span className="ov-drive">
      <button
        type="button"
        className="ov-drive-btn"
        onClick={upload}
        disabled={disabled}
        title={title}
      >
        {state.kind === 'uploading' ? '업로드 중…' : '드라이브 업로드'}
      </button>
      {state.kind === 'done' && (
        <a
          className="ov-drive-link"
          href={state.result.webViewLink}
          target="_blank"
          rel="noreferrer"
        >
          {state.result.updated ? '갱신됨 · 문서 열기 ↗' : '업로드됨 · 문서 열기 ↗'}
        </a>
      )}
      {state.kind === 'error' && (
        <span className="ov-drive-err" title={state.message}>
          실패: {state.message}
        </span>
      )}
    </span>
  );
}
