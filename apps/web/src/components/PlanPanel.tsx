import { useCallback, useEffect, useMemo, useState } from 'react';
import type { Plan, PlanVersion, PlanStatus } from '@issue-board/shared';
import { PLAN_STATUS } from '@issue-board/shared';
import { api } from '../api/client';
import { Markdown } from './Markdown';
import { Select } from './Select';

/** 마크다운에서 h2(## ) 섹션 목차 추출 (Markdown의 sec-N id와 순서 일치) */
function extractToc(md: string): { id: string; text: string }[] {
  const out: { id: string; text: string }[] = [];
  let i = 0;
  for (const line of md.split('\n')) {
    const m = line.match(/^##\s+(.+?)\s*$/);
    if (m) out.push({ id: `sec-${i++}`, text: m[1] });
  }
  return out;
}

const fmtDate = (iso: string) =>
  new Date(iso).toLocaleString('ko-KR', {
    year: '2-digit',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  });

const STATUS_LABEL: Record<PlanStatus, string> = {
  draft: '초안',
  approved: '승인',
  archived: '보관',
};

/** 기획 상태 → 드롭다운 트리거 색 tone */
const STATUS_TONE: Record<PlanStatus, string> = {
  draft: 'tone-amber',
  approved: 'tone-green',
  archived: 'tone-neutral',
};

/** 본문 최상단 H1(제목)은 헤더 제목과 중복되므로 제거 */
const stripLeadingH1 = (md: string) => md.replace(/^\s*#\s+.*(?:\r?\n)+/, '');

const CURRENT = '__current__'; // 작업본(현재)을 뜻하는 특수 선택값

/**
 * 기획 탭: 표로 관리하고, 행 클릭 시 상세 드로어(작업본 + 마일스톤 버전 이력)를 연다.
 * - 편집(작업본)은 버전을 쌓지 않음. 승인/명시적 저장 시에만 마일스톤 스냅샷.
 */
export function PlanPanel({
  plans,
  openPlanId,
  onOpen,
  onClose,
  onChanged,
}: {
  plans: Plan[];
  openPlanId: string | null;
  onOpen: (id: string) => void;
  onClose: () => void;
  onChanged: () => void;
}) {
  const [versions, setVersions] = useState<PlanVersion[]>([]);
  const [selected, setSelected] = useState<string>(CURRENT); // CURRENT 또는 PlanVersion.id
  const [reloadKey, setReloadKey] = useState(0);
  const [query, setQuery] = useState('');

  // 열려는 기획이 실제 존재할 때만 상세 표시 (잘못된 URL 방어)
  const openPlan = plans.find((p) => p.id === openPlanId) ?? null;
  const openId = openPlan?.id ?? null;

  useEffect(() => {
    if (!openId) {
      setVersions([]);
      return;
    }
    let cancelled = false;
    api.listPlanVersions(openId).then((vs) => {
      if (!cancelled) {
        setVersions(vs);
        setSelected(CURRENT);
      }
    });
    return () => {
      cancelled = true;
    };
  }, [openId, plans, reloadKey]);
  const shownVersion =
    selected === CURRENT ? null : versions.find((v) => v.id === selected);
  const content = stripLeadingH1(
    shownVersion?.content ?? openPlan?.content ?? '',
  );

  const toc = useMemo(() => extractToc(content), [content]);
  const [activeSec, setActiveSec] = useState<string | null>(null);

  // 스크롤 연동: "읽는 기준선"을 문서 끝으로 갈수록 아래로 내려, 하단 여백 없이도
  // 마지막 섹션까지 순서대로 하이라이트한다.
  useEffect(() => {
    if (!openPlan || toc.length === 0) return;
    const scroller = document.querySelector('.content') as HTMLElement | null;
    const compute = () => {
      const base = 120;
      let line = base;
      if (scroller) {
        const vh = scroller.clientHeight;
        const remaining =
          scroller.scrollHeight - scroller.clientHeight - scroller.scrollTop;
        // 끝에서 한 화면 이내로 들어오면 기준선을 점점 아래로 (최대 vh-20)
        if (remaining < vh) {
          line = base + (1 - Math.max(remaining, 0) / vh) * (vh - base - 20);
        }
      }
      let current = toc[0].id;
      for (const t of toc) {
        const el = document.getElementById(t.id);
        if (el && el.getBoundingClientRect().top <= line) current = t.id;
      }
      setActiveSec(current);
    };
    compute();
    const target: HTMLElement | Window = scroller ?? window;
    target.addEventListener('scroll', compute, { passive: true });
    window.addEventListener('resize', compute);
    return () => {
      target.removeEventListener('scroll', compute);
      window.removeEventListener('resize', compute);
    };
  }, [openPlan, content, toc]);

  const scrollToSection = (id: string) => {
    document.getElementById(id)?.scrollIntoView({
      behavior: 'smooth',
      block: 'start',
    });
  };

  const refresh = useCallback(() => {
    setReloadKey((k) => k + 1);
    onChanged();
  }, [onChanged]);

  const saveSnapshot = useCallback(async () => {
    if (!openPlan) return;
    const label =
      window.prompt('이 버전의 이름/사유 (선택):', '') ?? undefined;
    await api.snapshotPlan(openPlan.id, label || undefined);
    refresh();
  }, [openPlan, refresh]);

  const changeStatus = useCallback(
    async (status: PlanStatus) => {
      if (!openPlan || status === openPlan.status) return;
      await api.updatePlan(openPlan.id, { status }, openPlan.version);
      refresh();
    },
    [openPlan, refresh],
  );

  const q = query.trim().toLowerCase();
  const visible = q
    ? plans.filter((p) => p.title.toLowerCase().includes(q))
    : plans;

  // 상세는 별도 전체 페이지로 (목록 대신 표시)
  if (openPlan) {
    return (
      <div className="plan-page">
        <button className="back-btn" onClick={onClose}>
          ← 기획 목록
        </button>

        <div className="plan-page-head">
          <h2>{openPlan.title}</h2>
          <div className="plan-page-controls">
            <div className="plan-status-ctl">
              <label>상태</label>
              <Select
                ariaLabel="기획 상태 변경"
                triggerClassName={STATUS_TONE[openPlan.status]}
                value={openPlan.status}
                onChange={(v) => changeStatus(v as PlanStatus)}
                options={PLAN_STATUS.map((s) => ({
                  value: s,
                  label: STATUS_LABEL[s],
                }))}
              />
            </div>
            <div className="version-bar">
              <label>버전</label>
              <Select
                ariaLabel="버전 선택"
                minWidth={180}
                value={selected}
                onChange={(v) => setSelected(v)}
                options={[
                  { value: CURRENT, label: '현재 (작업본)' },
                  ...versions.map((v) => ({
                    value: v.id,
                    label: `v${v.version}${
                      v.label ? ` · ${v.label}` : ''
                    } · ${fmtDate(v.createdAt)}`,
                  })),
                ]}
              />
            </div>
            <button
              className="link-btn snapshot-btn"
              onClick={saveSnapshot}
              disabled={openPlan.status !== 'approved'}
              title={
                openPlan.status !== 'approved'
                  ? '승인된 기획만 버전 이력을 남깁니다 (확정 후 사용)'
                  : '현재 작업본을 버전으로 저장'
              }
            >
              📌 버전 저장
            </button>
          </div>
        </div>

        <div className="plan-doc">
          <div className="plan-page-body">
            <Markdown>{content}</Markdown>
          </div>
          {toc.length > 1 && (
            <nav className="toc">
              <div className="toc-title">목차</div>
              <ul>
                {toc.map((t) => (
                  <li key={t.id}>
                    <button
                      className={activeSec === t.id ? 'active' : ''}
                      onClick={() => scrollToSection(t.id)}
                    >
                      {t.text}
                    </button>
                  </li>
                ))}
              </ul>
            </nav>
          )}
        </div>
      </div>
    );
  }

  return (
    <>
      <div className="filter-bar">
        <input
          className="search-input"
          type="search"
          placeholder="제목 검색…"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
        />
        {q && (
          <span className="muted-hint">
            {visible.length} / {plans.length}
          </span>
        )}
      </div>
      <div className="table-scroll">
        <table className="list-table">
          <thead>
            <tr>
              <th>제목</th>
              <th>상태</th>
              <th>수정일</th>
            </tr>
          </thead>
          <tbody>
            {visible.map((p) => (
              <tr
                key={p.id}
                className={openId === p.id ? 'selected' : ''}
                onClick={() => onOpen(p.id)}
              >
                <td className="col-name">{p.title}</td>
                <td>
                  <span className={`status-chip status-chip--${p.status}`}>
                    {STATUS_LABEL[p.status]}
                  </span>
                </td>
                <td className="col-constraints">{fmtDate(p.updatedAt)}</td>
              </tr>
            ))}
            {visible.length === 0 && (
              <tr>
                <td colSpan={3} className="empty">
                  "{query}" 검색 결과가 없습니다.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </>
  );
}
