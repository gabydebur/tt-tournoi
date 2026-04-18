import apiClient from './client';
import type { DemoSeedResponse } from '../types';

export const demoApi = {
  seed: async (): Promise<DemoSeedResponse> => {
    const { data } = await apiClient.post<DemoSeedResponse>('/api/demo/seed');
    return data;
  },
};
