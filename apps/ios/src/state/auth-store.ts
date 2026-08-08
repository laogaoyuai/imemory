import { create } from 'zustand';

import { SQLiteAuthRepository, type UserRecord } from '../data/sqlite-auth-repository';

export type { UserRecord } from '../data/sqlite-auth-repository';

const repository = new SQLiteAuthRepository();

interface AuthStore {
  user: UserRecord | null;
  users: UserRecord[];
  hydrated: boolean;
  loading: boolean;
  error: string | null;
  hydrate: () => Promise<void>;
  register: (phone: string, password: string) => Promise<void>;
  login: (phone: string, password: string) => Promise<void>;
  logout: () => Promise<void>;
  updateProfile: (name: string, avatarUri: string | null, bio: string) => Promise<void>;
  toggleFollowByName: (name: string) => Promise<boolean>;
  isFollowingByName: (name: string) => Promise<boolean>;
  followerCount: (name: string) => Promise<number>;
  listUsers: () => Promise<UserRecord[]>;
}

function validate(phone: string, password: string) {
  if (!/^\d{6,20}$/.test(phone.trim())) throw new Error('请输入有效手机号');
  if (!/^[A-Za-z0-9]{6}$/.test(password)) throw new Error('密码必须是 6 位字母或数字');
}

export const useAuthStore = create<AuthStore>((set, get) => ({
  user: null,
  users: [],
  hydrated: false,
  loading: false,
  error: null,
  hydrate: async () => {
    set({ loading: true });
    set({ user: await repository.sessionUser(), users: await repository.listUsers(), hydrated: true, loading: false });
  },
  register: async (rawPhone, password) => {
    const phone = rawPhone.trim();
    validate(phone, password);
    if (await repository.getByPhone(phone)) throw new Error('该手机号已注册');
    const user: UserRecord = { id: `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`, phone, password, name: `手机用户${phone.slice(-4)}`, avatarUri: null, bio: '', createdAt: new Date().toISOString() };
    await repository.saveUser(user);
    await repository.setSession(user.id);
    set((state) => ({ user, users: [...state.users, user], error: null, hydrated: true }));
  },
  login: async (rawPhone, password) => {
    const phone = rawPhone.trim();
    validate(phone, password);
    const user = await repository.getByPhone(phone);
    if (!user || user.password !== password) throw new Error('手机号或密码错误');
    await repository.setSession(user.id);
    set((state) => ({ user, users: state.users.some((entry) => entry.id === user.id) ? state.users.map((entry) => entry.id === user.id ? user : entry) : [...state.users, user], error: null, hydrated: true }));
  },
  logout: async () => { await repository.setSession(null); set({ user: null }); },
  updateProfile: async (name, avatarUri, bio) => {
    const current = get().user;
    if (!current) return;
    const user = { ...current, name: name.trim() || current.name, avatarUri, bio: bio.trim() };
    await repository.updateUser(user);
    set((state) => ({ user, users: state.users.map((entry) => entry.id === user.id ? user : entry) }));
  },
  toggleFollowByName: async (name): Promise<boolean> => {
    const current = get().user;
    if (!current) return false;
    const target = await repository.getByName(name);
    if (!target) return false;
    return repository.toggleFollow(current.id, target.id);
  },
  isFollowingByName: async (name) => {
    const current = get().user;
    const target = await repository.getByName(name);
    return current && target ? repository.isFollowing(current.id, target.id) : false;
  },
  followerCount: async (name) => {
    const target = await repository.getByName(name);
    return target ? repository.followerCount(target.id) : 0;
  },
  listUsers: async () => { const users = await repository.listUsers(); set({ users }); return users; },
}));
