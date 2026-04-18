import apiClient from './client';
import type { LoginResponse, RegisterPayload, User } from '../types';

export const authApi = {
  login: async (email: string, password: string): Promise<LoginResponse> => {
    const { data } = await apiClient.post<LoginResponse>('/api/auth/login', {
      email,
      password,
    });
    return data;
  },

  register: async (payload: RegisterPayload): Promise<User> => {
    const { data } = await apiClient.post<User>('/api/auth/register', payload);
    return data;
  },

  me: async (): Promise<User> => {
    const { data } = await apiClient.get<User>('/api/auth/me');
    return data;
  },

  stytchExchange: async (session_jwt: string): Promise<LoginResponse> => {
    const { data } = await apiClient.post<LoginResponse>('/api/auth/stytch-exchange', {
      session_jwt,
    });
    return data;
  },
};
