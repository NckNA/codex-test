// @vitest-environment jsdom
(globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
import { act } from 'react';
import { createRoot } from 'react-dom/client';
import { describe, expect, it, vi } from 'vitest';
import { CreateTenantDialog } from './CreateTenantDialog';

async function mount(onCreate = vi.fn(async () => true)) {
  const container = document.createElement('div');
  const root = createRoot(container);
  await act(async () => root.render(<CreateTenantDialog open onCancel={vi.fn()} onCreate={onCreate} />));
  return { container, root, onCreate };
}

function input(container: HTMLElement, label: string): HTMLInputElement {
  return container.querySelector(`input[aria-label="${label}"]`) as HTMLInputElement;
}

async function change(element: HTMLInputElement, value: string) {
  await act(async () => {
    const setter = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value')?.set;
    setter?.call(element, value);
    element.dispatchEvent(new Event('input', { bubbles: true }));
    element.dispatchEvent(new Event('change', { bubbles: true }));
  });
}

describe('CreateTenantDialog', () => {
  it('shows owner isolation warning and requires owner', async () => {
    const { container, root, onCreate } = await mount();
    expect(container.textContent).toContain('не становится администратором платформы');
    await act(async () => { (container.querySelector('button:last-of-type') as HTMLButtonElement).click(); });
    expect(container.textContent).toContain('корректное название');
    expect(onCreate).not.toHaveBeenCalled();
    await act(async () => root.unmount());
  });

  it('validates dates and submits controlled command', async () => {
    const { container, root, onCreate } = await mount();
    await change(input(container, 'Название клиники'), 'Новая клиника');
    await change(input(container, 'ID владельца'), '35010000-0000-4000-8000-000000000001');
    await change(input(container, 'Начало подписки'), '2026-07-01T10:00');
    await change(input(container, 'Окончание подписки'), '2027-07-01T10:00');
    await act(async () => { input(container, 'Подтверждение создания').click(); });
    await act(async () => { (container.querySelector('button:last-of-type') as HTMLButtonElement).click(); });
    expect(onCreate).toHaveBeenCalledWith(expect.objectContaining({ name: 'Новая клиника', ownerUserId: expect.any(String), operationKey: expect.any(String) }));
    await act(async () => root.unmount());
  });
});
