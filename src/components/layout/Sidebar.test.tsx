// @vitest-environment jsdom
(globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

import { act } from 'react';
import { createRoot } from 'react-dom/client';
import { MemoryRouter } from 'react-router-dom';
import { describe, expect, it, vi } from 'vitest';
import { useTenant } from '../../contexts/TenantContext';
import { Sidebar } from './Sidebar';

vi.mock('../../contexts/TenantContext', () => ({ useTenant: vi.fn() }));

const mockedUseTenant = vi.mocked(useTenant);

async function renderForRole(role: string | null) {
  mockedUseTenant.mockReturnValue({
    activeTenant: role
      ? { tenantId: 'tenant-a', tenantName: 'Clinic A', timezone: 'Asia/Almaty', role }
      : null,
  } as unknown as ReturnType<typeof useTenant>);
  const container = document.createElement('div');
  document.body.appendChild(container);
  const root = createRoot(container);
  await act(async () => {
    root.render(<MemoryRouter><Sidebar /></MemoryRouter>);
  });
  return {
    container,
    unmount: async () => {
      await act(async () => root.unmount());
      container.remove();
    },
  };
}

describe('Sidebar laboratory navigation', () => {
  it.each(['clinic_owner', 'clinic_admin', 'doctor', 'registrar'])('shows Laboratory for %s', async (role) => {
    const view = await renderForRole(role);
    const link = view.container.querySelector('a[href="/laboratory"]');
    expect(link?.textContent).toContain('Лаборатория');
    await view.unmount();
  });

  it.each(['cashier', 'receptionist'])('hides Laboratory for unsupported role %s', async (role) => {
    const view = await renderForRole(role);
    expect(view.container.querySelector('a[href="/laboratory"]')).toBeNull();
    await view.unmount();
  });

  it('keeps Laboratory visible in dev/no-tenant mode', async () => {
    const view = await renderForRole(null);
    expect(view.container.querySelector('a[href="/laboratory"]')?.textContent).toContain('Лаборатория');
    await view.unmount();
  });
});
