import { Injectable } from '@nestjs/common';
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { z, type ZodRawShape } from 'zod';
import {
  ISSUE_STATUS,
  ISSUE_PRIORITY,
  WIREFRAME_FORMAT,
  DOMAIN_STATUS,
  PLAN_STATUS,
  type IssueStatus,
  type IssuePriority,
  type WireframeFormat,
  type DomainStatus,
  type DomainColumn,
  type DomainLifecycle,
  type PlanStatus,
} from '@issue-board/shared';
import { ProjectsService } from '../projects/projects.service';
import { PlansService } from '../plans/plans.service';
import { IssuesService } from '../issues/issues.service';
import { WireframesService } from '../wireframes/wireframes.service';
import { DomainsService } from '../domains/domains.service';

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
    private readonly plans: PlansService,
    private readonly issues: IssuesService,
    private readonly wireframes: WireframesService,
    private readonly domains: DomainsService,
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
      'get_project_context',
      '로컬 경로(cwd)로 프로젝트를 매칭해 기획·이슈·와이어프레임 요약을 반환한다. 다른 세션에서 프로젝트를 이어받을 때 사용.',
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
        const [plans, issues, wireframes, domains] = await Promise.all([
          this.plans.listByProject(project.id),
          this.issues.listByProject(project.id),
          this.wireframes.listByProject(project.id),
          this.domains.listByProject(project.id),
        ]);
        return json({
          matched: true,
          project,
          plans,
          issues,
          wireframes,
          domains,
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
      'get_wireframe',
      '특정 와이어프레임을 반환한다 (조회 전용).',
      { wireframeId: z.string() },
      async (args) =>
        json(await this.wireframes.get(args.wireframeId as string)),
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
      'create_plan',
      '기획서(마크다운)를 프로젝트에 적재한다.',
      {
        projectId: z.string(),
        title: z.string(),
        content: z.string().describe('마크다운 기획서 본문'),
      },
      async (args) =>
        json(
          await this.plans.create(args.projectId as string, {
            title: args.title as string,
            content: args.content as string,
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
      },
      async (args) =>
        json(
          await this.wireframes.create(args.projectId as string, {
            name: args.name as string,
            content: args.content as string,
            format: args.format as WireframeFormat | undefined,
            sequence: args.sequence as number | undefined,
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
      'create_issue',
      '이슈를 등록한다. parentId로 이슈 트리(기획→분리)를 구성한다. planId로 파생 기획을, screenId로 관련 와이어프레임 화면(data-screen id)을, domainId로 관련 도메인을 연동한다.',
      {
        projectId: z.string(),
        title: z.string(),
        body: z.string(),
        priority: z.enum(ISSUE_PRIORITY).optional(),
        labels: z.array(z.string()).optional(),
        parentId: z.string().optional(),
        planId: z.string().optional().describe('파생된 기획의 id'),
        screenId: z
          .string()
          .optional()
          .describe('관련 화면 — 클릭스루 프로토타입의 data-screen 값'),
        domainId: z.string().optional().describe('관련 도메인의 id'),
      },
      async (args) =>
        json(
          await this.issues.create(args.projectId as string, {
            title: args.title as string,
            body: args.body as string,
            priority: args.priority as IssuePriority | undefined,
            labels: args.labels as string[] | undefined,
            parentId: args.parentId as string | undefined,
            planId: args.planId as string | undefined,
            screenId: args.screenId as string | undefined,
            domainId: args.domainId as string | undefined,
          }),
        ),
    );

    this.tool(
      server,
      'update_issue_status',
      '이슈 상태를 전이한다 (todo→in_progress→done 등). 코딩 진행에 따라 호출.',
      { issueId: z.string(), status: z.enum(ISSUE_STATUS) },
      async (args) =>
        json(
          await this.issues.update(args.issueId as string, {
            status: args.status as IssueStatus,
          }),
        ),
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
      '현재 기획 작업본을 마일스톤 버전으로 고정한다(이력에 새 버전 추가). 의미 있는 시점(초안 확정, 범위 확정 등)에만 사용하라.',
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
