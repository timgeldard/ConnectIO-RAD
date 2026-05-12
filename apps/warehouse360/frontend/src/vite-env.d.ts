/* eslint-disable jsdoc/require-jsdoc */
/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_WAREHOUSE360_API_BASE?: string
}

interface ImportMeta {
  readonly env: ImportMetaEnv
}
