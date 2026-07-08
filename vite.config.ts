import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { fileURLToPath, URL } from 'node:url'

// 이 워크트리의 node_modules 전체가 메인 catchap-frontend를 가리키는 심링크(junction)다.
// JS 모듈은 Vite transform이 심링크를 따라가지만, 폰트 등 정적 에셋(/@fs)은 realpath가
// 메인 dir로 풀려 기본 server.fs.allow(워크트리 루트) 밖이 되어 403 → phosphor 아이콘 전체가 깨진다.
// 워크트리 루트와 메인 catchap-frontend 루트를 모두 허용해 심링크 대상 에셋을 서빙한다.
const worktreeRoot = fileURLToPath(new URL('.', import.meta.url))
const mainRoot = fileURLToPath(new URL('../../../', import.meta.url))

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  server: {
    fs: {
      allow: [worktreeRoot, mainRoot],
    },
  },
})
