// @vitest-environment jsdom
(globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
import { act } from 'react';
import { createRoot } from 'react-dom/client';
import { describe, expect, it, vi } from 'vitest';
import { TenantLifecyclePanel } from './TenantLifecyclePanel';

const lifecycle = {
  tenantId: 't1', tenantName: 'Clinic', storedStatus: 'active' as const, effectiveStatus: 'active' as const,
  subscriptionStartedAt: '2026-01-01T00:00:00Z', subscriptionExpiresAt: '2027-01-01T00:00:00Z', lifecycleVersion: 1,
};

async function mount(overrides = {}) {
  const container = document.createElement('div');
  const root = createRoot(container);
  const props = { onExtend: vi.fn(), onShorten: vi.fn(), onSuspend: vi.fn(), onResume: vi.fn(), onArchive: vi.fn(), ...overrides };
  await act(async () => root.render(<TenantLifecyclePanel lifecycle={lifecycle} {...props} />));
  return { container, root, props };
}

describe('TenantLifecyclePanel', () => {
  it('shows lifecycle without patient or financial data', async () => {
    const { container, root } = await mount();
    expect(container.textContent).toContain('Эффективный статус');
    expect(container.textContent).toContain('Физическое удаление клиники не поддерживается');
    expect(container.textContent).not.toMatch(/ФИО пациента|Диагноз пациента|Сумма платежа|Номер счёта/i);
    expect(container.textContent).not.toContain('Удалить навсегда');
    await act(async () => root.unmount());
  });

  it('requires archive confirmation', async () => {
    const { container, root, props } = await mount();
    const archive = container.querySelector('[data-testid="archive-tenant"]') as HTMLButtonElement;
    expect(archive.disabled).toBe(true);
    await act(async () => { (container.querySelector('input[aria-label="Подтверждение архивирования"]') as HTMLInputElement).click(); });
    expect(archive.disabled).toBe(false);
    await act(async () => archive.click());
    expect(props.onArchive).toHaveBeenCalledWith('administrative_archive');
    await act(async () => root.unmount());
  });

  it('requires explicit confirmation before shortening subscription', async () => {
    const { container, root, props } = await mount();
    const expiry = container.querySelector('input[aria-label="Новая дата окончания"]') as HTMLInputElement;
    await act(async () => {
      const setter = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value')?.set;
      setter?.call(expiry, '2026-06-01T10:00');
      expiry.dispatchEvent(new Event('input', { bubbles: true }));
      expiry.dispatchEvent(new Event('change', { bubbles: true }));
    });
    const change = container.querySelector('[data-testid="extend-subscription"]') as HTMLButtonElement;
    expect(change.disabled).toBe(true);
    await act(async () => { (container.querySelector('input[aria-label="Подтверждение сокращения подписки"]') as HTMLInputElement).click(); });
    expect(change.disabled).toBe(false);
    await act(async () => change.click());
    expect(props.onShorten).toHaveBeenCalledWith(expect.stringContaining('2026-06-01'), undefined, true);
    await act(async () => root.unmount());
  });

  it('shows resume action only for suspended tenant', async () => {
    const onResume = vi.fn();
    const container = document.createElement('div');
    const root = createRoot(container);
    await act(async () => root.render(<TenantLifecyclePanel lifecycle={{ ...lifecycle, storedStatus: 'suspended', effectiveStatus: 'suspended' }} onExtend={vi.fn()} onShorten={vi.fn()} onSuspend={vi.fn()} onResume={onResume} onArchive={vi.fn()} />));
    const resume = Array.from(container.querySelectorAll('button')).find((button) => button.textContent?.includes('Возобновить'))!;
    await act(async () => resume.click());
    expect(onResume).toHaveBeenCalledTimes(1);
    await act(async () => root.unmount());
  });
});
