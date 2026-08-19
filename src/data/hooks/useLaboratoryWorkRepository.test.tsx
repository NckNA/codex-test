// @vitest-environment jsdom
(globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import * as AuthContext from '../../contexts/AuthContext';
import * as TenantContext from '../../contexts/TenantContext';
import type { ILaboratoryWorkRepository } from '../repositories/LaboratoryWorkRepository';
import {
  resolveLaboratoryWorkRepositorySelection,
  useLaboratoryWorkRepository,
  type UseLaboratoryWorkRepositoryResult,
} from './useLaboratoryWorkRepository';

vi.mock('../../lib/supabaseClient', () => ({
  isSupabaseConfigured: true,
  supabase: {},
}));

const repositoryStub = {} as ILaboratoryWorkRepository;

function mockAuth({
  authMode,
  userId = null,
  isLoading = false,
}: {
  authMode: 'dev' | 'supabase-active';
  userId?: string | null;
  isLoading?: boolean;
}) {
  vi.spyOn(AuthContext, 'useAuth').mockReturnValue({
    authMode,
    user: userId ? { id: userId, email: 'user@example.com' } : null,
    isLoading,
  } as unknown as ReturnType<typeof AuthContext.useAuth>);
}

function mockTenant({
  tenantId = null,
  isLoading = false,
}: {
  tenantId?: string | null;
  isLoading?: boolean;
}) {
  vi.spyOn(TenantContext, 'useTenant').mockReturnValue({
    activeTenant: tenantId ? { tenantId } : null,
    isLoading,
  } as unknown as ReturnType<typeof TenantContext.useTenant>);
}

function Harness({
  repositoryFactory,
  onResult,
}: {
  repositoryFactory: (config: { backend: 'local' | 'supabase'; tenantId?: string; userId?: string }) => ILaboratoryWorkRepository;
  onResult: (result: UseLaboratoryWorkRepositoryResult) => void;
}) {
  const result = useLaboratoryWorkRepository({ repositoryFactory });
  onResult(result);
  return null;
}

describe('resolveLaboratoryWorkRepositorySelection', () => {
  it('keeps development mode local', () => {
    expect(resolveLaboratoryWorkRepositorySelection({
      authMode: 'dev',
      authLoading: false,
      tenantLoading: false,
      userId: 'dev-user',
      tenantId: 'dev-tenant',
      supabaseConfigured: true,
    })).toEqual({
      backend: 'local',
      tenantId: 'dev-tenant',
      userId: 'dev-user',
      ready: true,
    });
  });

  it('selects Supabase only with configured auth, user and active tenant', () => {
    expect(resolveLaboratoryWorkRepositorySelection({
      authMode: 'supabase-active',
      authLoading: false,
      tenantLoading: false,
      userId: 'user-1',
      tenantId: 'tenant-1',
      supabaseConfigured: true,
    })).toEqual({
      backend: 'supabase',
      tenantId: 'tenant-1',
      userId: 'user-1',
      ready: true,
    });
  });

  it.each([
    { label: 'missing user', userId: null, tenantId: 'tenant-1', authLoading: false, tenantLoading: false, supabaseConfigured: true },
    { label: 'missing tenant', userId: 'user-1', tenantId: null, authLoading: false, tenantLoading: false, supabaseConfigured: true },
    { label: 'auth loading', userId: 'user-1', tenantId: 'tenant-1', authLoading: true, tenantLoading: false, supabaseConfigured: true },
    { label: 'tenant loading', userId: 'user-1', tenantId: 'tenant-1', authLoading: false, tenantLoading: true, supabaseConfigured: true },
    { label: 'Supabase unavailable', userId: 'user-1', tenantId: 'tenant-1', authLoading: false, tenantLoading: false, supabaseConfigured: false },
  ])('fails closed in production mode for $label', ({ userId, tenantId, authLoading, tenantLoading, supabaseConfigured }) => {
    const selection = resolveLaboratoryWorkRepositorySelection({
      authMode: 'supabase-active',
      authLoading,
      tenantLoading,
      userId,
      tenantId,
      supabaseConfigured,
    });

    expect(selection.backend).toBe('unavailable');
    expect(selection.ready).toBe(false);
  });
});

describe('useLaboratoryWorkRepository', () => {
  let container: HTMLDivElement;
  let root: Root;

  beforeEach(() => {
    vi.restoreAllMocks();
    container = document.createElement('div');
    document.body.appendChild(container);
    root = createRoot(container);
  });

  afterEach(async () => {
    await act(async () => root.unmount());
    container.remove();
  });

  it('builds a local repository in dev mode with the current tenant context', async () => {
    mockAuth({ authMode: 'dev', userId: 'dev-user' });
    mockTenant({ tenantId: 'dev-tenant' });
    const repositoryFactory = vi.fn(() => repositoryStub);
    let latest: UseLaboratoryWorkRepositoryResult | null = null;

    await act(async () => {
      root.render(<Harness repositoryFactory={repositoryFactory} onResult={(result) => { latest = result; }} />);
    });

    expect(repositoryFactory).toHaveBeenCalledWith({
      backend: 'local',
      tenantId: 'dev-tenant',
      userId: 'dev-user',
    });
    expect(latest).toMatchObject({ backend: 'local', ready: true, repository: repositoryStub });
  });

  it('builds a tenant/user scoped Supabase repository in authenticated mode', async () => {
    mockAuth({ authMode: 'supabase-active', userId: 'user-1' });
    mockTenant({ tenantId: 'tenant-1' });
    const repositoryFactory = vi.fn(() => repositoryStub);
    let latest: UseLaboratoryWorkRepositoryResult | null = null;

    await act(async () => {
      root.render(<Harness repositoryFactory={repositoryFactory} onResult={(result) => { latest = result; }} />);
    });

    expect(repositoryFactory).toHaveBeenCalledWith({
      backend: 'supabase',
      tenantId: 'tenant-1',
      userId: 'user-1',
    });
    expect(latest).toMatchObject({
      backend: 'supabase',
      tenantId: 'tenant-1',
      userId: 'user-1',
      ready: true,
      repository: repositoryStub,
    });
  });

  it('does not silently create a local repository while production tenant context is unavailable', async () => {
    mockAuth({ authMode: 'supabase-active', userId: 'user-1' });
    mockTenant({ tenantId: null });
    const repositoryFactory = vi.fn(() => repositoryStub);
    let latest: UseLaboratoryWorkRepositoryResult | null = null;

    await act(async () => {
      root.render(<Harness repositoryFactory={repositoryFactory} onResult={(result) => { latest = result; }} />);
    });

    expect(repositoryFactory).not.toHaveBeenCalled();
    expect(latest).toMatchObject({
      backend: 'unavailable',
      ready: false,
      repository: null,
    });
  });
});
