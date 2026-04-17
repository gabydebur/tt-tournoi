import apiClient from './client';
import type { Series, SeriesPayload } from '../types';

export const seriesApi = {
  list: async (tournamentId: number): Promise<Series[]> => {
    const { data } = await apiClient.get<Series[]>(`/api/tournaments/${tournamentId}/series`);
    return data;
  },

  create: async (tournamentId: number, payload: SeriesPayload): Promise<Series> => {
    const { data } = await apiClient.post<Series>(
      `/api/tournaments/${tournamentId}/series`,
      payload
    );
    return data;
  },

  update: async (tournamentId: number, seriesId: number, payload: Partial<SeriesPayload>): Promise<Series> => {
    const { data } = await apiClient.put<Series>(
      `/api/tournaments/${tournamentId}/series/${seriesId}`,
      payload
    );
    return data;
  },
};
