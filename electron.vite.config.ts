import { resolve } from 'path'
import { defineConfig, externalizeDepsPlugin } from 'electron-vite'
import react from '@vitejs/plugin-react'

export default defineConfig(() => {
  // 環境変数CUSTOM_ENV_PATHが設定されていればそれを使い、なければデフォルトパスを使用
  const envDir = process.env.CUSTOM_ENV_PATH ? resolve(process.env.CUSTOM_ENV_PATH) : resolve('.') // プロジェクトルート

  return {
    main: {
      plugins: [externalizeDepsPlugin()],
      envDir: envDir // メインプロセス用の環境変数ディレクトリ
    },
    preload: {
      plugins: [externalizeDepsPlugin()],
      envDir: envDir // プリロードプロセス用の環境変数ディレクトリ
    },
    renderer: {
      resolve: {
        alias: {
          '@renderer': resolve('src/renderer/src')
        }
      },
      plugins: [react()],
      envDir: envDir // レンダラープロセス用の環境変数ディレクトリ
    }
  }
})
