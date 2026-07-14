import { useCallback, useEffect, useState } from 'react';
import { useNavigate, useLocation, useSearchParams } from 'react-router-dom';
import type {
  Project,
  Plan,
  Issue,
  Wireframe,
  Domain,
  Design,
  IssueStatus,
  IssuePriority,
  IssueType,
  IssueLevel,
} from '@issue-board/shared';
import { ISSUE_STATUS, ISSUE_PRIORITY } from '@issue-board/shared';
import { api } from './api/client';
import { useBoardEvents } from './api/useBoardEvents';
import { IssueBoard } from './components/IssueBoard';
import { IssueTable } from './components/IssueTable';
import { Select } from './components/Select';
import { ISSUE_STATUS_LABEL, ISSUE_PRIORITY_LABEL } from './constants';
import { IssueDrawer } from './components/IssueDrawer';
import { WireframeViewer } from './components/WireframeViewer';
import { DomainView } from './components/DomainView';
import { DesignSystem } from './components/DesignSystem';
import { Overview } from './components/Overview';
import { DailyReport } from './components/DailyReport';
import { Erd } from './components/Erd';
import { PlanPanel } from './components/PlanPanel';

type Tab =
  | 'overview'
  | 'daily'
  | 'plans'
  | 'issues'
  | 'wireframes'
  | 'domains'
  | 'design';

const TABS: Tab[] = [
  'overview',
  'daily',
  'plans',
  'issues',
  'wireframes',
  'domains',
  'design',
];
const TAB_STORAGE_KEY = 'issue-board:tab';

/** 마크다운 body에서 index번째 체크리스트 항목의 [ ]↔[x]를 토글한 새 body를 반환 */
function toggleChecklistLine(body: string, index: number): string {
  const lines = body.split('\n');
  let count = -1;
  for (let i = 0; i < lines.length; i++) {
    const m = lines[i].match(/^(\s*[-*] )\[([ xX])\](.*)$/);
    if (!m) continue;
    count++;
    if (count === index) {
      const checked = m[2].toLowerCase() === 'x';
      lines[i] = `${m[1]}[${checked ? ' ' : 'x'}]${m[3]}`;
      break;
    }
  }
  return lines.join('\n');
}

export function App() {
  const [projects, setProjects] = useState<Project[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [plans, setPlans] = useState<Plan[]>([]);
  const [issues, setIssues] = useState<Issue[]>([]);
  const [wireframes, setWireframes] = useState<Wireframe[]>([]);
  const [domains, setDomains] = useState<Domain[]>([]);
  const [design, setDesign] = useState<Design | null>(null);
  const [activeDomainId, setActiveDomainId] = useState<string | null>(null);
  const [domainView, setDomainView] = useState<'table' | 'erd'>('table');
  const [issueView, setIssueView] = useState<'kanban' | 'table'>('table');
  // 라우팅: 탭·기획 상세는 URL 경로, 이슈 상세 드로어는 ?issue= 쿼리에서 파생
  const navigate = useNavigate();
  const location = useLocation();
  const [searchParams] = useSearchParams();
  const pathSegs = location.pathname.split('/').filter(Boolean);
  const tab: Tab = (TABS as string[]).includes(pathSegs[0] ?? '')
    ? (pathSegs[0] as Tab)
    : 'overview';
  const routePlanId = tab === 'plans' ? (pathSegs[1] ?? null) : null;
  const selectedIssueId = searchParams.get('issue');
  // 딥링크: ?project=<id> 로 특정 프로젝트를 지정할 수 있다(보고서 링크 등)
  const urlProjectId = searchParams.get('project');
  // 이슈 기획 필터: null=전체, '__none__'=기획 없음, 그 외=planId
  const [filterPlanId, setFilterPlanId] = useState<string | null>(null);
  const [filterStatus, setFilterStatus] = useState<IssueStatus | ''>('');
  const [filterPriority, setFilterPriority] = useState<IssuePriority | ''>('');
  const [filterType, setFilterType] = useState<IssueType | ''>('');
  const [issueQuery, setIssueQuery] = useState('');
  // 와이어프레임은 name으로 묶고, 선택된 이름 + 선택된 버전(id)으로 표시한다.
  const [activeName, setActiveName] = useState<string | null>(null);
  const [activeVersionId, setActiveVersionId] = useState<string | null>(null);
  const [gotoScreen, setGotoScreen] = useState<string | null>(null);

  useEffect(() => {
    api.listProjects().then((p) => {
      setProjects(p);
      if (p.length > 0) setSelectedId((cur) => cur ?? p[0].id);
    });
  }, []);

  // 딥링크 수신: URL의 ?project=<id> 가 유효하면 그 프로젝트를 선택한다.
  // (보고서의 '점검 필요' 딥링크로 진입 시 올바른 프로젝트로 전환되게 함)
  useEffect(() => {
    if (urlProjectId && projects.some((p) => p.id === urlProjectId)) {
      setSelectedId(urlProjectId);
    }
  }, [urlProjectId, projects]);

  const loadProject = useCallback((projectId: string) => {
    Promise.all([
      api.listPlans(projectId),
      api.listIssues(projectId),
      api.listWireframes(projectId),
      api.listDomains(projectId),
      api.getDesign(projectId),
    ]).then(([pl, is, wf, dm, ds]) => {
      setPlans(pl);
      setIssues(is);
      setDomains(dm);
      setDesign(ds);
      setActiveDomainId((prev) =>
        prev && dm.some((d) => d.id === prev) ? prev : (dm[0]?.id ?? null),
      );
      // IA sequence 오름차순 → 이름(숫자 자연 정렬) → 같은 이름은 버전 내림차순(최신 먼저).
      const sortedWf = [...wf].sort(
        (a, b) =>
          a.sequence - b.sequence ||
          a.name.localeCompare(b.name, undefined, { numeric: true }) ||
          b.version - a.version,
      );
      setWireframes(sortedWf);
      // 선택 유지: 기존 이름이 아직 있으면 그대로, 없으면 첫 이름.
      setActiveName((prev) => {
        const next =
          prev && sortedWf.some((w) => w.name === prev)
            ? prev
            : (sortedWf[0]?.name ?? null);
        // 그 이름의 최신 버전을 기본 선택
        setActiveVersionId(sortedWf.find((w) => w.name === next)?.id ?? null);
        return next;
      });
    });
  }, []);

  useEffect(() => {
    if (selectedId) loadProject(selectedId);
  }, [selectedId, loadProject]);

  // 탭 변경 시 localStorage에 저장 → 새로고침 후에도 마지막 탭 유지
  useEffect(() => {
    try {
      localStorage.setItem(TAB_STORAGE_KEY, tab);
    } catch {
      // 저장 실패는 무시(기능에 영향 없음)
    }
  }, [tab]);

  // 외부 Claude 세션(MCP) 변경을 실시간 반영
  useBoardEvents(
    useCallback(
      (event) => {
        if (event.projectId === selectedId) loadProject(selectedId);
        api.listProjects().then(setProjects);
      },
      [selectedId, loadProject],
    ),
  );

  // 선택된 이슈는 URL(?issue=)에서 파생 → issues 갱신 시 자동으로 최신 반영됨
  const selectedIssue = selectedIssueId
    ? (issues.find((i) => i.id === selectedIssueId) ?? null)
    : null;

  // 내비게이션 헬퍼 (URL이 화면의 진실)
  const goTab = (t: Tab) => navigate('/' + t);
  // 프로젝트 선택: 상태 + URL(?project=)을 함께 갱신해 딥링크가 항상 정확한 프로젝트를 가리키게 한다.
  const selectProject = (id: string) => {
    setSelectedId(id);
    const sp = new URLSearchParams(location.search);
    sp.set('project', id);
    sp.delete('issue'); // 프로젝트가 바뀌면 열린 이슈 드로어는 닫는다
    navigate({ pathname: location.pathname, search: sp.toString() });
  };
  const openIssue = (issue: Issue) => {
    const sp = new URLSearchParams(location.search);
    sp.set('issue', issue.id);
    navigate({ pathname: location.pathname, search: sp.toString() });
  };
  const closeIssue = () => {
    if (location.key !== 'default') navigate(-1);
    else navigate(location.pathname, { replace: true });
  };
  const openPlan = (planId: string) => navigate('/plans/' + planId);
  const closePlan = () => {
    if (location.key !== 'default') navigate(-1);
    else navigate('/plans');
  };

  // 마지막 탭 저장 + '/' 진입 시 복원
  useEffect(() => {
    if (location.pathname === '/') {
      let saved = 'overview';
      try {
        const s = localStorage.getItem(TAB_STORAGE_KEY);
        if (s && (TABS as string[]).includes(s)) saved = s;
      } catch {
        /* ignore */
      }
      navigate('/' + saved, { replace: true });
    } else if ((TABS as string[]).includes(tab)) {
      try {
        localStorage.setItem(TAB_STORAGE_KEY, tab);
      } catch {
        /* ignore */
      }
    }
  }, [location.pathname, navigate, tab]);

  // selectedIssue는 issues에서 파생되므로 setIssues만 하면 드로어도 자동 갱신됨
  const changeStatus = useCallback((issue: Issue, status: IssueStatus) => {
    api.updateIssue(issue.id, { status }, issue.version).then((updated) => {
      setIssues((cur) => cur.map((i) => (i.id === updated.id ? updated : i)));
    });
  }, []);

  const changeLevel = useCallback(
    (issue: Issue, field: 'value' | 'effort', level: IssueLevel) => {
      api
        .updateIssue(issue.id, { [field]: level }, issue.version)
        .then((updated) => {
          setIssues((cur) =>
            cur.map((i) => (i.id === updated.id ? updated : i)),
          );
        });
    },
    [],
  );

  const toggleCheckbox = useCallback((issue: Issue, index: number) => {
    const newBody = toggleChecklistLine(issue.body, index);
    if (newBody === issue.body) return;
    api.updateIssue(issue.id, { body: newBody }, issue.version).then((updated) => {
      setIssues((cur) => cur.map((i) => (i.id === updated.id ? updated : i)));
    });
  }, []);

  const viewPlan = useCallback(
    (planId: string) => navigate('/plans/' + planId),
    [navigate],
  );

  // 이슈의 screenId를 담고 있는 와이어프레임(이름별 최신 버전)을 찾아 그 화면으로 이동
  const viewScreen = useCallback(
    (screenId: string) => {
      const seen = new Set<string>();
      let target: Wireframe | undefined;
      for (const w of wireframes) {
        // wireframes는 이름별 최신이 먼저 오도록 정렬돼 있음
        if (seen.has(w.name)) continue;
        seen.add(w.name);
        if (w.content.includes(`data-screen="${screenId}"`)) {
          target = w;
          break;
        }
      }
      if (target) {
        setActiveName(target.name);
        setActiveVersionId(target.id);
      }
      setGotoScreen(screenId);
      navigate('/wireframes');
    },
    [wireframes, navigate],
  );

  const deleteWireframe = useCallback(
    (wf: Wireframe) => {
      const ok = window.confirm(
        `"${wf.name}" v${wf.version}을(를) 삭제할까요? 되돌릴 수 없습니다.`,
      );
      if (!ok) return;
      api.deleteWireframe(wf.id).then(() => {
        if (selectedId) loadProject(selectedId);
      });
    },
    [selectedId, loadProject],
  );

  const deleteDomain = useCallback(
    (domain: Domain) => {
      if (!window.confirm(`도메인 "${domain.name}"을(를) 삭제할까요?`)) return;
      api.deleteDomain(domain.id).then(() => {
        if (selectedId) loadProject(selectedId);
      });
    },
    [selectedId, loadProject],
  );

  const viewDomain = useCallback(
    (domainId: string) => {
      setActiveDomainId(domainId);
      navigate('/domains');
    },
    [navigate],
  );

  const selected = projects.find((p) => p.id === selectedId) ?? null;
  const linkedPlan = selectedIssue?.planId
    ? (plans.find((p) => p.id === selectedIssue.planId) ?? null)
    : null;
  const linkedDomain = selectedIssue?.domainId
    ? (domains.find((d) => d.id === selectedIssue.domainId) ?? null)
    : null;
  const issueQ = issueQuery.trim().toLowerCase();
  const filteredIssues = issues.filter((i) => {
    if (filterPlanId === '__none__') {
      if (i.planId) return false;
    } else if (filterPlanId && i.planId !== filterPlanId) {
      return false;
    }
    if (filterType && i.type !== filterType) return false;
    if (filterStatus && i.status !== filterStatus) return false;
    if (filterPriority && i.priority !== filterPriority) return false;
    if (issueQ && !`${i.title} ${i.body}`.toLowerCase().includes(issueQ))
      return false;
    return true;
  });
  // viewScreen과 동일하게 "이름별 최신 버전" 중에서만 화면 존재 여부를 판단
  const screenAvailable =
    !!selectedIssue?.screenId &&
    (() => {
      const marker = `data-screen="${selectedIssue.screenId}"`;
      const seen = new Set<string>();
      for (const w of wireframes) {
        if (seen.has(w.name)) continue;
        seen.add(w.name);
        if (w.content.includes(marker)) return true;
      }
      return false;
    })();

  return (
    <div className="app">
      <aside className="sidebar">
        <h1>Issue Board</h1>
        <nav>
          {projects.map((p) => (
            <button
              key={p.id}
              className={p.id === selectedId ? 'active' : ''}
              onClick={() => selectProject(p.id)}
            >
              {p.name}
            </button>
          ))}
          {projects.length === 0 && (
            <p className="hint">
              프로젝트가 없습니다. 터미널에서 Claude Code로 <code>create_project</code>{' '}
              MCP 툴을 호출해 생성하세요.
            </p>
          )}
        </nav>
      </aside>

      <main className="content">
        {!selected ? (
          <div className="placeholder">프로젝트를 선택하세요.</div>
        ) : (
          <>
            <header className="content-header">
              <h2>{selected.name}</h2>
              {selected.description && <p>{selected.description}</p>}
              <div className="tabs">
                {(
                  [
                    'overview',
                    'daily',
                    'issues',
                    'plans',
                    'domains',
                    'wireframes',
                    'design',
                  ] as Tab[]
                ).map((t) => (
                  <button
                    key={t}
                    className={tab === t ? 'active' : ''}
                    onClick={() => goTab(t)}
                  >
                    {t === 'overview'
                      ? '대시보드'
                      : t === 'daily'
                        ? '일일 업무'
                        : t === 'issues'
                          ? `이슈 (${issues.length})`
                          : t === 'plans'
                            ? `기획 (${plans.length})`
                            : t === 'domains'
                              ? `도메인 (${domains.length})`
                              : t === 'wireframes'
                                ? `와이어프레임 (${new Set(wireframes.map((w) => w.name)).size})`
                                : '디자인 시스템'}
                  </button>
                ))}
              </div>
            </header>

            <section className="panel">
              {tab === 'overview' && (
                <Overview
                  projectId={selectedId}
                  plans={plans}
                  issues={issues}
                  domains={domains}
                  wireframes={wireframes}
                  design={design}
                  onGoTab={goTab}
                  onSelectIssue={openIssue}
                />
              )}

              {tab === 'daily' && (
                <DailyReport
                  projectId={selectedId}
                  projectName={selected?.name ?? ''}
                  issues={issues}
                />
              )}

              {tab === 'issues' && (
                <>
                  <div className="issue-controls">
                    <div className="filter-bar">
                      <div className="filter-row">
                        <div className="filter-field">
                          <label>기획</label>
                          <Select
                            ariaLabel="기획 필터"
                            minWidth={160}
                            value={filterPlanId ?? ''}
                            onChange={(v) => setFilterPlanId(v || null)}
                            options={[
                              {
                                value: '',
                                label: `전체 (${issues.length})`,
                              },
                              ...plans.map((p) => ({
                                value: p.id,
                                label: `${p.title} (${
                                  issues.filter((i) => i.planId === p.id).length
                                })`,
                              })),
                              ...(issues.some((i) => !i.planId)
                                ? [
                                    {
                                      value: '__none__',
                                      label: `기획 없음 (${
                                        issues.filter((i) => !i.planId).length
                                      })`,
                                    },
                                  ]
                                : []),
                            ]}
                          />
                        </div>
                      </div>
                      <div className="filter-row">
                        <input
                          className="search-input"
                          type="search"
                          placeholder="제목·본문 검색"
                          value={issueQuery}
                          onChange={(e) => setIssueQuery(e.target.value)}
                        />
                        <div className="filter-field">
                          <label>상태</label>
                          <Select
                            ariaLabel="상태 필터"
                            value={filterStatus}
                            onChange={(v) =>
                              setFilterStatus(v as IssueStatus | '')
                            }
                            options={[
                              { value: '', label: '전체' },
                              ...ISSUE_STATUS.map((s) => ({
                                value: s,
                                label: ISSUE_STATUS_LABEL[s],
                              })),
                            ]}
                          />
                        </div>
                        <div className="filter-field">
                          <label>우선순위</label>
                          <Select
                            ariaLabel="우선순위 필터"
                            value={filterPriority}
                            onChange={(v) =>
                              setFilterPriority(v as IssuePriority | '')
                            }
                            options={[
                              { value: '', label: '전체' },
                              ...ISSUE_PRIORITY.map((p) => ({
                                value: p,
                                label: ISSUE_PRIORITY_LABEL[p],
                              })),
                            ]}
                          />
                        </div>
                        <div className="filter-field">
                          <label>종류</label>
                          <Select
                            ariaLabel="종류 필터"
                            value={filterType}
                            onChange={(v) => setFilterType(v as IssueType | '')}
                            options={[
                              { value: '', label: '전체' },
                              {
                                value: 'epic',
                                label: `에픽 (${
                                  issues.filter((i) => i.type === 'epic').length
                                })`,
                              },
                              {
                                value: 'task',
                                label: `일반 (${
                                  issues.filter((i) => i.type === 'task').length
                                })`,
                              },
                            ]}
                          />
                        </div>
                        {(filterStatus ||
                          filterPriority ||
                          filterType ||
                          issueQ ||
                          filterPlanId) && (
                          <span className="muted-hint">
                            {filteredIssues.length} / {issues.length}
                          </span>
                        )}
                      </div>
                    </div>
                    <div className="view-toggle">
                      <button
                        className={issueView === 'table' ? 'active' : ''}
                        onClick={() => setIssueView('table')}
                      >
                        테이블
                      </button>
                      <button
                        className={issueView === 'kanban' ? 'active' : ''}
                        onClick={() => setIssueView('kanban')}
                      >
                        칸반
                      </button>
                    </div>
                  </div>
                  {issueView === 'kanban' ? (
                    <IssueBoard
                      issues={filteredIssues}
                      onSelect={openIssue}
                      onMove={changeStatus}
                      selectedId={selectedIssue?.id ?? null}
                    />
                  ) : (
                    <IssueTable
                      issues={filteredIssues}
                      onSelect={openIssue}
                      onMove={changeStatus}
                      selectedId={selectedIssue?.id ?? null}
                    />
                  )}
                </>
              )}

              {tab === 'plans' &&
                (plans.length === 0 ? (
                  <p className="empty">기획서가 없습니다.</p>
                ) : (
                  <PlanPanel
                    plans={plans}
                    openPlanId={routePlanId}
                    onOpen={openPlan}
                    onClose={closePlan}
                    onChanged={() => selectedId && loadProject(selectedId)}
                  />
                ))}

              {tab === 'wireframes' &&
                (wireframes.length === 0 ? (
                  <p className="empty">와이어프레임이 없습니다.</p>
                ) : (
                  (() => {
                    // 이름별 그룹 (등장 순서 = 이미 정렬됨). 각 그룹은 버전 내림차순.
                    const names: string[] = [];
                    for (const wf of wireframes) {
                      if (!names.includes(wf.name)) names.push(wf.name);
                    }
                    const versions = wireframes.filter(
                      (w) => w.name === activeName,
                    );
                    const activeWf =
                      wireframes.find((w) => w.id === activeVersionId) ??
                      versions[0];
                    return (
                      <div className="wireframe-layout">
                        <nav className="wireframe-nav">
                          {names.map((name, i) => {
                            const latest = wireframes.find(
                              (w) => w.name === name,
                            )!;
                            return (
                              <button
                                key={name}
                                className={activeName === name ? 'active' : ''}
                                onClick={() => {
                                  setActiveName(name);
                                  setActiveVersionId(latest.id);
                                }}
                              >
                                <span className="wf-nav-num">{i + 1}.</span>
                                {name}
                              </button>
                            );
                          })}
                        </nav>
                        <div className="wireframe-stage">
                          {activeWf && (
                            <div className="stage-toolbar">
                              {versions.length > 1 && (
                                <div className="version-bar">
                                  <label>버전</label>
                                  <Select
                                    ariaLabel="버전 선택"
                                    value={activeWf.id}
                                    onChange={(v) => setActiveVersionId(v)}
                                    options={versions.map((v, i) => ({
                                      value: v.id,
                                      label: `v${v.version}${
                                        i === 0 ? ' (최신)' : ''
                                      }`,
                                    }))}
                                  />
                                </div>
                              )}
                              <button
                                className="danger-btn"
                                onClick={() => deleteWireframe(activeWf)}
                                title="이 버전 삭제"
                              >
                                삭제
                              </button>
                            </div>
                          )}
                          {activeWf ? (
                            <WireframeViewer
                              wireframe={activeWf}
                              gotoScreen={gotoScreen}
                            />
                          ) : null}
                        </div>
                      </div>
                    );
                  })()
                ))}

              {tab === 'domains' &&
                (domains.length === 0 ? (
                  <p className="empty">
                    도메인이 없습니다. 대상 프로젝트에서 <code>/ib-domain</code>으로
                    도메인을 정의하세요.
                  </p>
                ) : (
                  <>
                    <div className="view-toggle">
                      <button
                        className={domainView === 'table' ? 'active' : ''}
                        onClick={() => setDomainView('table')}
                      >
                        표
                      </button>
                      <button
                        className={domainView === 'erd' ? 'active' : ''}
                        onClick={() => setDomainView('erd')}
                      >
                        ERD
                      </button>
                    </div>

                    {domainView === 'erd' ? (
                      <Erd domains={domains} />
                    ) : (
                      <div className="domain-layout">
                        <nav className="wireframe-nav">
                          {domains.map((d) => (
                            <button
                              key={d.id}
                              className={activeDomainId === d.id ? 'active' : ''}
                              onClick={() => setActiveDomainId(d.id)}
                            >
                              {d.name}
                              {d.status === 'draft' && (
                                <span className="nav-badge">초안</span>
                              )}
                            </button>
                          ))}
                        </nav>
                        <div className="domain-stage">
                          {(() => {
                            const d =
                              domains.find((x) => x.id === activeDomainId) ??
                              domains[0];
                            return d ? (
                              <DomainView
                                domain={d}
                                onDelete={() => deleteDomain(d)}
                              />
                            ) : null;
                          })()}
                        </div>
                      </div>
                    )}
                  </>
                ))}

              {tab === 'design' && <DesignSystem design={design} />}
            </section>
          </>
        )}
      </main>

      {selectedIssue && (
        <IssueDrawer
          issue={selectedIssue}
          linkedPlan={linkedPlan}
          linkedDomain={linkedDomain}
          canViewScreen={screenAvailable}
          parentIssue={
            selectedIssue.parentId
              ? (issues.find((i) => i.id === selectedIssue.parentId) ?? null)
              : null
          }
          childIssues={issues.filter((i) => i.parentId === selectedIssue.id)}
          onSelectIssue={openIssue}
          onClose={closeIssue}
          onStatusChange={(status) => changeStatus(selectedIssue, status)}
          onLevelChange={(field, level) =>
            changeLevel(selectedIssue, field, level)
          }
          onViewPlan={() => selectedIssue.planId && viewPlan(selectedIssue.planId)}
          onViewDomain={() =>
            selectedIssue.domainId && viewDomain(selectedIssue.domainId)
          }
          onViewScreen={() =>
            selectedIssue.screenId && viewScreen(selectedIssue.screenId)
          }
          onToggleCheckbox={(index) => toggleCheckbox(selectedIssue, index)}
        />
      )}
    </div>
  );
}
