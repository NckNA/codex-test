/* eslint-disable @typescript-eslint/no-explicit-any */
// @vitest-environment jsdom
(globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
import { act } from 'react';
import { createRoot } from 'react-dom/client';
import { describe, expect, it, vi } from 'vitest';
import { usePlatformTenants, type UsePlatformTenantsResult } from './usePlatformTenants';

function tenant(id: string, name: string) {
  return { tenantId: id, tenantName: name, timezone: 'Asia/Almaty', storedStatus: 'active' as const, effectiveStatus: 'active' as const, ownerCount: 1, lifecycleVersion: 1 };
}

async function mount(repository: any) {
  let current: UsePlatformTenantsResult | null = null;
  const container = document.createElement('div');
  const root = createRoot(container);
  function Probe() { current = usePlatformTenants({ repositoryFactory: () => repository, autoLoad: false }); return null; }
  await act(async () => { root.render(<Probe />); });
  return { get current() { return current!; }, root };
}

describe('usePlatformTenants', () => {
  it('loads platform status and tenant list', async () => {
    const repository = {
      getPlatformAdminStatus: vi.fn(async () => ({ isPlatformSuperadmin: true, status: 'active' })),
      listTenants: vi.fn(async () => [tenant('t1', 'Clinic')]),
    };
    const mounted = await mount(repository);
    await act(async () => { await mounted.current.refresh(); });
    expect(mounted.current.adminStatus?.isPlatformSuperadmin).toBe(true);
    expect(mounted.current.tenants[0].tenantName).toBe('Clinic');
    await act(async () => mounted.root.unmount());
  });

  it('does not list tenants for disabled platform admin', async () => {
    const repository = {
      getPlatformAdminStatus: vi.fn(async () => ({ isPlatformSuperadmin: false, status: 'disabled' })),
      listTenants: vi.fn(),
    };
    const mounted = await mount(repository);
    await act(async () => { await mounted.current.refresh(); });
    expect(repository.listTenants).not.toHaveBeenCalled();
    expect(mounted.current.tenants).toEqual([]);
    await act(async () => mounted.root.unmount());
  });

  it('ignores stale list response', async () => {
    let resolveFirst!: (value: any[]) => void;
    const first = new Promise<any[]>((resolve) => { resolveFirst = resolve; });
    const repository = {
      getPlatformAdminStatus: vi.fn(async () => ({ isPlatformSuperadmin: true, status: 'active' })),
      listTenants: vi.fn().mockReturnValueOnce(first).mockResolvedValueOnce([tenant('new', 'New')]),
    };
    const mounted = await mount(repository);
    let pending!: Promise<void>;
    await act(async () => { pending = mounted.current.refresh(); });
    await act(async () => { await mounted.current.refresh(); });
    await act(async () => { resolveFirst([tenant('old', 'Old')]); await pending; });
    expect(mounted.current.tenants.map((item) => item.tenantName)).toEqual(['New']);
    await act(async () => mounted.root.unmount());
  });

  it('blocks duplicate action while one is pending', async () => {
    let resolveCreate!: () => void;
    const repository = {
      getPlatformAdminStatus: vi.fn(async () => ({ isPlatformSuperadmin: true, status: 'active' })),
      listTenants: vi.fn(async () => []),
      createTenant: vi.fn(() => new Promise<void>((resolve) => { resolveCreate = resolve; })),
    };
    const mounted = await mount(repository);
    const command = { name: 'Clinic', ownerUserId: 'u1', subscriptionStartedAt: '2026-01-01', subscriptionExpiresAt: '2027-01-01', operationKey: 'op-1' };
    let first!: Promise<boolean>;
    await act(async () => { first = mounted.current.createTenant(command); });
    let second = true;
    await act(async () => { second = await mounted.current.createTenant(command); });
    expect(second).toBe(false);
    expect(repository.createTenant).toHaveBeenCalledTimes(1);
    await act(async () => { resolveCreate(); await first; });
    await act(async () => mounted.root.unmount());
  });
});
