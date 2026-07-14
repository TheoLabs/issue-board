import { Injectable, Logger } from '@nestjs/common';
import type {
  Activity,
  ActivityAction,
  ActivityEntity,
  ActivitySource,
  BoardEventType,
  DailySummary,
  FieldChange,
} from '@issue-board/shared';
import { ACTIVITY_ACTION, ACTIVITY_ENTITY, ACTIVITY_SOURCE } from '@issue-board/shared';
import type { ActivityLog as PrismaActivityLog } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { EventsService } from '../events/events.service';
import { currentSource } from '../common/request-context';

export interface RecordActivityInput {
  projectId: string;
  entityType: ActivityEntity;
  entityId: string;
  action: ActivityAction;
  /** 사람이 읽을 대상 이름/제목 */
  title: string;
  /** 변경 상세 { field: { from, to } } */
  changes?: Record<string, FieldChange> | null;
}

const DEFAULT_TZ = 'Asia/Seoul';

const EVENT_TYPE: Record<ActivityEntity, BoardEventType> = {
  project: 'project:updated',
  plan: 'plan:changed',
  issue: 'issue:changed',
  domain: 'domain:changed',
  wireframe: 'wireframe:changed',
  design: 'design:changed',
};

/**
 * 이슈보드 변경 이력을 남기고(ActivityLog) 동시에 대시보드용 SSE 이벤트를 쏜다.
 * 모든 write 서비스는 events.emit 대신 이 record 하나만 호출한다.
 * (docs/ARCHITECTURE.md — 활동 로그/일일 요약)
 */
@Injectable()
export class ActivityService {
  private readonly logger = new Logger(ActivityService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly events: EventsService,
  ) {}

  /** 변경 1건 기록 + SSE emit. 로깅 실패가 본 작업을 깨뜨리지 않도록 삼킨다. */
  async record(input: RecordActivityInput): Promise<void> {
    const source = currentSource();
    try {
      await this.prisma.activityLog.create({
        data: {
          projectId: input.projectId,
          entityType: input.entityType,
          entityId: input.entityId,
          action: input.action,
          title: input.title,
          changes: input.changes ? JSON.stringify(input.changes) : null,
          source,
        },
      });
    } catch (err) {
      this.logger.warn(
        `activity 기록 실패 (${input.entityType}/${input.action}): ${String(err)}`,
      );
    }
    this.events.emit({
      type: EVENT_TYPE[input.entityType],
      projectId: input.projectId,
      entityId: input.entityId,
    });
  }

  /** 특정 프로젝트의 하루치 활동 목록 (최신순, 원자 단위) */
  async listByDay(
    projectId: string,
    date: string,
    timezone: string,
  ): Promise<Activity[]> {
    const { from, to } = zonedDayRange(date, timezone);
    const rows = await this.prisma.activityLog.findMany({
      where: { projectId, createdAt: { gte: from, lt: to } },
      orderBy: { createdAt: 'desc' },
    });
    return rows.map(toActivity);
  }

  /** 하루치 업무 요약 (집계 + 활동 목록). date 미지정 시 timezone 기준 오늘. */
  async daily(
    projectId: string,
    date?: string,
    timezone: string = DEFAULT_TZ,
  ): Promise<DailySummary> {
    const day = date ?? todayInTz(timezone);
    const { from, to } = zonedDayRange(day, timezone);
    const activities = await this.listByDay(projectId, day, timezone);

    const byEntity = zero(ACTIVITY_ENTITY);
    const byAction = zero(ACTIVITY_ACTION);
    const bySource = zero(ACTIVITY_SOURCE);
    for (const a of activities) {
      byEntity[a.entityType]++;
      byAction[a.action]++;
      bySource[a.source]++;
    }

    return {
      projectId,
      date: day,
      timezone,
      from: from.toISOString(),
      to: to.toISOString(),
      total: activities.length,
      byEntity,
      byAction,
      bySource,
      activities,
    };
  }
}

function zero<T extends readonly string[]>(
  keys: T,
): Record<T[number], number> {
  const out = {} as Record<T[number], number>;
  for (const k of keys) out[k as T[number]] = 0;
  return out;
}

function toActivity(row: PrismaActivityLog): Activity {
  let changes: Record<string, FieldChange> | null = null;
  if (row.changes) {
    try {
      changes = JSON.parse(row.changes) as Record<string, FieldChange>;
    } catch {
      changes = null;
    }
  }
  return {
    id: row.id,
    projectId: row.projectId,
    entityType: row.entityType as ActivityEntity,
    entityId: row.entityId,
    action: row.action as ActivityAction,
    title: row.title,
    changes,
    source: row.source as ActivitySource,
    createdAt: row.createdAt.toISOString(),
  };
}

/** 타임존 tz에서의 오늘 날짜 (YYYY-MM-DD) */
function todayInTz(tz: string): string {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: tz,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(new Date());
}

/**
 * 타임존 tz에서 달력상 하루(date=YYYY-MM-DD)에 해당하는 UTC 구간 [from, to).
 * DST가 있는 존도 그 날 자정의 실제 오프셋으로 계산한다.
 */
function zonedDayRange(date: string, tz: string): { from: Date; to: Date } {
  const [y, m, d] = date.split('-').map(Number);
  // 해당 지역 자정을 우선 UTC로 가정한 뒤, 그 시점 tz 오프셋만큼 보정한다.
  const guess = Date.UTC(y, m - 1, d, 0, 0, 0);
  const offsetMs = tzOffsetMs(tz, new Date(guess));
  const from = new Date(guess - offsetMs);
  const to = new Date(from.getTime() + 24 * 60 * 60 * 1000);
  return { from, to };
}

/** 주어진 순간(at)에서 타임존 tz의 UTC 대비 오프셋(ms). KST면 +9h. */
function tzOffsetMs(tz: string, at: Date): number {
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone: tz,
    hourCycle: 'h23',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
  }).formatToParts(at);
  const g = (t: string): number =>
    Number(parts.find((p) => p.type === t)?.value ?? '0');
  const asIfUtc = Date.UTC(
    g('year'),
    g('month') - 1,
    g('day'),
    g('hour'),
    g('minute'),
    g('second'),
  );
  return asIfUtc - at.getTime();
}
