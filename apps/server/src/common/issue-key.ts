// 이슈 키(CH-12) 유틸 — 접두사 도출 · 키 포맷 · 키 판별.

/** 사람 이슈 키 형식: 대문자 접두사 + '-' + 숫자 (예: CH-12, BO-3). */
export const ISSUE_KEY_RE = /^[A-Z][A-Z0-9]*-\d+$/;

/** ref가 cuid가 아니라 사람 키(CH-12)인지 판별. */
export function isIssueKey(ref: string): boolean {
  return ISSUE_KEY_RE.test(ref);
}

/** prefix + number → 키 문자열. */
export function formatKey(prefix: string, number: number): string {
  return `${prefix}-${number}`;
}

/**
 * 이름에서 이슈 키 접두사를 도출한다 (대문자 2~4자, `taken`과 겹치지 않게).
 * ASCII 영문이 부족하면(한글 전용 등) 'APP'으로 폴백한다.
 * 명시 접두사를 못 받은 경로(기본 앱 자동 생성·백필)에서만 쓴다 — 보통은 사용자가 고른다.
 */
export function derivePrefix(name: string, taken: Set<string> = new Set()): string {
  const letters = (name.match(/[A-Za-z]+/g) ?? []).join('');
  let base = letters.slice(0, 4).toUpperCase();
  if (base.length < 2) base = 'APP';
  let candidate = base;
  let n = 2;
  while (taken.has(candidate)) candidate = `${base}${n++}`;
  return candidate;
}
