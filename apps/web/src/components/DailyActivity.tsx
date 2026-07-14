import { useState } from 'react';
import type { DailyReport } from '@issue-board/shared';
import {
  uploadDailyReport,
  isDriveConfigured,
  type DriveUploadResult,
} from '../api/drive';
import { dailyReportFileName } from '../api/dailyReport';

/**
 * AI 요약본(Claude 생성)을 구글 드라이브에 업로드하는 버튼.
 * 브라우저에서 직접(GIS access_token) 올린다 — 서버·secret 불필요.
 * 같은 날짜 문서가 있으면 갱신, 없으면 새 Google Docs 문서를 만든다.
 */
export function DriveUpload({
  report,
  date,
  projectName,
}: {
  report: DailyReport | null;
  date: string;
  projectName: string;
}) {
  type State =
    | { kind: 'idle' }
    | { kind: 'uploading' }
    | { kind: 'done'; result: DriveUploadResult }
    | { kind: 'error'; message: string };
  const [state, setState] = useState<State>({ kind: 'idle' });

  const configured = isDriveConfigured();
  const ready = report?.status === 'ready' && report.content.trim().length > 0;
  const disabled =
    !configured || !projectName || !ready || state.kind === 'uploading';

  const upload = async (): Promise<void> => {
    if (!ready || !report) return;
    setState({ kind: 'uploading' });
    try {
      const fileName = dailyReportFileName(date, projectName);
      const result = await uploadDailyReport({
        projectName,
        fileName,
        markdown: report.content,
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
    : !ready
      ? '먼저 ‘AI 요약하기’로 보고서를 생성하세요'
      : '이 날짜의 AI 요약 보고서를 구글 드라이브에 올립니다';

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
