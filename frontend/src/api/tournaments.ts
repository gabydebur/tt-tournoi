import apiClient from './client';
import type { Tournament, TournamentPayload, SeriesStandings } from '../types';

export const tournamentsApi = {
  list: async (): Promise<Tournament[]> => {
    const { data } = await apiClient.get<Tournament[]>('/api/tournaments');
    return data;
  },

  get: async (id: string): Promise<Tournament> => {
    const { data } = await apiClient.get<Tournament>(`/api/tournaments/${id}`);
    return data;
  },

  create: async (payload: TournamentPayload): Promise<Tournament> => {
    const { data } = await apiClient.post<Tournament>('/api/tournaments', payload);
    return data;
  },

  update: async (id: string, payload: Partial<TournamentPayload>): Promise<Tournament> => {
    const { data } = await apiClient.put<Tournament>(`/api/tournaments/${id}`, payload);
    return data;
  },

  openRegistration: async (id: string): Promise<Tournament> => {
    const { data } = await apiClient.post<Tournament>(`/api/tournaments/${id}/open-registration`);
    return data;
  },

  closeRegistration: async (id: string): Promise<Tournament> => {
    const { data } = await apiClient.post<Tournament>(`/api/tournaments/${id}/close-registration`);
    return data;
  },

  start: async (id: string): Promise<Tournament> => {
    const { data } = await apiClient.post<Tournament>(`/api/tournaments/${id}/start`);
    return data;
  },

  standings: async (id: string): Promise<SeriesStandings[]> => {
    const { data } = await apiClient.get<SeriesStandings[]>(`/api/tournaments/${id}/standings`);
    return data;
  },
};
