import apiClient from './client';
import type { Series, SeriesPayload } from '../types';

export const seriesApi = {
  list: async (tournamentId: string): Promise<Series[]> => {
    const { data } = await apiClient.get<Series[]>(`/api/tournaments/${tournamentId}/series`);
    return data;
  },

  create: async (tournamentId: string, payload: SeriesPayload): Promise<Series> => {
    const { data } = await apiClient.post<Series>(
      `/api/tournaments/${tournamentId}/series`,
      payload
    );
    return data;
  },

  update: async (tournamentId: string, seriesId: string, payload: Partial<SeriesPayload>): Promise<Series> => {
    const { data } = await apiClient.put<Series>(
      `/api/tournaments/${tournamentId}/series/${seriesId}`,
      payload
    );
    return data;
  },
};
