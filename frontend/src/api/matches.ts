import apiClient from './client';
import type { Match, MatchResultPayload, MatchSuggestions } from '../types';

export const matchesApi = {
  list: async (tournamentId: string, params?: { day?: number; status?: string }): Promise<Match[]> => {
    const { data } = await apiClient.get<Match[]>(`/api/tournaments/${tournamentId}/matches`, {
      params,
    });
    return data;
  },

  suggestions: async (tournamentId: string): Promise<MatchSuggestions> => {
    const { data } = await apiClient.get<MatchSuggestions>(
      `/api/tournaments/${tournamentId}/matches/suggestions`
    );
    return data;
  },

  start: async (matchId: string, tableId: string): Promise<Match> => {
    const { data } = await apiClient.post<Match>(`/api/matches/${matchId}/start`, {
      table_id: tableId,
    });
    return data;
  },

  submitResult: async (matchId: string, payload: MatchResultPayload): Promise<Match> => {
    const { data } = await apiClient.post<Match>(`/api/matches/${matchId}/result`, payload);
    return data;
  },
};
