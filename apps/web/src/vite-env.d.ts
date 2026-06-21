/// <reference types="vite/client" />

interface ImportMetaEnv {
  /** Backend API base URL incl. /api prefix; unset in dev (Vite proxy handles it). */
  readonly VITE_API_URL?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
