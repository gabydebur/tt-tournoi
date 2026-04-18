import apiClient from './client';
import type { Registration } from '../types';

export const registrationsApi = {
  register: async (tournamentId: string, seriesId: string): Promise<Registration> => {
    const { data } = await apiClient.post<Registration>(
      `/api/tournaments/${tournamentId}/series/${seriesId}/register`
    );
    return data;
  },

  listForTournament: async (tournamentId: string): Promise<Registration[]> => {
    const { data } = await apiClient.get<Registration[]>(
      `/api/tournaments/${tournamentId}/registrations`
    );
    return data;
  },

  myRegistrations: async (): Promise<Registration[]> => {
    const { data } = await apiClient.get<Registration[]>('/api/players/me/registrations');
    return data;
  },

  confirm: async (registrationId: string): Promise<Registration> => {
    const { data } = await apiClient.put<Registration>(
      `/api/registrations/${registrationId}/confirm`
    );
    return data;
  },

  reject: async (registrationId: string): Promise<Registration> => {
    const { data } = await apiClient.put<Registration>(
      `/api/registrations/${registrationId}/reject`
    );
    return data;
  },
};
