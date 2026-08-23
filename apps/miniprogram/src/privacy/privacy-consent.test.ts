const storage = new Map<string, unknown>();

jest.mock('@tarojs/taro', () => ({
  __esModule: true,
  default: {
    getStorageSync: (key: string) => storage.get(key),
    setStorageSync: (key: string, value: unknown) => storage.set(key, value),
  },
}));

import { acceptPrivacyNotice, hasCurrentPrivacyConsent, PRIVACY_NOTICE_VERSION, readPrivacyConsent } from './privacy-consent';

describe('privacy consent record', () => {
  beforeEach(() => storage.clear());

  it('only accepts a record for the current notice version', () => {
    expect(hasCurrentPrivacyConsent()).toBe(false);
    storage.set('atlas:miniprogram:v1:privacy-consent', { version: 'older', acceptedAt: '2026-01-01T00:00:00.000Z' });
    expect(hasCurrentPrivacyConsent()).toBe(false);
  });

  it('persists a timestamped consent record', () => {
    acceptPrivacyNotice(new Date('2026-08-23T08:00:00.000Z'));
    expect(readPrivacyConsent()).toEqual({ version: PRIVACY_NOTICE_VERSION, acceptedAt: '2026-08-23T08:00:00.000Z' });
    expect(hasCurrentPrivacyConsent()).toBe(true);
  });
});
