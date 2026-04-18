import apiClient from './client';
import type { PoolData, SwapPlayersPayload } from '../types';

export const poolsApi = {
  list: async (tournamentId: number): Promise<PoolData[]> => {
    const { data } = await apiClient.get<PoolData[]>(
      `/api/tournaments/${tournamentId}/pools`
    );
    return data;
  },

  generate: async (tournamentId: number): Promise<PoolData[]> => {
    const { data } = await apiClient.post<PoolData[]>(
      `/api/tournaments/${tournamentId}/pools/generate`
    );
    return data;
  },

  regenerate: async (tournamentId: number): Promise<PoolData[]> => {
    const { data } = await apiClient.post<PoolData[]>(
      `/api/tournaments/${tournamentId}/pools/regenerate`
    );
    return data;
  },

  swap: async (payload: SwapPlayersPayload): Promise<{ ok: true }> => {
    const { data } = await apiClient.post<{ ok: true }>(
      `/api/pools/swap-players`,
      payload
    );
    return data;
  },

  confirm: async (tournamentId: number): Promise<PoolData[]> => {
    const { data } = await apiClient.post<PoolData[]>(
      `/api/tournaments/${tournamentId}/pools/confirm`
    );
    return data;
  },

  start: async (poolId: number, tableId: number): Promise<PoolData> => {
    const { data } = await apiClient.post<PoolData>(
      `/api/pools/${poolId}/start`,
      { table_id: tableId }
    );
    return data;
  },

  get: async (poolId: number): Promise<PoolData> => {
    const { data } = await apiClient.get<PoolData>(`/api/pools/${poolId}`);
    return data;
  },
};
