import path from 'path'
import { defineConfig } from 'vite'
import reactRefresh from '@vitejs/plugin-react-refresh'
import mpa from './src/plugins/vite-plugin-mpa/index.ts'
import { name as packageName } from './package.json'

// https://vitejs.dev/config/
export default defineConfig({
  // base: `/${packageName}/`,
  plugins: [reactRefresh(), mpa()],
  build: {
    // outDir: `dist/${packageName}/`, // Add this line to specify the output directory
    rollupOptions: {
      output: {
        manualChunks(id) {
          if (id.includes('node_modules')) {
              return id.toString().split('node_modules/')[1].split('/')[0].toString();
          }
        },
        chunkFileNames: 'static/js/[name].js',
        assetFileNames: (assetInfo) => {
          // 可以根据文件类型定义不同的输出路径
          if (assetInfo.name?.endsWith('.png') || assetInfo.name?.endsWith('.jpg')) {
              return 'static/images/[name][extname]'; // 将图片放到 images 文件夹
          }
          if (assetInfo.name?.endsWith('.css')) {
              return '[name]/[name][extname]'; // 将 CSS 文件放到 css 文件夹
          }
          // 默认的资源文件输出路径
          return 'static/[name][extname]';
        },
        entryFileNames: '[name]/[name].js',
      }
    }
  },
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
})
