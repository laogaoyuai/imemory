import Taro from '@tarojs/taro';

export const PRIVACY_NOTICE_VERSION = '2026-08-23';
const PRIVACY_CONSENT_KEY = 'atlas:miniprogram:v1:privacy-consent';

export interface PrivacyConsentRecord {
  version: string;
  acceptedAt: string;
}

export function readPrivacyConsent(): PrivacyConsentRecord | null {
  try {
    const value = Taro.getStorageSync(PRIVACY_CONSENT_KEY) as Partial<PrivacyConsentRecord> | undefined;
    return value && typeof value.version === 'string' && typeof value.acceptedAt === 'string'
      ? { version: value.version, acceptedAt: value.acceptedAt }
      : null;
  } catch {
    return null;
  }
}

export function hasCurrentPrivacyConsent(): boolean {
  return readPrivacyConsent()?.version === PRIVACY_NOTICE_VERSION;
}

export function acceptPrivacyNotice(now = new Date()): PrivacyConsentRecord {
  const record = { version: PRIVACY_NOTICE_VERSION, acceptedAt: now.toISOString() };
  Taro.setStorageSync(PRIVACY_CONSENT_KEY, record);
  return record;
}

export async function ensureLoginPrivacyConsent(): Promise<boolean> {
  if (hasCurrentPrivacyConsent()) return ensureWechatPrivacyAuthorization();
  const decision = await Taro.showModal({
    title: '登录与隐私说明',
    content: '登录会将微信登录凭证发送到拾光服务端，用于创建账号、云端同步和多设备使用。可先从首页“关于与隐私”查看完整说明。',
    confirmText: '同意登录',
    cancelText: '暂不登录',
    confirmColor: '#E7603C',
  });
  if (!decision.confirm) return false;
  const authorized = await ensureWechatPrivacyAuthorization();
  if (authorized) acceptPrivacyNotice();
  return authorized;
}

export async function ensureWechatPrivacyAuthorization(): Promise<boolean> {
  // WeChat DevTools can expose the privacy APIs while its simulator-side
  // implementation still throws `fn is not a function`. The app's explicit
  // consent modal remains active locally; platform authorization is enforced
  // for preview/production builds.
  if (process.env.TARO_APP_ENV === 'development') return true;
  const wechat = getNativeWechatPrivacyApi();
  if (!wechat) return true;
  const setting = await new Promise<PrivacySetting | null>((resolve) => {
    wechat.getPrivacySetting({ success: resolve, fail: () => resolve(null) });
  });
  if (!setting) return false;
  if (!setting.needAuthorization) return true;
  return new Promise<boolean>((resolve) => {
    wechat.requirePrivacyAuthorize({ success: () => resolve(true), fail: () => resolve(false) });
  });
}

export function openWechatPrivacyContract(): Promise<boolean> {
  const wechat = getNativeWechatPrivacyApi();
  if (!wechat) return Promise.resolve(false);
  return new Promise<boolean>((resolve) => {
    wechat.openPrivacyContract({ success: () => resolve(true), fail: () => resolve(false) });
  });
}

interface PrivacySetting {
  needAuthorization: boolean;
  privacyContractName: string;
}

interface NativeWechatPrivacyApi {
  getPrivacySetting(option: {
    success: (setting: PrivacySetting) => void;
    fail: () => void;
  }): void;
  requirePrivacyAuthorize(option: { success: () => void; fail: () => void }): void;
  openPrivacyContract(option: { success: () => void; fail: () => void }): void;
}

function getNativeWechatPrivacyApi(): NativeWechatPrivacyApi | null {
  const candidate = (globalThis as typeof globalThis & { wx?: Partial<NativeWechatPrivacyApi> }).wx;
  if (
    !candidate
    || typeof candidate.getPrivacySetting !== 'function'
    || typeof candidate.requirePrivacyAuthorize !== 'function'
    || typeof candidate.openPrivacyContract !== 'function'
  ) return null;
  return candidate as NativeWechatPrivacyApi;
}
