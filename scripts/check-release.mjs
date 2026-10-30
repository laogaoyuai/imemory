import { existsSync, readFileSync, readdirSync, statSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = dirname(dirname(fileURLToPath(import.meta.url)));
const strict = process.argv.includes('--strict');
const project = JSON.parse(readFileSync(join(root, 'apps/miniprogram/project.config.json'), 'utf8'));
const packageJson = JSON.parse(readFileSync(join(root, 'package.json'), 'utf8'));
const distPath = join(root, 'apps/miniprogram/dist');
const results = [];

check('Node.js 符合仓库最低版本', compareVersions(process.versions.node, packageJson.engines.node.replace(/^[^0-9]*/, '')) >= 0, `${process.versions.node} / 需要 ${packageJson.engines.node}`);
check('已替换真实小程序 AppID', project.appid && project.appid !== 'touristappid', project.appid || '未配置');
check('开发者工具开启合法域名校验', project.setting?.urlCheck === true, `urlCheck=${String(project.setting?.urlCheck)}`);
check('使用 production 小程序环境', process.env.TARO_APP_ENV === 'production', process.env.TARO_APP_ENV || '未配置');
check('小程序发布版本为 0.0.2', process.env.TARO_APP_RELEASE_VERSION === '0.0.2', process.env.TARO_APP_RELEASE_VERSION || '未配置');
check('生产 API 使用 HTTPS', /^https:\/\//.test(process.env.TARO_APP_API_BASE_URL || ''), process.env.TARO_APP_API_BASE_URL || '未配置');
check('已配置隐私联系人', Boolean(process.env.TARO_APP_PRIVACY_CONTACT?.trim()), process.env.TARO_APP_PRIVACY_CONTACT ? '已配置' : '未配置');
check('API 明确启用微信内容安全', process.env.CONTENT_SECURITY_MODE === 'wechat', process.env.CONTENT_SECURITY_MODE || '未配置');
check('API 使用生产模式', process.env.NODE_ENV === 'production', process.env.NODE_ENV || '未配置');
check('生产数据库已配置', Boolean(process.env.DATABASE_URL), process.env.DATABASE_URL ? '已配置' : '未配置');
check('JWT 密钥强度满足要求', (process.env.JWT_SECRET?.length || 0) >= 32, process.env.JWT_SECRET ? `长度 ${process.env.JWT_SECRET.length}` : '未配置');
check('微信服务凭证已配置', Boolean(process.env.WECHAT_APP_ID && process.env.WECHAT_APP_SECRET), process.env.WECHAT_APP_ID && process.env.WECHAT_APP_SECRET ? '已配置' : '未配置');
check('对象存储和 HTTPS 公开地址已配置', process.env.STORAGE_MODE === 's3' && /^https:\/\//.test(process.env.STORAGE_PUBLIC_BASE_URL || ''), process.env.STORAGE_MODE || '未配置');

if (existsSync(distPath)) {
  const bytes = directorySize(distPath);
  check('当前未分包构建产物小于 2 MiB', bytes <= 2 * 1024 * 1024, `${formatBytes(bytes)} / 上限 2 MiB`);
} else {
  check('存在小程序生产构建产物', false, '请先运行 pnpm build:mini');
}

for (const result of results) {
  console.log(`${result.ok ? '[PASS]' : '[BLOCK]'} ${result.name} — ${result.detail}`);
}
const blocked = results.filter((result) => !result.ok);
console.log(`\nRC 自检：${results.length - blocked.length}/${results.length} 通过，${blocked.length} 项阻塞${strict ? '（严格模式）' : '（诊断模式）'}。`);
if (strict && blocked.length > 0) process.exitCode = 1;

function check(name, ok, detail) {
  results.push({ name, ok: Boolean(ok), detail });
}

function directorySize(path) {
  return readdirSync(path, { withFileTypes: true }).reduce((total, entry) => {
    const target = join(path, entry.name);
    return total + (entry.isDirectory() ? directorySize(target) : statSync(target).size);
  }, 0);
}

function formatBytes(bytes) {
  return `${(bytes / 1024).toFixed(1)} KiB`;
}

function compareVersions(left, right) {
  const a = left.split('.').map(Number);
  const b = right.split('.').map(Number);
  for (let index = 0; index < Math.max(a.length, b.length); index += 1) {
    if ((a[index] || 0) !== (b[index] || 0)) return (a[index] || 0) - (b[index] || 0);
  }
  return 0;
}
