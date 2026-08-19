import { useMemo } from 'react';
import { useAuth } from '../../contexts/AuthContext';
import { useTenant } from '../../contexts/TenantContext';
import { isSupabaseConfigured } from '../../lib/supabaseClient';
import {
  createLaboratoryWorkRepository,
  type ILaboratoryWorkRepository,
} from '../repositories/LaboratoryWorkRepository';

export type LaboratoryWorkRepositoryBackend = 'local' | 'supabase' | 'unavailable';

export interface LaboratoryWorkRepositorySelectionInput {
  authMode: 'dev' | 'supabase-active';
  authLoading: boolean;
  tenantLoading: boolean;
  userId?: string | null;
  tenantId?: string | null;
  supabaseConfigured: boolean;
}

export interface LaboratoryWorkRepositorySelection {
  backend: LaboratoryWorkRepositoryBackend;
  tenantId: string | null;
  userId: string | null;
  ready: boolean;
}

export interface UseLaboratoryWorkRepositoryResult extends LaboratoryWorkRepositorySelection {
  repository: ILaboratoryWorkRepository | null;
}

interface RepositoryFactoryConfig {
  backend: 'local' | 'supabase';
  tenantId?: string;
  userId?: string;
}

type RepositoryFactory = (config: RepositoryFactoryConfig) => ILaboratoryWorkRepository;

interface UseLaboratoryWorkRepositoryOptions {
  repositoryFactory?: RepositoryFactory;
}

const defaultRepositoryFactory: RepositoryFactory = (config) => createLaboratoryWorkRepository(config);

export function resolveLaboratoryWorkRepositorySelection({
  authMode,
  authLoading,
  tenantLoading,
  userId,
  tenantId,
  supabaseConfigured,
}: LaboratoryWorkRepositorySelectionInput): LaboratoryWorkRepositorySelection {
  const normalizedTenantId = tenantId || null;
  const normalizedUserId = userId || null;

  if (authMode === 'dev') {
    return {
      backend: 'local',
      tenantId: normalizedTenantId,
      userId: normalizedUserId,
      ready: true,
    };
  }

  if (
    authLoading
    || tenantLoading
    || !supabaseConfigured
    || !normalizedTenantId
    || !normalizedUserId
  ) {
    return {
      backend: 'unavailable',
      tenantId: normalizedTenantId,
      userId: normalizedUserId,
      ready: false,
    };
  }

  return {
    backend: 'supabase',
    tenantId: normalizedTenantId,
    userId: normalizedUserId,
    ready: true,
  };
}

export function useLaboratoryWorkRepository(
  options: UseLaboratoryWorkRepositoryOptions = {},
): UseLaboratoryWorkRepositoryResult {
  const { authMode, isLoading: authLoading, user } = useAuth();
  const { activeTenant, isLoading: tenantLoading } = useTenant();
  const repositoryFactory = options.repositoryFactory ?? defaultRepositoryFactory;

  const selection = resolveLaboratoryWorkRepositorySelection({
    authMode,
    authLoading,
    tenantLoading,
    userId: user?.id,
    tenantId: activeTenant?.tenantId,
    supabaseConfigured: isSupabaseConfigured,
  });

  const repository = useMemo(() => {
    if (!selection.ready || selection.backend === 'unavailable') return null;

    return repositoryFactory({
      backend: selection.backend,
      tenantId: selection.tenantId ?? undefined,
      userId: selection.userId ?? undefined,
    });
  }, [repositoryFactory, selection.backend, selection.ready, selection.tenantId, selection.userId]);

  return {
    ...selection,
    repository,
  };
}
