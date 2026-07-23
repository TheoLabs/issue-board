import { Injectable } from '@nestjs/common';
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { z, type ZodRawShape } from 'zod';
import {
  ISSUE_STATUS,
  ISSUE_PRIORITY,
  ISSUE_TYPE,
  ISSUE_LEVEL,
  WIREFRAME_FORMAT,
  DOMAIN_STATUS,
  PLAN_STATUS,
  type IssueStatus,
  type IssuePriority,
  type IssueType,
  type IssueLevel,
  type WireframeFormat,
  type DomainStatus,
  type DomainColumn,
  type DomainLifecycle,
  type PlanStatus,
} from '@issue-board/shared';
import { ProjectsService } from '../projects/projects.service';
import { ApplicationsService } from '../applications/applications.service';
import { PlansService } from '../plans/plans.service';
import { IssuesService } from '../issues/issues.service';
import { WireframesService } from '../wireframes/wireframes.service';
import { DomainsService } from '../domains/domains.service';
import { DesignsService } from '../designs/designs.service';
import { ActivityService } from '../activity/activity.service';
import type { DesignTokens } from '@issue-board/shared';

interface ToolResult {
  content: Array<{ type: 'text'; text: string }>;
}

type LooseToolFn = (
  name: string,
  description: string,
  shape: ZodRawShape,
  handler: (args: Record<string, unknown>) => Promise<ToolResult>,
) => void;

const json = (data: unknown): ToolResult => ({
  content: [{ type: 'text', text: JSON.stringify(data, null, 2) }],
});

/**
 * 이슈보드를 로컬 MCP 서버로 노출한다. (docs/ARCHITECTURE.md §6)
 * 최초 생성(G3)과 다른 세션 연동(G4)이 모두 이 툴들로 이뤄진다.
 * REST 컨트롤러와 동일한 Service 계층을 공유 → 로직 중복 없음.
 */
@Injectable()
export class McpService {
  constructor(
    private readonly projects: ProjectsService,
    private readonly applications: ApplicationsService,
    private readonly plans: PlansService,
    private readonly issues: IssuesService,
    private readonly wireframes: WireframesService,
    private readonly domains: DomainsService,
    private readonly designs: DesignsService,
    private readonly activity: ActivityService,
  ) {}

  /** 요청마다 새 McpServer 인스턴스 생성 (stateless HTTP 트랜스포트) */
  createServer(): McpServer {
    const server = new McpServer({ name: 'issue-board', version: '0.0.1' });
    this.registerReadTools(server);
    this.registerWriteTools(server);
    return server;
  }

  /**
   * server.tool()을 얇게 감싸는 헬퍼.
   * shape를 제네릭 ZodRawShape로 넓혀 SDK의 per-shape 깊은 타입 추론(TS2589)을 차단한다.
   * 런타임 zod 검증은 그대로 유지되고, 핸들러 인자는 각 툴에서 명시적으로 좁힌다.
   */
  private tool(
    server: McpServer,
    name: string,
    description: string,
    shape: ZodRawShape,
    handler: (args: Record<string, unknown>) => Promise<ToolResult>,
  ): void {
    // SDK의 제네릭 오버로드를 우회 (TS2589 차단). 런타임 동작은 동일.
    (server.tool as unknown as LooseToolFn)(name, description, shape, handler);
  }

  private registerReadTools(server: McpServer): void {
    this.tool(server, 'list_projects', '이슈보드의 전체 프로젝트 목록을 반환한다.', {}, async () =>
      json(await this.projects.list()),
    );

    this.tool(
      server,
      'list_applications',
      '프로젝트의 애플리케이션(전달 표면) 목록을 반환한다. 한 프로젝트가 추노앱·백오피스처럼 여러 앱으로 나뉠 때 각 앱의 id·key·name·순서를 준다.',
      { projectId: z.string() },
      async (args) =>
        json(await this.applications.listByProject(args.projectId as string)),
    );

    this.tool(
      server,
      'get_project_context',
      '로컬 경로(cwd)로 프로젝트를 매칭해 애플리케이션·기획·이슈·와이어프레임 요약을 반환한다. 다른 세션에서 프로젝트를 이어받을 때 사용. 한 프로젝트에 여러 앱(전달 표면)이 있으면 applications로 구분되며, 기획·이슈·와이어프레임의 applicationId가 소속 앱을 가리킨다(도메인은 앱 공유). 응답의 guard는 기획 확정 가드 신호다 — approved가 아닌 기획의 이슈는 착수(코드 작성)하면 안 된다.',
      { repoPath: z.string().describe('프로젝트 로컬 절대 경로 (cwd)') },
      async (args) => {
        const repoPath = args.repoPath as string;
        const project = await this.projects.findByRepoPath(repoPath);
        if (!project) {
          return json({
            matched: false,
            message: `repoPath=${repoPath} 로 등록된 프로젝트가 없습니다. create_project로 먼저 등록하세요.`,
          });
        }
        const [applications, plans, issues, wireframes, domains, design] =
          await Promise.all([
            this.applications.listByProject(project.id),
            this.plans.listByProject(project.id),
            this.issues.listByProject(project.id),
            this.wireframes.listByProject(project.id),
            this.domains.listByProject(project.id),
            this.designs.getByProject(project.id),
          ]);
        // 기획 확정 가드 신호: 승인되지 않은 기획의 이슈는 착수(코드 작성) 금지.
        const approvedPlans = plans.filter((p) => p.status === 'approved');
        const unapprovedPlans = plans.filter((p) => p.status !== 'approved');
        const guard = {
          codeReady: approvedPlans.length > 0,
          rule: '기획이 approved가 아닌 이슈는 착수(코드 작성)하지 마라. unapprovedPlans에 속한(planId가 일치하는) 이슈는 update_issue_status(in_progress/done)를 서버가 거부한다. 확정이 필요하면 사용자에게 알려라.',
          approvedPlanIds: approvedPlans.map((p) => p.id),
          unapprovedPlans: unapprovedPlans.map((p) => ({
            id: p.id,
            title: p.title,
            status: p.status,
          })),
        };
        return json({
          matched: true,
          project,
          applications,
          plans,
          issues,
          wireframes,
          domains,
          design,
          guard,
        });
      },
    );

    this.tool(
      server,
      'get_plan',
      '특정 기획서 본문을 반환한다.',
      { planId: z.string() },
      async (args) => json(await this.plans.get(args.planId as string)),
    );

    this.tool(
      server,
      'list_issues',
      '프로젝트의 이슈 목록을 반환한다.',
      { projectId: z.string() },
      async (args) =>
        json(await this.issues.listByProject(args.projectId as string)),
    );

    this.tool(
      server,
      'get_issue',
      '특정 이슈 하나를 반환한다 (본문·상태·연동 정보 포함). 응답에는 사람이 읽는 키(key, 예: CH-12)가 포함된다.',
      {
        issueId: z
          .string()
          .describe('이슈 id(cuid) 또는 사람 키(예: CH-12) 둘 다 가능'),
      },
      async (args) => json(await this.issues.get(args.issueId as string)),
    );

    this.tool(
      server,
      'list_wireframes',
      '프로젝트의 와이어프레임 목록을 반환한다 (IA 순서/버전 포함, 조회 전용).',
      { projectId: z.string() },
      async (args) =>
        json(await this.wireframes.listByProject(args.projectId as string)),
    );

    this.tool(
      server,
      'get_wireframe',
      '특정 와이어프레임을 반환한다 (조회 전용).',
      { wireframeId: z.string() },
      async (args) =>
        json(await this.wireframes.get(args.wireframeId as string)),
    );

    this.tool(
      server,
      'list_domains',
      '프로젝트의 도메인(엔티티) 목록을 반환한다 (컬럼·생명주기 포함).',
      { projectId: z.string() },
      async (args) =>
        json(await this.domains.listByProject(args.projectId as string)),
    );

    this.tool(
      server,
      'get_domain',
      '특정 도메인 하나를 반환한다 (컬럼·제약·상태 흐름 포함).',
      { domainId: z.string() },
      async (args) => json(await this.domains.get(args.domainId as string)),
    );

    this.tool(
      server,
      'get_daily_activity',
      '프로젝트의 하루치 활동(변경 이력)을 요약해 반환한다. 일일 업무 요약(ib-daily) 생성의 원천 데이터. date 생략 시 timezone 기준 오늘. 응답은 total·byEntity·byAction·bySource 집계와 activities(최신순: entityType/action/title/changes/source/createdAt)를 포함한다.',
      {
        projectId: z.string(),
        date: z
          .string()
          .optional()
          .describe('대상 날짜 YYYY-MM-DD (생략 시 timezone 기준 오늘)'),
        timezone: z
          .string()
          .optional()
          .describe('IANA 타임존 (기본 Asia/Seoul)'),
      },
      async (args) =>
        json(
          await this.activity.daily(
            args.projectId as string,
            args.date as string | undefined,
            args.timezone as string | undefined,
          ),
        ),
    );

    this.tool(
      server,
      'delete_wireframe',
      '특정 와이어프레임(버전)을 삭제한다. 되돌릴 수 없으므로 사용자가 명시적으로 요청할 때만 사용하라. 생성/재생성 과정에서 자동으로 호출하지 마라.',
      { wireframeId: z.string() },
      async (args) => {
        await this.wireframes.remove(args.wireframeId as string);
        return json({ deleted: args.wireframeId as string });
      },
    );
  }

  private registerWriteTools(server: McpServer): void {
    this.tool(
      server,
      'create_project',
      '새 프로젝트를 등록한다. repoPath를 함께 주면 이후 다른 세션이 cwd로 매칭할 수 있다.',
      {
        name: z.string(),
        description: z.string().optional(),
        repoPath: z.string().optional().describe('프로젝트 로컬 절대 경로'),
      },
      async (args) =>
        json(
          await this.projects.create({
            name: args.name as string,
            description: args.description as string | undefined,
            repoPath: args.repoPath as string | undefined,
          }),
        ),
    );

    this.tool(
      server,
      'create_application',
      '프로젝트 안에 애플리케이션(전달 표면)을 만든다. key 기준 upsert — 같은 key로 다시 호출하면 갱신. 한 프로젝트에 여러 앱(예: 추노앱=chuno-app, 백오피스=backoffice)이 있을 때 기획·와이어프레임·이슈를 이 앱으로 묶는다. 반환된 id를 create_plan/create_wireframe/create_issue의 applicationId로 넘겨라. 도메인(데이터 모델)은 앱이 공유하므로 앱에 묶지 않는다.',
      {
        projectId: z.string(),
        key: z
          .string()
          .describe('안정적 식별 키 (kebab-case, 예: chuno-app, backoffice)'),
        name: z.string().describe('표시 이름 (예: 추노앱, 백오피스)'),
        description: z.string().optional(),
        sequence: z
          .number()
          .int()
          .optional()
          .describe('앱 스위처 표시 순서(낮을수록 앞). 생략 시 맨 뒤.'),
        issuePrefix: z
          .string()
          .optional()
          .describe(
            '이슈 키 접두사 (대문자 2~4자, 예: CH). 프로젝트 내 유일. 이 앱의 이슈는 "<접두사>-<번호>"(예: CH-12) 키를 받는다. 새 앱이면 사용자에게 어떤 접두사를 쓸지 물어서 넘겨라. 생략 시 이름에서 도출.',
          ),
      },
      async (args) =>
        json(
          await this.applications.upsert(args.projectId as string, {
            key: args.key as string,
            name: args.name as string,
            description: args.description as string | undefined,
            sequence: args.sequence as number | undefined,
            issuePrefix: args.issuePrefix as string | undefined,
          }),
        ),
    );

    this.tool(
      server,
      'delete_project',
      '프로젝트를 삭제한다. 소속 애플리케이션·기획·이슈·도메인·와이어프레임·디자인·활동로그가 모두 함께 삭제되며 되돌릴 수 없다. 반드시 사용자가 명시적으로 요청할 때만 사용하라. 생성/재생성 과정에서 자동으로 호출하지 마라.',
      { projectId: z.string() },
      async (args) => {
        await this.projects.remove(args.projectId as string);
        return json({ deleted: args.projectId as string });
      },
    );

    this.tool(
      server,
      'delete_application',
      '애플리케이션(전달 표면)을 삭제한다. 되돌릴 수 없다. 소속 기획·와이어프레임·이슈는 삭제되지 않고 앱 연결만 해제(applicationId=null)된다. 반드시 사용자가 명시적으로 요청할 때만 사용하라. 생성/재생성 과정에서 자동으로 호출하지 마라.',
      { applicationId: z.string() },
      async (args) => {
        await this.applications.remove(args.applicationId as string);
        return json({ deleted: args.applicationId as string });
      },
    );

    this.tool(
      server,
      'create_plan',
      '기획서(마크다운)를 프로젝트에 적재한다. 프로젝트에 여러 앱이 있으면 applicationId로 소속 앱을 지정한다.',
      {
        projectId: z.string(),
        title: z.string(),
        content: z.string().describe('마크다운 기획서 본문'),
        applicationId: z
          .string()
          .optional()
          .describe('소속 애플리케이션 id (create_application 반환값). 단일 앱이면 생략 가능.'),
      },
      async (args) =>
        json(
          await this.plans.create(args.projectId as string, {
            title: args.title as string,
            content: args.content as string,
            applicationId: args.applicationId as string | undefined,
          }),
        ),
    );

    this.tool(
      server,
      'create_wireframe',
      'HTML 와이어프레임을 적재한다 (조회 전용 아티팩트). sequence로 IA(정보구조) 순서를 지정하면 대시보드 왼쪽 네비가 그 순서로 정렬한다.',
      {
        projectId: z.string(),
        name: z.string(),
        content: z.string().describe('와이어프레임 원본 (기본 HTML)'),
        format: z.enum(WIREFRAME_FORMAT).optional(),
        sequence: z
          .number()
          .int()
          .optional()
          .describe(
            'IA 순서(낮을수록 위, 0부터). 생략 시 같은 name의 기존 순서를 잇고, 신규면 맨 뒤.',
          ),
        applicationId: z
          .string()
          .optional()
          .describe(
            '소속 애플리케이션 id. 여러 앱이 있으면 화면이 어느 앱인지 지정한다. 같은 name 재생성 시 생략하면 이전 앱을 상속.',
          ),
      },
      async (args) =>
        json(
          await this.wireframes.create(args.projectId as string, {
            name: args.name as string,
            content: args.content as string,
            format: args.format as WireframeFormat | undefined,
            sequence: args.sequence as number | undefined,
            applicationId: args.applicationId as string | undefined,
          }),
        ),
    );

    this.tool(
      server,
      'create_domain',
      '도메인(엔티티/테이블) 정의를 적재한다. 이름 기준 upsert — 같은 이름으로 다시 호출하면 갱신된다. 첫 설계는 status를 생략해 draft(초안)로 둔다. columns는 {name,type,constraints?,description?} 배열. status(state) 컬럼이 있는 엔티티는 lifecycle에 상태 전이(from→to, on=이벤트)를 넣으면 대시보드가 상태 흐름도(mermaid)를 그린다.',
      {
        projectId: z.string(),
        name: z.string(),
        description: z.string().optional(),
        columns: z
          .array(
            z.object({
              name: z.string(),
              type: z.string(),
              constraints: z
                .string()
                .optional()
                .describe('PK, FK→User, NN, UQ 등'),
              description: z.string().optional(),
            }),
          )
          .describe('컬럼 정의 배열'),
        lifecycle: z
          .object({
            states: z
              .array(
                z.object({
                  name: z.string(),
                  description: z.string().optional(),
                }),
              )
              .optional()
              .describe('상태 목록(설명/순서 보존용, 선택)'),
            transitions: z
              .array(
                z.object({
                  from: z
                    .string()
                    .describe('출발 상태명. 초기 진입은 "[*]"'),
                  to: z.string().describe('도착 상태명. 종료는 "[*]"'),
                  on: z
                    .string()
                    .optional()
                    .describe('전이를 유발하는 이벤트/액션 라벨'),
                }),
              )
              .describe('상태 전이 목록'),
          })
          .nullish()
          .describe(
            '상태 생명주기. 상태(status/state)를 갖는 엔티티만. 대시보드가 mermaid stateDiagram으로 렌더한다. 재호출 시 미지정이면 기존 유지, null이면 제거.',
          ),
        status: z.enum(DOMAIN_STATUS).optional().describe('생략 시 draft(초안)'),
      },
      async (args) =>
        json(
          await this.domains.upsert(args.projectId as string, {
            name: args.name as string,
            description: args.description as string | undefined,
            columns: args.columns as DomainColumn[],
            lifecycle: args.lifecycle as DomainLifecycle | null | undefined,
            status: args.status as DomainStatus | undefined,
          }),
        ),
    );

    this.tool(
      server,
      'delete_domain',
      '특정 도메인을 삭제한다. 되돌릴 수 없으므로 사용자가 명시적으로 요청할 때만 사용하라.',
      { domainId: z.string() },
      async (args) => {
        await this.domains.remove(args.domainId as string);
        return json({ deleted: args.domainId as string });
      },
    );

    this.tool(
      server,
      'create_design',
      '프로젝트의 디자인 시스템을 적재한다(프로젝트당 하나, upsert). 메인 컬러에서 도출한 전체 토큰(brand/neutral/semantic/타이포/간격/라운드)을 넣는다. 색은 hex(#RRGGBB). 첫 설계는 status 생략해 draft.',
      {
        projectId: z.string(),
        tokens: z.object({
          brand: z.object({
            main: z.string(),
            mainHover: z.string(),
            mainSoft: z.string(),
            sub: z.string(),
            subSoft: z.string(),
          }),
          neutral: z.object({
            bg: z.string(),
            surface: z.string(),
            surface2: z.string(),
            border: z.string(),
            text: z.string(),
            muted: z.string(),
          }),
          semantic: z.object({
            success: z.string(),
            warning: z.string(),
            danger: z.string(),
            info: z.string(),
          }),
          fontHeading: z.string(),
          fontBody: z.string(),
          typeScale: z.array(
            z.object({
              name: z.string(),
              size: z.number(),
              weight: z.number(),
              lineHeight: z.number(),
            }),
          ),
          spacing: z.array(z.number()),
          radius: z.object({
            sm: z.number(),
            md: z.number(),
            lg: z.number(),
            full: z.number(),
          }),
          mood: z.string().optional(),
        }),
        status: z.enum(DOMAIN_STATUS).optional(),
      },
      async (args) =>
        json(
          await this.designs.upsert(args.projectId as string, {
            tokens: args.tokens as DesignTokens,
            status: args.status as DomainStatus | undefined,
          }),
        ),
    );

    this.tool(
      server,
      'get_design',
      '프로젝트의 디자인 시스템(토큰)을 반환한다. 없으면 null.',
      { projectId: z.string() },
      async (args) =>
        json(await this.designs.getByProject(args.projectId as string)),
    );

    this.tool(
      server,
      'create_issue',
      '이슈를 등록한다. type으로 에픽(상위)/태스크(하위)를 명시한다(에픽=type "epic", 하위 작업=type "task", 기본 task). parentId로 이슈 트리를 구성한다. planId로 파생 기획을, screenId로 관련 와이어프레임 화면(data-screen id)을, domainId로 관련 도메인을 연동한다.',
      {
        projectId: z.string(),
        title: z.string(),
        body: z.string(),
        type: z.enum(ISSUE_TYPE).optional().describe('epic 또는 task (기본 task)'),
        value: z
          .enum(ISSUE_LEVEL)
          .optional()
          .describe('가치 low/medium/high — 우선순위는 value/effort로 산출됨'),
        effort: z
          .enum(ISSUE_LEVEL)
          .optional()
          .describe('노력 low/medium/high'),
        priority: z.enum(ISSUE_PRIORITY).optional(),
        labels: z.array(z.string()).optional(),
        parentId: z
          .string()
          .optional()
          .describe('부모 에픽의 id(cuid) 또는 사람 키(예: CH-1)'),
        planId: z.string().optional().describe('파생된 기획의 id'),
        screenId: z
          .string()
          .optional()
          .describe('관련 화면 — 클릭스루 프로토타입의 data-screen 값'),
        domainId: z.string().optional().describe('관련 도메인의 id'),
        applicationId: z
          .string()
          .optional()
          .describe('소속 애플리케이션 id. 보통 연동한 기획(planId)의 앱과 같다.'),
      },
      async (args) =>
        json(
          await this.issues.create(args.projectId as string, {
            title: args.title as string,
            body: args.body as string,
            type: args.type as IssueType | undefined,
            value: args.value as IssueLevel | undefined,
            effort: args.effort as IssueLevel | undefined,
            priority: args.priority as IssuePriority | undefined,
            labels: args.labels as string[] | undefined,
            parentId: args.parentId as string | undefined,
            planId: args.planId as string | undefined,
            screenId: args.screenId as string | undefined,
            domainId: args.domainId as string | undefined,
            applicationId: args.applicationId as string | undefined,
          }),
        ),
    );

    this.tool(
      server,
      'update_issue_status',
      '이슈 상태를 전이한다 (todo→in_progress→done 등). 코딩 진행에 따라 호출. ⚠️ 기획 확정 가드: 이슈의 기획이 approved가 아니면 in_progress/done 전이가 거부된다 — 확정된 기획의 이슈만 착수(코드 작성)할 수 있다.',
      {
        issueId: z
          .string()
          .describe('이슈 id(cuid) 또는 사람 키(예: CH-12) 둘 다 가능'),
        status: z.enum(ISSUE_STATUS),
      },
      async (args) => {
        const status = args.status as IssueStatus;
        // 기획 확정 가드: 미승인 기획의 이슈는 착수/완료할 수 없다.
        if (status === 'in_progress' || status === 'done') {
          await this.issues.assertPlanApproved(args.issueId as string);
        }
        return json(
          await this.issues.update(args.issueId as string, { status }),
        );
      },
    );

    this.tool(
      server,
      'link_issue',
      '기존 이슈에 파생 기획(planId)·관련 화면(screenId)·관련 도메인(domainId)을 연동한다. 링크를 소급 보강할 때 사용. 주지 않은 필드는 그대로 유지된다.',
      {
        issueId: z.string(),
        planId: z.string().optional().describe('파생된 기획의 id'),
        screenId: z
          .string()
          .optional()
          .describe('관련 화면 — 프로토타입의 data-screen 값'),
        domainId: z.string().optional().describe('관련 도메인의 id'),
      },
      async (args) =>
        json(
          await this.issues.update(args.issueId as string, {
            planId: args.planId as string | undefined,
            screenId: args.screenId as string | undefined,
            domainId: args.domainId as string | undefined,
          }),
        ),
    );

    this.tool(
      server,
      'update_issue',
      '이슈의 제목·본문·타입(epic/task)·가치(value)·노력(effort)·라벨·부모를 수정한다. value/effort를 바꾸면 우선순위가 자동 재산출된다. (상태 변경은 update_issue_status, 연동은 link_issue.) 주지 않은 필드는 유지된다.',
      {
        issueId: z.string(),
        title: z.string().optional(),
        body: z.string().optional(),
        type: z.enum(ISSUE_TYPE).optional().describe('epic 또는 task'),
        value: z.enum(ISSUE_LEVEL).optional().describe('가치 low/medium/high'),
        effort: z.enum(ISSUE_LEVEL).optional().describe('노력 low/medium/high'),
        priority: z.enum(ISSUE_PRIORITY).optional(),
        labels: z.array(z.string()).optional(),
        parentId: z.string().optional(),
      },
      async (args) =>
        json(
          await this.issues.update(args.issueId as string, {
            title: args.title as string | undefined,
            body: args.body as string | undefined,
            type: args.type as IssueType | undefined,
            value: args.value as IssueLevel | undefined,
            effort: args.effort as IssueLevel | undefined,
            priority: args.priority as IssuePriority | undefined,
            labels: args.labels as string[] | undefined,
            parentId: args.parentId as string | undefined,
          }),
        ),
    );

    this.tool(
      server,
      'delete_issue',
      '이슈를 삭제한다. 되돌릴 수 없으므로 사용자가 명시적으로 요청할 때만 사용하라. 생성/진행 과정에서 자동으로 호출하지 마라.',
      { issueId: z.string() },
      async (args) => {
        await this.issues.remove(args.issueId as string);
        return json({ deleted: args.issueId as string });
      },
    );

    this.tool(
      server,
      'update_plan',
      '기존 기획서 작업본을 수정한다(덮어쓰기). 초안 편집은 버전을 쌓지 않아 잦은 수정에 효율적이다. status를 "approved"로 바꾸면 그 시점이 자동으로 마일스톤 버전이 된다. 기획 개정은 create_plan(새 기획)이 아니라 이 툴을 써라. 주지 않은 필드는 유지된다.',
      {
        planId: z.string(),
        title: z.string().optional(),
        content: z.string().optional().describe('마크다운 기획서 본문(전체 교체)'),
        status: z.enum(PLAN_STATUS).optional(),
      },
      async (args) =>
        json(
          await this.plans.update(args.planId as string, {
            title: args.title as string | undefined,
            content: args.content as string | undefined,
            status: args.status as PlanStatus | undefined,
          }),
        ),
    );

    this.tool(
      server,
      'snapshot_plan',
      '현재 기획 작업본을 마일스톤 버전으로 고정한다(이력에 새 버전 추가). **승인된(approved) 기획만 대상** — 초안(draft)은 이력을 남기지 않는다(확정 후 사용). 승인본의 의미 있는 시점(범위 확정 등)에만 사용하라.',
      {
        planId: z.string(),
        label: z.string().optional().describe('버전 이름/사유 (예: "MVP 범위 확정")'),
      },
      async (args) =>
        json(
          await this.plans.createSnapshot(
            args.planId as string,
            args.label as string | undefined,
          ),
        ),
    );

    this.tool(
      server,
      'append_plan_note',
      '기획서 하단에 진행 메모를 덧붙인다.',
      { planId: z.string(), note: z.string() },
      async (args) => {
        const planId = args.planId as string;
        const plan = await this.plans.get(planId);
        const updated = await this.plans.update(planId, {
          content: `${plan.content}\n\n---\n${args.note as string}`,
        });
        return json(updated);
      },
    );
  }
}
