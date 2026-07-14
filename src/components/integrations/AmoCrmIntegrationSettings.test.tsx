/* eslint-disable @typescript-eslint/no-explicit-any */
// @vitest-environment jsdom
(globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
import { act } from 'react';
import { createRoot } from 'react-dom/client';
import { describe, expect, it, vi } from 'vitest';
import type { UseAmoCrmIntegrationResult } from '../../data/hooks/useAmoCrmIntegration';
import { AmoCrmIntegrationSettingsView } from './AmoCrmIntegrationSettings';

function model(overrides: Partial<UseAmoCrmIntegrationResult> = {}): UseAmoCrmIntegrationResult {
  return {
    health: {
      integrationAccountId: 'integration-a',
      providerCode: 'amocrm',
      status: 'connected',
      connected: true,
      externalAccountId: '12345',
      externalAccountDomain: 'clinic.amocrm.ru',
      displayName: 'Clinic Account',
      tokenExpiresAt: '2026-07-15T12:00:00Z',
      lastVerifiedAt: '2026-07-14T12:00:00Z',
      actionRequired: 'none',
      canReconnect: true,
      canDisconnect: true,
      canManage: true,
    },
    loading: false,
    connecting: false,
    disconnecting: false,
    reconnecting: false,
    checking: false,
    error: null,
    role: 'clinic_admin',
    connect: vi.fn(),
    disconnect: vi.fn(),
    reconnect: vi.fn(),
    check: vi.fn(),
    ...overrides,
  };
}

async function mount(viewModel: UseAmoCrmIntegrationResult) {
  const container = document.createElement('div');
  document.body.appendChild(container);
  const root = createRoot(container);
  await act(async () => {
    root.render(<AmoCrmIntegrationSettingsView model={viewModel} />);
  });
  return { container, root };
}

describe('AmoCrmIntegrationSettings', () => {
  it('shows safe account health and required warnings for owner/admin', async () => {
    const { container, root } = await mount(model());
    expect(container.textContent).toContain('Clinic Account');
    expect(container.textContent).toContain('12345');
    expect(container.textContent).toContain('clinic.amocrm.ru');
    expect(container.textContent).toContain('Подключение действует только для текущей клиники.');
    expect(container.textContent).toContain('DentalFlow не отправляет сообщения и не синхронизирует данные в рамках этой версии.');
    expect(container.textContent).toContain('Никогда не вводите токены amoCRM вручную в интерфейс DentalFlow.');
    expect(container.textContent).not.toMatch(/access[_ ]?token|refresh[_ ]?token|client[_ ]?secret|authorization code/i);
    await act(async () => root.unmount());
    container.remove();
  });

  it('shows management controls to owner/admin', async () => {
    const viewModel = model();
    const { container, root } = await mount(viewModel);
    expect(container.textContent).toContain('Переподключить');
    expect(container.textContent).toContain('Проверить состояние');
    expect(container.textContent).toContain('Отключить');

    const buttons = Array.from(container.querySelectorAll('button'));
    const checkButton = buttons.find((button) => button.textContent?.includes('Проверить состояние'))!;
    const disconnectButton = buttons.find((button) => button.textContent?.includes('Отключить'))!;
    await act(async () => { checkButton.click(); disconnectButton.click(); });
    expect(viewModel.check).toHaveBeenCalledTimes(1);
    expect(viewModel.disconnect).toHaveBeenCalledTimes(1);
    await act(async () => root.unmount());
    container.remove();
  });

  it('keeps registrar read-only', async () => {
    const { container, root } = await mount(model({ role: 'registrar' }));
    expect(container.textContent).toContain('Clinic Account');
    expect(container.querySelectorAll('button')).toHaveLength(0);
    await act(async () => root.unmount());
    container.remove();
  });

  it.each(['doctor', 'cashier', undefined])('hides administration panel for %s', async (role) => {
    const { container, root } = await mount(model({ role }));
    expect(container.textContent).toBe('');
    await act(async () => root.unmount());
    container.remove();
  });

  it('shows safe error text without backend internals', async () => {
    const { container, root } = await mount(model({
      error: Object.assign(new Error('Доступ amoCRM отозван. Требуется повторное подключение.'), {
        name: 'AmoCrmIntegrationError',
        code: 'credential_revoked',
      }) as any,
    }));
    expect(container.textContent).toContain('Доступ amoCRM отозван');
    expect(container.textContent).not.toMatch(/SQLSTATE|constraint|stack trace|secret/i);
    await act(async () => root.unmount());
    container.remove();
  });

  it('contains no message-send or entity-sync action', async () => {
    const { container, root } = await mount(model());
    expect(container.textContent).not.toMatch(/Отправить сообщение|Синхронизировать контакты|Создать сделку|Создать задачу/);
    await act(async () => root.unmount());
    container.remove();
  });
});
