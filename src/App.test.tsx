// @vitest-environment jsdom
(globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
import { describe, it, expect, vi } from 'vitest';
import { createRoot } from 'react-dom/client';
import { act } from 'react';
import { App } from './App';
import * as AuthContextModule from './contexts/AuthContext';

// Mock matchMedia for nested components if necessary
Object.defineProperty(window, 'matchMedia', {
  writable: true,
  value: vi.fn().mockImplementation(query => ({
    matches: false,
    media: query,
    onchange: null,
    addListener: vi.fn(),
    removeListener: vi.fn(),
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
    dispatchEvent: vi.fn(),
  })),
});

describe('App Auth Gate', () => {
  it('renders loading state when supabase is active and loading', async () => {
    vi.spyOn(AuthContextModule, 'useAuth').mockReturnValue({
      user: null,
      isLoading: true,
      error: null,
      authMode: 'supabase-active',
      signIn: vi.fn(),
      signOut: vi.fn()
    });

    const container = document.createElement('div');
    const root = createRoot(container);

    await act(async () => {
      root.render(<App />);
    });

    expect(container.querySelector('.animate-spin')).toBeDefined();

    await act(async () => {
      root.unmount();
    });
  });

  it('renders LoginPage when supabase is active and no user', async () => {
    vi.spyOn(AuthContextModule, 'useAuth').mockReturnValue({
      user: null,
      isLoading: false,
      error: null,
      authMode: 'supabase-active',
      signIn: vi.fn(),
      signOut: vi.fn()
    });

    const container = document.createElement('div');
    const root = createRoot(container);

    await act(async () => {
      root.render(<App />);
    });

    expect(container.textContent).toContain('Вход в систему');

    await act(async () => {
      root.unmount();
    });
  });
});
