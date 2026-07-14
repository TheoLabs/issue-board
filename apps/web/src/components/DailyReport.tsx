import { useEffect, useState } from 'react';
import type { Issue, DailySummary, DailyCount } from '@issue-board/shared';
import { api } from '../api/client';
import { DailyActivityGroups, DriveUpload } from './DailyActivity';
import {
  dailySummaryText,
  renderDailyReport,
  dailyReportFileName,
} from '../api/dailyReport';

/**
 * "일일 업무" 탭 — 날짜별 활동 이력.
 * 좌측: 활동이 있었던 날짜 목록(sqlite). 우측: 선택 날짜의 상세 + 드라이브 업로드.
 * 날짜 이동(◀ ▶ · 달력)으로 활동이 없는 날짜도 조회할 수 있다.
 */
export function DailyReport({
  projectId,
  projectName,
  issues,
  onSelectIssue,
}: {
  projectId: string | null;
  projectName: string;
  issues: Issue[];
  onSelectIssue: (issue: Issue) => void;
}) {
  const [days, setDays] = useState<DailyCount[]>([]);
  const [date, setDate] = useState<string>(() => todayKst());
  const [summary, setSummary] = useState<DailySummary | null>(null);
  const [showReport, setShowReport] = useState(false);

  // 날짜 목록 — 보드 데이터 변화(SSE 리로드 포함)에 맞춰 갱신
  useEffect(() => {
    if (!projectId) {
      setDays([]);
      return;
    }
    let alive = true;
    api
      .listActivityDays(projectId)
      .then((d) => {
        if (alive) setDays(d);
      })
      .catch(() => {
        if (alive) setDays([]);
      });
    return () => {
      alive = false;
    };
  }, [projectId, issues]);

  // 선택 날짜의 상세 요약
  useEffect(() => {
    if (!projectId) {
      setSummary(null);
      return;
    }
    let alive = true;
    setSummary(null);
    api
      .getDailySummary(projectId, date)
      .then((s) => {
        if (alive) setSummary(s);
      })
      .catch(() => {
        if (alive) setSummary(null);
      });
    return () => {
      alive = false;
    };
  }, [projectId, date, issues]);

  if (!projectId) return null;

  const today = todayKst();
  const todayCount = days.find((d) => d.date === today)?.total ?? 0;
  const pastDays = days.filter((d) => d.date !== today);

  return (
    <div className="domain-layout">
      <nav className="wireframe-nav">
        <button
          className={date === today ? 'active' : ''}
          onClick={() => setDate(today)}
        >
          오늘 ({weekday(today)})
          <span className="nav-badge">{todayCount}</span>
        </button>
        {pastDays.map((d) => (
          <button
            key={d.date}
            className={d.date === date ? 'active' : ''}
            onClick={() => setDate(d.date)}
          >
            {d.date} ({weekday(d.date)})
            <span className="nav-badge">{d.total}</span>
          </button>
        ))}
      </nav>

      <div className="domain-stage">
        <section className="ov-card ov-daily">
          <div className="ov-daily-head">
            <div className="daily-datenav">
              <button
                type="button"
                className="daily-datenav-btn"
                onClick={() => setDate((c) => shiftDate(c, -1))}
                title="이전 날짜"
              >
                ◀
              </button>
              <input
                type="date"
                className="daily-dateinput"
                value={date}
                max={todayKst()}
                onChange={(e) => e.target.value && setDate(e.target.value)}
              />
              <button
                type="button"
                className="daily-datenav-btn"
                onClick={() => setDate((c) => shiftDate(c, 1))}
                disabled={date >= todayKst()}
                title="다음 날짜"
              >
                ▶
              </button>
            </div>
            <span className="ov-daily-date">{weekday(date)}요일</span>
            <span className="ov-daily-total">{summary?.total ?? 0}건</span>
            {summary && summary.total > 0 && (
              <button
                type="button"
                className="ov-report-btn"
                onClick={() => setShowReport(true)}
                title="이 날짜의 보고서를 생성해 미리봅니다"
              >
                보고서 보기
              </button>
            )}
            {summary && (
              <DriveUpload summary={summary} projectName={projectName} />
            )}
          </div>

          {summary ? (
            <>
              {summary.total > 0 && (
                <p className="ov-daily-summary">{dailySummaryText(summary)}</p>
              )}
              <DailyActivityGroups
                summary={summary}
                issues={issues}
                onSelectIssue={onSelectIssue}
                emptyText="이 날짜에 기록된 변경이 없습니다."
              />
            </>
          ) : (
            <p className="ov-daily-empty">불러오는 중…</p>
          )}
        </section>
      </div>

      {showReport && summary && (
        <ReportModal
          markdown={renderDailyReport(summary, projectName)}
          fileName={`${dailyReportFileName(summary.date, projectName)}.md`}
          onClose={() => setShowReport(false)}
        />
      )}
    </div>
  );
}

/** 생성된 보고서(마크다운) 미리보기 + 복사/다운로드 모달. */
function ReportModal({
  markdown,
  fileName,
  onClose,
}: {
  markdown: string;
  fileName: string;
  onClose: () => void;
}) {
  const [copied, setCopied] = useState(false);

  const copy = async (): Promise<void> => {
    try {
      await navigator.clipboard.writeText(markdown);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1500);
    } catch {
      setCopied(false);
    }
  };

  const download = (): void => {
    const blob = new Blob([markdown], { type: 'text/markdown;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = fileName;
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="report-overlay" onClick={onClose}>
      <div
        className="report-modal"
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-label="일일 업무 보고 미리보기"
      >
        <div className="report-modal-head">
          <h3>보고서 미리보기</h3>
          <div className="report-modal-actions">
            <button type="button" className="ov-report-btn" onClick={copy}>
              {copied ? '복사됨 ✓' : '복사'}
            </button>
            <button type="button" className="ov-report-btn" onClick={download}>
              .md 다운로드
            </button>
            <button
              type="button"
              className="report-modal-close"
              onClick={onClose}
              aria-label="닫기"
            >
              ✕
            </button>
          </div>
        </div>
        <pre className="report-pre">{markdown}</pre>
      </div>
    </div>
  );
}

const WEEKDAYS = ['일', '월', '화', '수', '목', '금', '토'];

/** YYYY-MM-DD → 한글 요일. 파싱 불가 시 빈 문자열. */
function weekday(date: string): string {
  const [y, m, d] = date.split('-').map(Number);
  if (!y || !m || !d) return '';
  return WEEKDAYS[new Date(Date.UTC(y, m - 1, d)).getUTCDay()] ?? '';
}

/** Asia/Seoul 기준 오늘 (YYYY-MM-DD) */
function todayKst(): string {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Seoul',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(new Date());
}

/** YYYY-MM-DD 를 delta일 이동한 날짜 문자열 */
function shiftDate(date: string, delta: number): string {
  const [y, m, d] = date.split('-').map(Number);
  const dt = new Date(Date.UTC(y, m - 1, d));
  dt.setUTCDate(dt.getUTCDate() + delta);
  return dt.toISOString().slice(0, 10);
}
