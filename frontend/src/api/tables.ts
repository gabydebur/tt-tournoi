import apiClient from './client';
import type { TournamentTable } from '../types';

export const tablesApi = {
  list: async (tournamentId: string): Promise<TournamentTable[]> => {
    const { data } = await apiClient.get<TournamentTable[]>(
      `/api/tournaments/${tournamentId}/tables`
    );
    return data;
  },

  create: async (tournamentId: string, count: number): Promise<TournamentTable[]> => {
    const { data } = await apiClient.post<TournamentTable[]>(
      `/api/tournaments/${tournamentId}/tables`,
      { count }
    );
    return data;
  },
};
