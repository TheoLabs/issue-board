import { useCallback, useEffect, useState } from 'react';

export type Theme = 'light' | 'dark';

const STORAGE_KEY = 'issue-board:theme';

/**
 * 첫 페인트 전에 index.html 인라인 스크립트가 `html[data-theme]`를 설정한다(FOUC 방지).
 * 여기서는 그 값을 읽어 초기 상태로 삼는다.
 */
export function getInitialTheme(): Theme {
  const attr = document.documentElement.dataset.theme;
  return attr === 'light' ? 'light' : 'dark';
}

/** [현재 테마, 토글 함수]를 반환. 변경 시 html[data-theme] + localStorage에 반영한다. */
export function useTheme(): [Theme, () => void] {
  const [theme, setTheme] = useState<Theme>(getInitialTheme);

  useEffect(() => {
    document.documentElement.dataset.theme = theme;
    try {
      localStorage.setItem(STORAGE_KEY, theme);
    } catch {
      // localStorage 접근 불가(프라이빗 모드 등) 시 무시 — 화면 전환은 정상 동작
    }
  }, [theme]);

  const toggle = useCallback(
    () => setTheme((t) => (t === 'dark' ? 'light' : 'dark')),
    [],
  );

  return [theme, toggle];
}
