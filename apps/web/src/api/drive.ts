/**
 * 구글 드라이브 업로드 (브라우저 직결, client_secret 불필요).
 *
 * Google Identity Services(GIS) 토큰 클라이언트로 `drive.file` 스코프 access_token 을
 * 받아 브라우저에서 Drive REST 를 직접 호출한다. 서버·refresh_token·DB 가 필요 없다.
 *
 * 필요한 설정: 웹 앱 OAuth 클라이언트 ID 하나(공개값). Vite 환경변수
 *   VITE_GOOGLE_CLIENT_ID
 * 로 주입한다. 승인된 JavaScript 원본에 이 앱의 origin(예: http://localhost:5173)을 등록해야 한다.
 *
 * 폴더 구조: 루트 `이슈보드 일일요약` / `{프로젝트명}` / 날짜별 Google Docs 문서.
 * 같은 날짜 문서가 있으면 새로 만들지 않고 내용을 갱신(덮어쓰기)한다.
 */

const SCOPE = 'https://www.googleapis.com/auth/drive.file';
const ROOT_FOLDER = '이슈보드 일일요약';
const GIS_SRC = 'https://accounts.google.com/gsi/client';
const FOLDER_MIME = 'application/vnd.google-apps.folder';
const DOC_MIME = 'application/vnd.google-apps.document';

export interface DriveUploadResult {
  webViewLink: string;
  fileId: string;
  /** 같은 날짜 문서를 갱신했는지(true) 새로 만들었는지(false) */
  updated: boolean;
}

// ── GIS 타입 (사용하는 부분만 최소 선언) ────────────────────────────
interface TokenResponse {
  access_token?: string;
  error?: string;
  error_description?: string;
}
interface TokenClient {
  requestAccessToken: (overrides?: { prompt?: string }) => void;
  callback: (resp: TokenResponse) => void;
}
interface GoogleOAuth2 {
  initTokenClient: (config: {
    client_id: string;
    scope: string;
    prompt?: string;
    callback: (resp: TokenResponse) => void;
    error_callback?: (err: { type?: string; message?: string }) => void;
  }) => TokenClient;
}
declare global {
  interface Window {
    google?: { accounts?: { oauth2?: GoogleOAuth2 } };
  }
}

/** 설정된 클라이언트 ID(없으면 빈 문자열). UI 가 연동 가능 여부 판단에 쓴다. */
export const GOOGLE_CLIENT_ID: string =
  (import.meta.env.VITE_GOOGLE_CLIENT_ID as string | undefined) ?? '';

// 세션 내 access_token 캐시 (만료 여유 60초)
let cachedToken: { value: string; expiresAt: number } | null = null;

/** GIS 스크립트를 한 번만 로드한다. */
let gisPromise: Promise<GoogleOAuth2> | null = null;
function loadGis(): Promise<GoogleOAuth2> {
  if (gisPromise) return gisPromise;
  gisPromise = new Promise<GoogleOAuth2>((resolve, reject) => {
    const existing = window.google?.accounts?.oauth2;
    if (existing) return resolve(existing);
    const s = document.createElement('script');
    s.src = GIS_SRC;
    s.async = true;
    s.defer = true;
    s.onload = () => {
      const oauth2 = window.google?.accounts?.oauth2;
      if (oauth2) resolve(oauth2);
      else reject(new Error('구글 인증 스크립트 로드 실패'));
    };
    s.onerror = () => reject(new Error('구글 인증 스크립트를 불러오지 못했습니다'));
    document.head.appendChild(s);
  });
  return gisPromise;
}

/**
 * access_token 확보. 캐시가 유효하면 재사용, 아니면 GIS 팝업으로 새로 받는다.
 * 반드시 사용자 클릭(제스처) 안에서 호출해야 팝업이 차단되지 않는다.
 */
async function getAccessToken(): Promise<string> {
  if (!GOOGLE_CLIENT_ID) {
    throw new Error(
      'VITE_GOOGLE_CLIENT_ID 가 설정되지 않았습니다. 웹 앱 .env 에 구글 OAuth 클라이언트 ID를 넣어주세요.',
    );
  }
  const now = Date.now();
  if (cachedToken && cachedToken.expiresAt > now + 60_000) {
    return cachedToken.value;
  }
  const oauth2 = await loadGis();
  return new Promise<string>((resolve, reject) => {
    const client = oauth2.initTokenClient({
      client_id: GOOGLE_CLIENT_ID,
      scope: SCOPE,
      callback: (resp) => {
        if (resp.access_token) {
          // GIS 토큰 수명은 보통 3600초. 여유 있게 55분만 캐시.
          cachedToken = {
            value: resp.access_token,
            expiresAt: Date.now() + 55 * 60_000,
          };
          resolve(resp.access_token);
        } else {
          reject(
            new Error(
              resp.error_description || resp.error || '구글 인증이 취소되었습니다',
            ),
          );
        }
      },
      error_callback: (err) =>
        reject(new Error(err.message || '구글 인증에 실패했습니다')),
    });
    client.requestAccessToken();
  });
}

/** 연동 여부(설정된 클라이언트 ID 존재). 실제 토큰은 업로드 시점에 받는다. */
export function isDriveConfigured(): boolean {
  return Boolean(GOOGLE_CLIENT_ID);
}

// ── Drive REST 헬퍼 ──────────────────────────────────────────────
const DRIVE = 'https://www.googleapis.com/drive/v3';
const UPLOAD = 'https://www.googleapis.com/upload/drive/v3';

async function driveJson<T>(
  token: string,
  url: string,
  init?: RequestInit,
): Promise<T> {
  const res = await fetch(url, {
    ...init,
    headers: { Authorization: `Bearer ${token}`, ...init?.headers },
  });
  if (!res.ok) {
    const text = await res.text().catch(() => res.statusText);
    throw new Error(`Drive ${res.status}: ${text}`);
  }
  return res.json() as Promise<T>;
}

/** Drive 쿼리의 문자열 리터럴 내 작은따옴표 이스케이프 */
function q(v: string): string {
  return v.replace(/\\/g, '\\\\').replace(/'/g, "\\'");
}

/** name 폴더를 찾고 없으면 만든다(있으면 첫 번째 사용). drive.file 스코프라 앱이 만든 것만 보임. */
async function ensureFolder(
  token: string,
  name: string,
  parentId?: string,
): Promise<string> {
  const clauses = [
    `mimeType='${FOLDER_MIME}'`,
    `name='${q(name)}'`,
    'trashed=false',
  ];
  if (parentId) clauses.push(`'${q(parentId)}' in parents`);
  const query = encodeURIComponent(clauses.join(' and '));
  const found = await driveJson<{ files: { id: string }[] }>(
    token,
    `${DRIVE}/files?q=${query}&fields=files(id)&spaces=drive`,
  );
  if (found.files.length > 0) return found.files[0].id;

  const created = await driveJson<{ id: string }>(token, `${DRIVE}/files`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      name,
      mimeType: FOLDER_MIME,
      ...(parentId ? { parents: [parentId] } : {}),
    }),
  });
  return created.id;
}

/** 폴더 안에서 파일명이 일치하는 Google Docs 문서 id 를 찾는다(없으면 null). */
async function findDoc(
  token: string,
  name: string,
  parentId: string,
): Promise<string | null> {
  const query = encodeURIComponent(
    `name='${q(name)}' and '${q(parentId)}' in parents and mimeType='${DOC_MIME}' and trashed=false`,
  );
  const found = await driveJson<{ files: { id: string }[] }>(
    token,
    `${DRIVE}/files?q=${query}&fields=files(id)&spaces=drive`,
  );
  return found.files[0]?.id ?? null;
}

const BOUNDARY = 'ib-daily-boundary-7f3a';

/** 마크다운을 새 Google Docs 문서로 생성(멀티파트 업로드 + 변환). */
async function createDoc(
  token: string,
  name: string,
  parentId: string,
  markdown: string,
): Promise<{ id: string; webViewLink: string }> {
  const metadata = { name, parents: [parentId], mimeType: DOC_MIME };
  const body =
    `--${BOUNDARY}\r\n` +
    'Content-Type: application/json; charset=UTF-8\r\n\r\n' +
    `${JSON.stringify(metadata)}\r\n` +
    `--${BOUNDARY}\r\n` +
    'Content-Type: text/markdown; charset=UTF-8\r\n\r\n' +
    `${markdown}\r\n` +
    `--${BOUNDARY}--`;
  return driveJson(
    token,
    `${UPLOAD}/files?uploadType=multipart&fields=id,webViewLink`,
    {
      method: 'POST',
      headers: { 'Content-Type': `multipart/related; boundary=${BOUNDARY}` },
      body,
    },
  );
}

/** 기존 문서 내용을 마크다운으로 교체(재변환). */
async function updateDoc(
  token: string,
  fileId: string,
  markdown: string,
): Promise<{ id: string; webViewLink: string }> {
  return driveJson(
    token,
    `${UPLOAD}/files/${fileId}?uploadType=media&fields=id,webViewLink`,
    {
      method: 'PATCH',
      headers: { 'Content-Type': 'text/markdown; charset=UTF-8' },
      body: markdown,
    },
  );
}

/**
 * 일일 요약 마크다운을 드라이브에 올린다.
 * 루트/프로젝트 폴더를 보장하고, 같은 파일명이 있으면 갱신·없으면 생성한다.
 */
export async function uploadDailyReport(params: {
  projectName: string;
  fileName: string;
  markdown: string;
}): Promise<DriveUploadResult> {
  const token = await getAccessToken();
  const rootId = await ensureFolder(token, ROOT_FOLDER);
  const projectFolderId = await ensureFolder(token, params.projectName, rootId);
  const existing = await findDoc(token, params.fileName, projectFolderId);

  const doc = existing
    ? await updateDoc(token, existing, params.markdown)
    : await createDoc(
        token,
        params.fileName,
        projectFolderId,
        params.markdown,
      );

  return {
    fileId: doc.id,
    webViewLink: doc.webViewLink,
    updated: Boolean(existing),
  };
}
