import apiClient from './client';
import type { DisplayState } from '../types';

export const displayApi = {
  getState: async (tournamentId: string): Promise<DisplayState> => {
    const { data } = await apiClient.get<DisplayState>(
      `/api/tournaments/${tournamentId}/display-state`
    );
    return data;
  },
};
