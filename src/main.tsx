import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import './index.css';

import { storage } from './utils/storage';

import { AuthProvider } from './contexts/AuthContext';
import { TenantProvider } from './contexts/TenantContext';
import { App } from './App';

// Initialize localStorage seed data if not present
storage.init();

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <AuthProvider>
      <TenantProvider>
        <App />
      </TenantProvider>
    </AuthProvider>
  </StrictMode>
);
