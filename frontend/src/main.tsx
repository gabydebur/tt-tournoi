import React from 'react';
import ReactDOM from 'react-dom/client';
import { BrowserRouter } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { ReactQueryDevtools } from '@tanstack/react-query-devtools';
import { StytchProvider, createStytchUIClient } from '@stytch/react';
import { AuthProvider } from './context/AuthContext';
import App from './App';
import './index.css';

const STYTCH_PUBLIC_TOKEN = 'public-token-test-d900d239-a235-4a07-85a6-4589dde96695';

const stytchClient = createStytchUIClient(STYTCH_PUBLIC_TOKEN);

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 30_000,
      retry: 1,
      refetchOnWindowFocus: false,
    },
  },
});

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <BrowserRouter>
      <QueryClientProvider client={queryClient}>
        <StytchProvider stytch={stytchClient}>
          <AuthProvider>
            <App />
          </AuthProvider>
        </StytchProvider>
        {import.meta.env.DEV && <ReactQueryDevtools initialIsOpen={false} />}
      </QueryClientProvider>
    </BrowserRouter>
  </React.StrictMode>
);
