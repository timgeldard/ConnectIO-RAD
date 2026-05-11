import React from 'react';
import ReactDOM from 'react-dom/client';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { queryClientDefaultOptions } from '@connectio/shared-frontend-api/query';
import { ErrorBoundary } from '@connectio/shared-ui';
import App from './App';
import 'maplibre-gl/dist/maplibre-gl.css';
import '@connectio/shared-ui/styles/kerry-tokens.css';
import '@connectio/shared-ui/styles/kerry-app.css';
import './index.scss';

const queryClient = new QueryClient({ defaultOptions: queryClientDefaultOptions });

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <ErrorBoundary>
      <QueryClientProvider client={queryClient}>
        <App />
      </QueryClientProvider>
    </ErrorBoundary>
  </React.StrictMode>,
);
