import { defineConfig } from 'vite'

// GitHub Pages では https://bubbleshaker.github.io/depth-driller/ の下に置かれる。
// asset の URL をそのサブパス起点にしないと、公開後だけ真っ白になる
export default defineConfig({
  base: '/depth-driller/',
})
