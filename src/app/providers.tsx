import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { useState, type ReactNode } from 'react';
import { AuthProvider } from '../features/auth';
import { DataProvider } from '../features/data';

export function AppProviders({ children }: { children: ReactNode }) {
  const [client] = useState(() => new QueryClient({ defaultOptions: { queries: { staleTime: 20_000, retry: 1 } } }));
  return <QueryClientProvider client={client}><AuthProvider><DataProvider>{children}</DataProvider></AuthProvider></QueryClientProvider>;
}
