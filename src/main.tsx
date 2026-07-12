import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import './index.css';

import { storage } from './utils/storage';
import { isSupabaseConfigured } from './lib/supabaseClient';

import { AuthProvider } from './contexts/AuthContext';
import { TenantProvider } from './contexts/TenantContext';
import { App } from './App';

// Seed demo appointment facts only for the explicit local/dev backend.
storage.init({ includeAppointments: !isSupabaseConfigured });

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <AuthProvider>
      <TenantProvider>
        <App />
      </TenantProvider>
    </AuthProvider>
  </StrictMode>
);
