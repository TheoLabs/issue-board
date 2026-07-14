/// <reference types="vite/client" />

interface ImportMetaEnv {
  /** 구글 드라이브 업로드용 OAuth 웹 클라이언트 ID (공개값) */
  readonly VITE_GOOGLE_CLIENT_ID?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
