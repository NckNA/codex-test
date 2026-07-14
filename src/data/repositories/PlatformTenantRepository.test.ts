import { describe, expect, it, vi } from 'vitest';
import { PlatformTenantError, PlatformTenantRepository, mapPlatformTenantError } from './PlatformTenantRepository';

function client(data: unknown = null, error: unknown = null) {
  return { rpc: vi.fn(async (name: string, args?: Record<string, unknown>) => {
    void name;
    void args;
    return { data, error };
  }) };
}

describe('PlatformTenantRepository', () => {
  it('lists and deterministically sorts safe tenant DTOs', async () => {
    const rpcClient = client([
      { tenant_id: 'b', tenant_name: 'Beta', timezone: 'Asia/Almaty', stored_status: 'active', effective_status: 'active', owner_count: 1, lifecycle_version: 2 },
      { tenant_id: 'a', tenant_name: 'Alpha', timezone: 'Asia/Almaty', stored_status: 'suspended', effective_status: 'suspended', owner_count: 2, lifecycle_version: 3 },
    ]);
    const repository = new PlatformTenantRepository(rpcClient);
    const result = await repository.listTenants({ search: 'a', status: 'active' });
    expect(result.map((item) => item.tenantName)).toEqual(['Alpha', 'Beta']);
    expect(rpcClient.rpc).toHaveBeenCalledWith('list_platform_tenants', expect.objectContaining({ p_search: 'a', p_status: 'active' }));
    expect(result[0]).not.toHaveProperty('patients');
    expect(result[0]).not.toHaveProperty('payments');
  });

  it('maps lifecycle details and histories', async () => {
    const rpcClient = client({
      tenant: { tenantId: 't1', tenantName: 'Clinic', timezone: 'Asia/Almaty', storedStatus: 'active', effectiveStatus: 'active', lifecycleVersion: 4 },
      owners: [{ userId: 'u1', displayName: 'Owner', membershipStatus: 'active' }],
      subscriptionHistory: [{ id: 'p1', startsAt: '2026-01-01', expiresAt: '2026-12-01', status: 'active' }],
      lifecycleHistory: [{ id: 'a1', action: 'platform_tenant_created', metadata: {}, createdAt: '2026-01-01' }],
    });
    const result = await new PlatformTenantRepository(rpcClient).getTenant('t1');
    expect(result.owners[0].userId).toBe('u1');
    expect(result.subscriptionHistory[0].status).toBe('active');
    expect(result.lifecycleHistory[0].action).toBe('platform_tenant_created');
  });

  it('uses controlled RPCs for mutations and never direct table writes', async () => {
    const rpcClient = client({ ok: true });
    const repository = new PlatformTenantRepository(rpcClient);
    await repository.createTenant({ name: 'Clinic', ownerUserId: 'u1', subscriptionStartedAt: '2026-01-01', subscriptionExpiresAt: '2027-01-01', operationKey: 'create-1' });
    await repository.addOwner({ tenantId: 't1', ownerUserId: 'u2', operationKey: 'owner-1' });
    await repository.extendSubscription({ tenantId: 't1', newExpiresAt: '2028-01-01', reasonCode: 'renewal', operationKey: 'extend-1' });
    await repository.suspendTenant({ tenantId: 't1', reasonCode: 'administrative', operationKey: 'suspend-1' });
    await repository.resumeTenant({ tenantId: 't1', reasonCode: 'resolved', operationKey: 'resume-1' });
    await repository.archiveTenant({ tenantId: 't1', reasonCode: 'closed', confirmation: true, operationKey: 'archive-1' });
    expect(rpcClient.rpc.mock.calls.map((call) => call[0])).toEqual([
      'create_platform_tenant', 'add_platform_tenant_owner', 'extend_tenant_subscription', 'suspend_tenant', 'resume_tenant', 'archive_tenant',
    ]);
  });

  it('maps safe errors without leaking database details', async () => {
    const repository = new PlatformTenantRepository(client(null, { message: 'PLATFORM_ADMIN_REQUIRED constraint secret' }));
    await expect(repository.listTenants()).rejects.toEqual(expect.objectContaining({ code: 'permission', message: 'Недостаточно прав для управления платформой.' }));
    const error = mapPlatformTenantError({ message: 'LAST_ACTIVE_OWNER sqlstate 23514' });
    expect(error).toBeInstanceOf(PlatformTenantError);
    expect(error.message).not.toMatch(/sqlstate|constraint/i);
  });
});
