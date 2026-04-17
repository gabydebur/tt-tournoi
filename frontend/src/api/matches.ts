import apiClient from './client';
import type { Match, MatchResultPayload } from '../types';

export const matchesApi = {
  list: async (tournamentId: number, params?: { day?: number; status?: string }): Promise<Match[]> => {
    const { data } = await apiClient.get<Match[]>(`/api/tournaments/${tournamentId}/matches`, {
      params,
    });
    return data;
  },

  suggestions: async (tournamentId: number): Promise<Match[]> => {
    const { data } = await apiClient.get<Match[]>(
      `/api/tournaments/${tournamentId}/matches/suggestions`
    );
    return data;
  },

  start: async (matchId: number, tableId: number): Promise<Match> => {
    const { data } = await apiClient.post<Match>(`/api/matches/${matchId}/start`, {
      table_id: tableId,
    });
    return data;
  },

  submitResult: async (matchId: number, payload: MatchResultPayload): Promise<Match> => {
    const { data } = await apiClient.post<Match>(`/api/matches/${matchId}/result`, payload);
    return data;
  },
};
