import type {
  CreateProjectRequest,
  Project,
  ProjectDetailResponse,
  PublicUser,
  UpdateProjectRequest,
} from '@atlas/contracts';
import type { ProjectRole } from '@atlas/core';
import { create } from 'zustand';

import { remoteApi } from '../data/remote-api';

interface ProjectStore {
  mine: Project[];
  discover: Project[];
  selected: ProjectDetailResponse | null;
  userResults: PublicUser[];
  loading: boolean;
  saving: boolean;
  error: string | null;
  hydrate: () => Promise<void>;
  open: (projectId: string) => Promise<void>;
  createProject: (input: CreateProjectRequest) => Promise<Project>;
  updateProject: (projectId: string, input: UpdateProjectRequest) => Promise<void>;
  follow: (projectId: string) => Promise<void>;
  unfollow: (projectId: string) => Promise<void>;
  changeRole: (projectId: string, userId: string, role: ProjectRole) => Promise<void>;
  searchUsers: (keyword: string) => Promise<void>;
  invite: (projectId: string, userId: string) => Promise<void>;
  clear: () => void;
}

export const useProjectStore = create<ProjectStore>((set, get) => ({
  mine: [],
  discover: [],
  selected: null,
  userResults: [],
  loading: false,
  saving: false,
  error: null,
  hydrate: async () => {
    set({ loading: true, error: null });
    try {
      const [mine, discover] = await Promise.all([
        remoteApi.listProjects('mine'),
        remoteApi.listProjects('discover'),
      ]);
      set({ mine: mine.projects, discover: discover.projects, loading: false });
    } catch (error) {
      set({ loading: false, error: messageOf(error, '项目加载失败') });
    }
  },
  open: async (projectId) => {
    set({ loading: true, error: null });
    try {
      set({ selected: await remoteApi.getProject(projectId), loading: false });
    } catch (error) {
      set({ loading: false, error: messageOf(error, '项目加载失败') });
    }
  },
  createProject: async (input) => {
    set({ saving: true, error: null });
    try {
      const project = await remoteApi.createProject(input);
      set((state) => ({ mine: [project, ...state.mine], saving: false }));
      void get().hydrate();
      return project;
    } catch (error) {
      set({ saving: false, error: messageOf(error, '项目创建失败') });
      throw error;
    }
  },
  updateProject: async (projectId, input) => {
    set({ saving: true, error: null });
    try {
      await remoteApi.updateProject(projectId, input);
      await get().open(projectId);
      void get().hydrate();
      set({ saving: false });
    } catch (error) {
      set({ saving: false, error: messageOf(error, '项目保存失败') });
      throw error;
    }
  },
  follow: async (projectId) => {
    set({ saving: true, error: null });
    try {
      await remoteApi.followProject(projectId);
      await Promise.all([get().hydrate(), get().open(projectId)]);
      set({ saving: false });
    } catch (error) {
      set({ saving: false, error: messageOf(error, '关注失败') });
    }
  },
  unfollow: async (projectId) => {
    set({ saving: true, error: null });
    try {
      await remoteApi.unfollowProject(projectId);
      await get().hydrate();
      set((state) => ({
        selected: state.selected?.project.id === projectId
          ? { ...state.selected, project: { ...state.selected.project, currentRole: null } }
          : state.selected,
        saving: false,
      }));
    } catch (error) {
      set({ saving: false, error: messageOf(error, '取消关注失败') });
    }
  },
  changeRole: async (projectId, userId, role) => {
    set({ saving: true, error: null });
    try {
      const selected = await remoteApi.changeProjectRole(projectId, userId, { role });
      set({ selected, saving: false });
      void get().hydrate();
    } catch (error) {
      set({ saving: false, error: messageOf(error, '角色调整失败') });
    }
  },
  searchUsers: async (keyword) => {
    if (!keyword.trim()) {
      set({ userResults: [] });
      return;
    }
    try {
      const result = await remoteApi.searchUsers(keyword.trim());
      set({ userResults: result.users, error: null });
    } catch (error) {
      set({ error: messageOf(error, '用户搜索失败') });
    }
  },
  invite: async (projectId, userId) => {
    set({ saving: true, error: null });
    try {
      const selected = await remoteApi.addProjectMember(projectId, { userId });
      set({ selected, saving: false, userResults: [] });
    } catch (error) {
      set({ saving: false, error: messageOf(error, '邀请失败') });
    }
  },
  clear: () => set({ mine: [], discover: [], selected: null, userResults: [], error: null }),
}));

function messageOf(error: unknown, fallback: string): string {
  return error instanceof Error ? error.message : fallback;
}
