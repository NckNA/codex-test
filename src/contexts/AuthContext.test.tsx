// @vitest-environment jsdom
(globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
import { describe, it, expect, vi } from 'vitest';
import { createRoot } from 'react-dom/client';
import { act } from 'react';

vi.mock('../lib/supabaseClient', () => ({
  isSupabaseConfigured: false,
  supabase: null,
}));

import { AuthProvider, useAuth } from './AuthContext';

describe('AuthContext (Dev Fallback)', () => {
  it('provides dev user and safely resolves signIn/signOut', async () => {
    let auth: ReturnType<typeof useAuth> | undefined;

    const TestComponent = () => {
      auth = useAuth();
      return null;
    };

    const container = document.createElement('div');
    const root = createRoot(container);

    await act(async () => {
      root.render(
        <AuthProvider>
          <TestComponent />
        </AuthProvider>
      );
    });

    expect(auth).toBeDefined();
    expect(auth!.authMode).toBe('dev');
    expect(auth!.user?.email).toBe('dev@example.com');
    expect(auth!.isLoading).toBe(false);

    await act(async () => {
      await auth!.signIn('test@example.com', 'password');
    });
    expect(auth!.user?.email).toBe('dev@example.com');

    await act(async () => {
      await auth!.signOut();
    });
    expect(auth!.user?.email).toBe('dev@example.com');

    await act(async () => {
      root.unmount();
    });
  });
});
