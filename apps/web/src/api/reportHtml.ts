/**
 * 일일 요약 마크다운 → HTML 문자열.
 *
 * 대시보드가 이미 쓰는 렌더러(react-markdown + remark-gfm)를 그대로
 * `renderToStaticMarkup`으로 문자열화한다. 새 의존성 없이 화면과 동일한 렌더 결과를 얻고,
 * GFM 표는 `<table>`이 되어 구글 드라이브가 **네이티브 Docs 표**로 변환한다.
 */
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';

/** 마크다운을 완결형 HTML 문서로 변환한다(드라이브 Docs 변환 입력용). */
export function reportMarkdownToHtml(markdown: string): string {
  const inner = renderToStaticMarkup(
    createElement(ReactMarkdown, { remarkPlugins: [remarkGfm] }, markdown),
  );
  // 표에 옅은 테두리를 줘 Docs 변환 시에도 셀 경계가 유지되게 한다.
  return (
    '<!DOCTYPE html><html><head><meta charset="utf-8">' +
    '<style>' +
    'table{border-collapse:collapse}' +
    'th,td{border:1px solid #999;padding:6px 10px;vertical-align:top}' +
    'th{background:#f1f3f4;text-align:left}' +
    '</style></head><body>' +
    inner +
    '</body></html>'
  );
}
