import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type { PlatformAdminStatusResult } from '../../domain/platform/PlatformAdmin';
import type { TenantLifecycleStatus } from '../../domain/platform/TenantLifecycle';
import {
  PlatformTenantRepository,
  mapPlatformTenantError,
  type ArchiveTenantCommand,
  type ChangeTenantSubscriptionCommand,
  type CreatePlatformTenantCommand,
  type PlatformTenantDetails,
  type PlatformTenantError,
  type PlatformTenantFilters,
  type PlatformTenantListItem,
  type ReplaceTenantOwnerCommand,
  type ResumeTenantCommand,
  type SetTenantSubscriptionCommand,
  type ShortenTenantSubscriptionCommand,
  type SuspendTenantCommand,
  type TenantOwnerCommand,
} from '../repositories/PlatformTenantRepository';

export interface UsePlatformTenantsOptions {
  repositoryFactory?: () => PlatformTenantRepository;
  autoLoad?: boolean;
}

export interface UsePlatformTenantsResult {
  adminStatus: PlatformAdminStatusResult | null;
  tenants: PlatformTenantListItem[];
  selectedTenant: PlatformTenantDetails | null;
  filters: PlatformTenantFilters;
  loading: boolean;
  detailsLoading: boolean;
  actionPending: boolean;
  error: PlatformTenantError | null;
  setSearch: (search: string) => void;
  setStatus: (status: TenantLifecycleStatus | '') => void;
  refresh: () => Promise<void>;
  openTenant: (tenantId: string) => Promise<void>;
  createTenant: (command: CreatePlatformTenantCommand) => Promise<boolean>;
  addOwner: (command: TenantOwnerCommand) => Promise<boolean>;
  replaceOwner: (command: ReplaceTenantOwnerCommand) => Promise<boolean>;
  removeOwner: (command: TenantOwnerCommand) => Promise<boolean>;
  setSubscription: (command: SetTenantSubscriptionCommand) => Promise<boolean>;
  extendSubscription: (command: ChangeTenantSubscriptionCommand) => Promise<boolean>;
  shortenSubscription: (command: ShortenTenantSubscriptionCommand) => Promise<boolean>;
  suspendTenant: (command: SuspendTenantCommand) => Promise<boolean>;
  resumeTenant: (command: ResumeTenantCommand) => Promise<boolean>;
  archiveTenant: (command: ArchiveTenantCommand) => Promise<boolean>;
}

const defaultFactory = () => new PlatformTenantRepository();

export function usePlatformTenants(options: UsePlatformTenantsOptions = {}): UsePlatformTenantsResult {
  const repositoryFactory = options.repositoryFactory ?? defaultFactory;
  const repository = useMemo(() => repositoryFactory(), [repositoryFactory]);
  const [adminStatus, setAdminStatus] = useState<PlatformAdminStatusResult | null>(null);
  const [tenants, setTenants] = useState<PlatformTenantListItem[]>([]);
  const [selectedTenant, setSelectedTenant] = useState<PlatformTenantDetails | null>(null);
  const [filters, setFilters] = useState<PlatformTenantFilters>({ search: '', status: '', limit: 50, offset: 0 });
  const [loading, setLoading] = useState(false);
  const [detailsLoading, setDetailsLoading] = useState(false);
  const [actionPending, setActionPending] = useState(false);
  const [error, setError] = useState<PlatformTenantError | null>(null);
  const listRequest = useRef(0);
  const detailsRequest = useRef(0);

  const refresh = useCallback(async () => {
    const sequence = ++listRequest.current;
    setLoading(true);
    setError(null);
    try {
      const status = await repository.getPlatformAdminStatus();
      if (sequence !== listRequest.current) return;
      setAdminStatus(status);
      if (!status.isPlatformSuperadmin) {
        setTenants([]);
        return;
      }
      const next = await repository.listTenants(filters);
      if (sequence === listRequest.current) setTenants(next);
    } catch (cause) {
      if (sequence === listRequest.current) setError(mapPlatformTenantError(cause));
    } finally {
      if (sequence === listRequest.current) setLoading(false);
    }
  }, [filters, repository]);

  const openTenant = useCallback(async (tenantId: string) => {
    const sequence = ++detailsRequest.current;
    setDetailsLoading(true);
    setError(null);
    try {
      const details = await repository.getTenant(tenantId);
      if (sequence === detailsRequest.current) setSelectedTenant(details);
    } catch (cause) {
      if (sequence === detailsRequest.current) setError(mapPlatformTenantError(cause));
    } finally {
      if (sequence === detailsRequest.current) setDetailsLoading(false);
    }
  }, [repository]);

  useEffect(() => {
    if (options.autoLoad === false) return;
    let active = true;
    queueMicrotask(() => { if (active) void refresh(); });
    return () => { active = false; listRequest.current += 1; detailsRequest.current += 1; };
  }, [options.autoLoad, refresh]);

  const runAction = useCallback(async (action: () => Promise<unknown>, tenantId?: string): Promise<boolean> => {
    if (actionPending) return false;
    setActionPending(true);
    setError(null);
    try {
      await action();
      await refresh();
      if (tenantId) await openTenant(tenantId);
      return true;
    } catch (cause) {
      setError(mapPlatformTenantError(cause));
      return false;
    } finally {
      setActionPending(false);
    }
  }, [actionPending, openTenant, refresh]);

  return {
    adminStatus, tenants, selectedTenant, filters, loading, detailsLoading, actionPending, error,
    setSearch: (search) => setFilters((current) => ({ ...current, search, offset: 0 })),
    setStatus: (status) => setFilters((current) => ({ ...current, status, offset: 0 })),
    refresh,
    openTenant,
    createTenant: (command) => runAction(() => repository.createTenant(command)),
    addOwner: (command) => runAction(() => repository.addOwner(command), command.tenantId),
    replaceOwner: (command) => runAction(() => repository.replaceOwner(command), command.tenantId),
    removeOwner: (command) => runAction(() => repository.removeOwner(command), command.tenantId),
    setSubscription: (command) => runAction(() => repository.setSubscription(command), command.tenantId),
    extendSubscription: (command) => runAction(() => repository.extendSubscription(command), command.tenantId),
    shortenSubscription: (command) => runAction(() => repository.shortenSubscription(command), command.tenantId),
    suspendTenant: (command) => runAction(() => repository.suspendTenant(command), command.tenantId),
    resumeTenant: (command) => runAction(() => repository.resumeTenant(command), command.tenantId),
    archiveTenant: (command) => runAction(() => repository.archiveTenant(command), command.tenantId),
  };
}
