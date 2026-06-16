// @vitest-environment jsdom
(globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
import { beforeEach, describe, it, expect, vi } from 'vitest';
import { createRoot } from 'react-dom/client';
import type { Root } from 'react-dom/client';
import { act } from 'react';
import { LoginPage } from './LoginPage';
import * as AuthContextModule from '../contexts/AuthContext';
import {
  isQaLoginShortcutEnabled,
  QA_LOGIN_SECRET_ENV_NAME,
  QA_LOGIN_SHORTCUT_USERS,
} from './devQaLoginShortcut';

const LOCAL_QA_TEST_VALUE = 'local-qa-login-value';

function mockAuth(signInMock = vi.fn().mockResolvedValue(undefined)) {
  vi.spyOn(AuthContextModule, 'useAuth').mockReturnValue({
    user: null,
    isLoading: false,
    error: null,
    authMode: 'supabase-active',
    signIn: signInMock,
    signOut: vi.fn(),
  });

  return signInMock;
}

async function renderLoginPage(): Promise<{ container: HTMLDivElement; root: Root }> {
  const container = document.createElement('div');
  document.body.appendChild(container);
  const root = createRoot(container);

  await act(async () => {
    root.render(<LoginPage />);
  });

  return { container, root };
}

async function cleanupRendered(root: Root, container: HTMLDivElement) {
  await act(async () => {
    root.unmount();
  });
  container.remove();
}

function findButton(container: HTMLElement, label: string): HTMLButtonElement | undefined {
  return Array.from(container.querySelectorAll('button')).find((button) =>
    button.textContent?.includes(label)
  );
}

describe('LoginPage', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
    vi.unstubAllEnvs();
    document.body.innerHTML = '';
  });

  it('renders login form and calls signIn', async () => {
    const signInMock = mockAuth();
    const { container, root } = await renderLoginPage();

    const emailInput = container.querySelector('input[type="email"]') as HTMLInputElement;
    const passwordInput = container.querySelector('input[type="password"]') as HTMLInputElement;
    const form = container.querySelector('form') as HTMLFormElement;

    expect(emailInput).toBeDefined();
    expect(passwordInput).toBeDefined();

    const nativeInputValueSetter = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, 'value')?.set;

    await act(async () => {
      nativeInputValueSetter?.call(emailInput, 'test@example.com');
      emailInput.dispatchEvent(new Event('change', { bubbles: true }));

      nativeInputValueSetter?.call(passwordInput, 'login-value');
      passwordInput.dispatchEvent(new Event('change', { bubbles: true }));
    });

    await act(async () => {
      form.dispatchEvent(new Event('submit', { bubbles: true, cancelable: true }));
    });

    expect(signInMock).toHaveBeenCalledWith('test@example.com', 'login-value');

    await cleanupRendered(root, container);
  });

  it('hides the QA shortcut by default', async () => {
    mockAuth();
    const { container, root } = await renderLoginPage();

    expect(container.textContent).not.toContain('Локальный QA-вход. Только для разработки.');
    expect(findButton(container, 'Войти как Admin A')).toBeUndefined();

    await cleanupRendered(root, container);
  });

  it('hides the QA shortcut when the feature flag is not enabled', async () => {
    vi.stubEnv(QA_LOGIN_SECRET_ENV_NAME, LOCAL_QA_TEST_VALUE);
    mockAuth();
    const { container, root } = await renderLoginPage();

    expect(container.textContent).not.toContain('Локальный QA-вход. Только для разработки.');
    expect(findButton(container, 'Войти как Admin A')).toBeUndefined();

    await cleanupRendered(root, container);
  });

  it('keeps the QA shortcut disabled on non-localhost hosts', () => {
    expect(
      isQaLoginShortcutEnabled(
        {
          DEV: true,
          VITE_ENABLE_QA_LOGIN_SHORTCUT: 'true',
          [QA_LOGIN_SECRET_ENV_NAME]: LOCAL_QA_TEST_VALUE,
        },
        'app.example.test'
      )
    ).toBe(false);
  });

  it('shows the QA shortcut on localhost when dev flag and local QA value are configured', async () => {
    vi.stubEnv('VITE_ENABLE_QA_LOGIN_SHORTCUT', 'true');
    vi.stubEnv(QA_LOGIN_SECRET_ENV_NAME, LOCAL_QA_TEST_VALUE);
    mockAuth();
    const { container, root } = await renderLoginPage();

    expect(container.textContent).toContain('Локальный QA-вход. Только для разработки.');
    for (const user of QA_LOGIN_SHORTCUT_USERS) {
      expect(findButton(container, `Войти как ${user.label}`)).toBeDefined();
    }

    await cleanupRendered(root, container);
  });

  it('clicking Admin A uses normal signIn with the QA user email and configured local QA value', async () => {
    vi.stubEnv('VITE_ENABLE_QA_LOGIN_SHORTCUT', 'true');
    vi.stubEnv(QA_LOGIN_SECRET_ENV_NAME, LOCAL_QA_TEST_VALUE);
    const signInMock = mockAuth();
    const { container, root } = await renderLoginPage();

    const adminButton = findButton(container, 'Войти как Admin A');
    expect(adminButton).toBeDefined();

    await act(async () => {
      adminButton?.click();
    });

    expect(signInMock).toHaveBeenCalledWith('qa.admin.a@example.local', LOCAL_QA_TEST_VALUE);

    await cleanupRendered(root, container);
  });

  it('QA shortcut helper only depends on local dev flag, localhost, and local QA value', () => {
    expect(
      isQaLoginShortcutEnabled(
        {
          DEV: true,
          VITE_ENABLE_QA_LOGIN_SHORTCUT: 'true',
          [QA_LOGIN_SECRET_ENV_NAME]: LOCAL_QA_TEST_VALUE,
        },
        'localhost'
      )
    ).toBe(true);
  });
});
