// @vitest-environment jsdom
(globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
import { describe, it, expect, vi } from 'vitest';
import { createRoot } from 'react-dom/client';
import { act } from 'react';
import { LoginPage } from './LoginPage';
import * as AuthContextModule from '../contexts/AuthContext';

describe('LoginPage', () => {
  it('renders login form and calls signIn', async () => {
    const signInMock = vi.fn().mockResolvedValue(undefined);
    
    vi.spyOn(AuthContextModule, 'useAuth').mockReturnValue({
      user: null,
      isLoading: false,
      error: null,
      authMode: 'supabase-active',
      signIn: signInMock,
      signOut: vi.fn(),
    });

    const container = document.createElement('div');
    const root = createRoot(container);

    await act(async () => {
      root.render(<LoginPage />);
    });

    const emailInput = container.querySelector('input[type="email"]') as HTMLInputElement;
    const passwordInput = container.querySelector('input[type="password"]') as HTMLInputElement;
    const form = container.querySelector('form') as HTMLFormElement;

    expect(emailInput).toBeDefined();
    expect(passwordInput).toBeDefined();

    const nativeInputValueSetter = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, 'value')?.set;
    
    await act(async () => {
      nativeInputValueSetter?.call(emailInput, 'test@example.com');
      emailInput.dispatchEvent(new Event('change', { bubbles: true }));
      
      nativeInputValueSetter?.call(passwordInput, 'password123');
      passwordInput.dispatchEvent(new Event('change', { bubbles: true }));
    });

    await act(async () => {
      form.dispatchEvent(new Event('submit', { bubbles: true, cancelable: true }));
    });

    expect(signInMock).toHaveBeenCalledWith('test@example.com', 'password123');

    await act(async () => {
      root.unmount();
    });
  });
});
