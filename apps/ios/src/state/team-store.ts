import { create } from 'zustand';

import { SQLiteTeamRepository, type TeamRecord } from '../data/sqlite-team-repository';

const repository = new SQLiteTeamRepository();

interface TeamStore {
  teams: TeamRecord[];
  followedTeamNames: string[];
  loading: boolean;
  error: string | null;
  hydrate: () => Promise<void>;
  createTeam: (name: string, isPublic: boolean, ownerName?: string) => Promise<TeamRecord>;
  updateTeam: (team: TeamRecord) => Promise<void>;
  removeTeam: (id: string) => Promise<void>;
  toggleFollow: (name: string, userName?: string) => Promise<void>;
  isFollowing: (name: string) => boolean;
  setRole: (teamName: string, userName: string, role: 'admin' | 'member' | 'follower' | 'owner') => Promise<void>;
}

export const useTeamStore = create<TeamStore>((set, get) => ({
  teams: [],
  followedTeamNames: [],
  loading: false,
  error: null,
  hydrate: async () => {
    set({ loading: true, error: null });
    try {
      set({ teams: await repository.list(), loading: false });
    } catch (error) {
      set({ loading: false, error: error instanceof Error ? error.message : '团队加载失败' });
    }
  },
  createTeam: async (rawName, isPublic, ownerName = '我') => {
    const name = rawName.trim();
    if (!name || name === '无') throw new Error('请输入有效的团队名称');
    const team: TeamRecord = {
      id: `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`,
      name,
      createdAt: new Date().toISOString(),
      isPublic,
      avatarUri: null,
      description: '',
      ownerName,
      adminNames: [],
      memberNames: [ownerName],
      followerNames: [ownerName],
    };
    await repository.save(team);
    set((state) => ({ teams: [...state.teams, team], error: null }));
    return team;
  },
  removeTeam: async (id) => {
    await repository.remove(id);
    set((state) => ({ teams: state.teams.filter((team) => team.id !== id) }));
  },
  updateTeam: async (team) => { await repository.update(team); set((state) => ({ teams: state.teams.map((item) => item.id === team.id ? team : item) })); },
  toggleFollow: async (name, userName = '我') => {
    const team = get().teams.find((item) => item.name === name);
    if (!team) return;
    const following = team.followerNames.includes(userName);
    const updated = { ...team, followerNames: following ? team.followerNames.filter((item) => item !== userName) : [...team.followerNames, userName] };
    await repository.update(updated);
    set((state) => ({ teams: state.teams.map((item) => item.id === team.id ? updated : item), followedTeamNames: following ? state.followedTeamNames.filter((item) => item !== name) : [...new Set([...state.followedTeamNames, name])] }));
  },
  isFollowing: (name) => get().followedTeamNames.includes(name),
  setRole: async (teamName, userName, role) => {
    const team = get().teams.find((item) => item.name === teamName);
    if (!team) return;
    const adminNames = team.adminNames.filter((name) => name !== userName);
    const memberNames = team.memberNames.filter((name) => name !== userName);
    const updated: TeamRecord = {
      ...team,
      ownerName: role === 'owner' ? userName : team.ownerName,
      adminNames: role === 'admin' ? [...adminNames, userName] : adminNames,
      memberNames: role === 'member' ? [...memberNames, userName] : memberNames,
      followerNames: Array.from(new Set([...team.followerNames, userName])),
    };
    await repository.update(updated);
    set((state) => ({ teams: state.teams.map((item) => item.id === team.id ? updated : item) }));
  },
}));
