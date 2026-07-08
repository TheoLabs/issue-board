import type { Domain } from '@issue-board/shared';
import { Lifecycle } from './Lifecycle';

/** 도메인을 표로 렌더 (컬럼명 | 타입 | 제약 | 설명). 초안이면 배지 표시. */
export function DomainView({
  domain,
  onDelete,
}: {
  domain: Domain;
  onDelete: () => void;
}) {
  return (
    <div className="domain-view">
      <div className="domain-head">
        <h3>
          {domain.name}
          {domain.status === 'draft' && (
            <span className="badge draft-badge" title="초안 — 확정 전 설계">
              초안
            </span>
          )}
          {domain.status === 'approved' && (
            <span className="badge status-approved">확정</span>
          )}
        </h3>
        <button className="danger-btn" onClick={onDelete} title="도메인 삭제">
          삭제
        </button>
      </div>
      {domain.description && <p className="domain-desc">{domain.description}</p>}

      <div className="table-scroll">
        <table className="domain-table">
          <thead>
            <tr>
              <th>컬럼</th>
              <th>타입</th>
              <th>제약조건</th>
              <th>설명</th>
            </tr>
          </thead>
          <tbody>
            {domain.columns.map((c, i) => (
              <tr key={`${c.name}-${i}`}>
                <td className="col-name">{c.name}</td>
                <td className="col-type">{c.type}</td>
                <td className="col-constraints">{c.constraints ?? ''}</td>
                <td>{c.description ?? ''}</td>
              </tr>
            ))}
            {domain.columns.length === 0 && (
              <tr>
                <td colSpan={4} className="empty">
                  컬럼이 정의되지 않았습니다.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {domain.lifecycle && domain.lifecycle.transitions.length > 0 && (
        <div className="domain-lifecycle">
          <h4 className="domain-lifecycle-title">상태 흐름 (생명주기)</h4>
          <Lifecycle lifecycle={domain.lifecycle} />
        </div>
      )}
    </div>
  );
}
