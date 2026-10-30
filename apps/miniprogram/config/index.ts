import { defineConfig, type UserConfigExport } from '@tarojs/cli';
import path from 'node:path';

const miniEnvironment = process.env.TARO_APP_ENV ?? 'development';
const miniApiBaseUrl = process.env.TARO_APP_API_BASE_URL
  ?? (miniEnvironment === 'development' ? 'http://127.0.0.1:4000/api/v1' : '');

if (miniEnvironment !== 'development' && !/^https:\/\//.test(miniApiBaseUrl)) {
  throw new Error('非开发小程序构建必须配置 HTTPS 格式的 TARO_APP_API_BASE_URL');
}

const config: UserConfigExport = {
  projectName: 'atlas-miniprogram',
  date: '2026-08-23',
  designWidth: 390,
  deviceRatio: {
    390: 2,
    750: 1,
  },
  sourceRoot: 'src',
  outputRoot: 'dist',
  framework: 'react',
  alias: {
    // pnpm keeps Taro's React peer and the app dependency at different real
    // paths. Force every import, including renderer internals, to one module.
    react$: path.resolve(__dirname, '../node_modules/react'),
    'react/jsx-runtime$': path.resolve(__dirname, '../node_modules/react/jsx-runtime.js'),
    'react/jsx-dev-runtime$': path.resolve(__dirname, '../node_modules/react/jsx-dev-runtime.js'),
  },
  compiler: {
    type: 'webpack5',
    // Taro's development prebundle can create a second React instance in a
    // pnpm monorepo, which breaks every hook with `Invalid hook call` inside
    // WeChat DevTools. Keep one React runtime shared by pages and renderer.
    prebundle: { enable: false },
  },
  cache: { enable: false },
  plugins: [],
  env: {
    TARO_APP_API_BASE_URL: JSON.stringify(miniApiBaseUrl),
    TARO_APP_ENV: JSON.stringify(miniEnvironment),
    TARO_APP_RELEASE_VERSION: JSON.stringify(process.env.TARO_APP_RELEASE_VERSION ?? '0.0.2'),
    TARO_APP_PRIVACY_CONTACT: JSON.stringify(process.env.TARO_APP_PRIVACY_CONTACT ?? ''),
  },
  defineConstants: {},
  copy: { patterns: [], options: {} },
  mini: {
    compile: {
      // @atlas/core deliberately exposes TypeScript source so every platform
      // uses the same schemas and services. Taro must transpile this workspace
      // package in addition to the local src directory.
      include: [
        path.resolve(__dirname, '../../../packages/core/src'),
        path.resolve(__dirname, '../../../packages/contracts/src'),
        path.resolve(__dirname, '../../../packages/api-client/src'),
        path.resolve(__dirname, '../../../packages/sync-engine/src'),
      ],
    },
    postcss: {
      pxtransform: { enable: true, config: {} },
      url: { enable: true, config: { limit: 1024 } },
      cssModules: { enable: false },
    },
  },
};

export default defineConfig(config);
