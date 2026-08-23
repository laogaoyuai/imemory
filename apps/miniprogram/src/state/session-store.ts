import type { AuthSession, UpdateProfileRequest } from '@atlas/contracts';
import Taro from '@tarojs/taro';
import { create } from 'zustand';

import { loadRemoteSession, loginWithCurrentWechatAccount, remoteApi, saveRemoteSession } from '../data/remote-api';
import { ensureLoginPrivacyConsent } from '../privacy/privacy-consent';
import { useCollectionStore } from './collection-store';
import { useProjectStore } from './project-store';

interface SessionStore {
  session: AuthSession | null;
  hydrated: boolean;
  loading: boolean;
  error: string | null;
  hydrate: () => Promise<void>;
  login: () => Promise<void>;
  logout: () => Promise<void>;
  updateProfile: (input: UpdateProfileRequest) => Promise<void>;
}

export const useSessionStore = create<SessionStore>((set, get) => ({
  session: null,
  hydrated: false,
  loading: false,
  error: null,
  hydrate: async () => {
    set({ session: await loadRemoteSession(), hydrated: true });
  },
  login: async () => {
    set({ loading: true, error: null });
    try {
      if (!await ensureLoginPrivacyConsent()) throw new Error('需要同意隐私说明后才能登录');
      const session = await loginWithCurrentWechatAccount();
      set({ session, loading: false });
      await Taro.showToast({ title: '云端登录成功', icon: 'success' });
    } catch (error) {
      const message = describeLoginError(error);
      set({ error: message, loading: false });
      await Taro.showToast({ title: message, icon: 'none' });
    }
  },
  logout: async () => {
    await remoteApi.logout();
    useCollectionStore.getState().clear();
    useProjectStore.getState().clear();
    set({ session: null, error: null });
  },
  updateProfile: async (input) => {
    set({ loading: true, error: null });
    try {
      const current = get().session;
      if (!current) throw new Error('请先登录');
      const user = await remoteApi.updateProfile(input);
      const session = { ...current, user };
      await saveRemoteSession(session);
      set({ session, loading: false });
    } catch (error) {
      const message = error instanceof Error ? error.message : '资料保存失败';
      set({ error: message, loading: false });
      throw error;
    }
  },
}));

function describeLoginError(error: unknown): string {
  if (error instanceof Error && error.message.trim()) return error.message;
  if (error && typeof error === 'object') {
    const candidate = error as { errMsg?: unknown; message?: unknown };
    if (typeof candidate.errMsg === 'string' && candidate.errMsg.trim()) return candidate.errMsg;
    if (typeof candidate.message === 'string' && candidate.message.trim()) return candidate.message;
  }
  return '微信登录失败';
}
