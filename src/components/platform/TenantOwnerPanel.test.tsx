// @vitest-environment jsdom
(globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
import { act } from 'react';
import { createRoot } from 'react-dom/client';
import { describe, expect, it, vi } from 'vitest';
import { TenantOwnerPanel } from './TenantOwnerPanel';

async function mount(ownerCount = 1) {
  const container = document.createElement('div');
  const root = createRoot(container);
  const onAdd = vi.fn(async () => true);
  const onReplace = vi.fn(async () => true);
  const onRemove = vi.fn(async () => true);
  const owners = Array.from({ length: ownerCount }, (_, index) => ({ userId: `u${index + 1}`, displayName: `Owner ${index + 1}`, membershipStatus: 'active' }));
  await act(async () => root.render(<TenantOwnerPanel tenantId="t1" owners={owners} onAdd={onAdd} onReplace={onReplace} onRemove={onRemove} />));
  return { container, root, onAdd, onRemove };
}

describe('TenantOwnerPanel', () => {
  it('protects final active owner', async () => {
    const { container, root, onRemove } = await mount(1);
    const remove = Array.from(container.querySelectorAll('button')).find((button) => button.textContent?.includes('Убрать владельца'))!;
    expect(remove.disabled).toBe(true);
    remove.click();
    expect(onRemove).not.toHaveBeenCalled();
    expect(container.textContent).toContain('Нельзя удалить последнего');
    await act(async () => root.unmount());
  });

  it('allows recovery by adding another owner', async () => {
    const { container, root, onAdd } = await mount(2);
    const input = container.querySelector('input[aria-label="ID нового владельца"]') as HTMLInputElement;
    await act(async () => {
      const setter = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value')?.set;
      setter?.call(input, 'u3'); input.dispatchEvent(new Event('input', { bubbles: true }));
    });
    const add = Array.from(container.querySelectorAll('button')).find((button) => button.textContent?.includes('Добавить владельца'))!;
    await act(async () => add.click());
    expect(onAdd).toHaveBeenCalledWith('u3');
    await act(async () => root.unmount());
  });
});
