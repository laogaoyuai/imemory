export const releaseConfig = {
  environment: process.env.TARO_APP_ENV ?? 'development',
  version: process.env.TARO_APP_RELEASE_VERSION ?? '0.0.1',
  apiBaseUrl: process.env.TARO_APP_API_BASE_URL ?? 'http://127.0.0.1:4000/api/v1',
  privacyContact: process.env.TARO_APP_PRIVACY_CONTACT ?? '',
} as const;

export function releaseWarnings(config = releaseConfig): string[] {
  const warnings: string[] = [];
  if (config.environment === 'production' && !config.apiBaseUrl.startsWith('https://')) {
    warnings.push('生产 API 地址未使用 HTTPS');
  }
  if (!config.privacyContact.trim()) warnings.push('未配置隐私联系人');
  if (config.environment !== 'production') warnings.push('当前不是生产环境构建');
  return warnings;
}
