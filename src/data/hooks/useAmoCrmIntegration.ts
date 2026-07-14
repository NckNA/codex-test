import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useTenant } from '../../contexts/TenantContext';
import type { AmoCrmHealth } from '../../domain/integrations/amocrm/AmoCrmHealth';
import { toSafeAmoCrmError, type AmoCrmIntegrationError } from '../../domain/integrations/amocrm/AmoCrmIntegration';
import {
  AmoCrmIntegrationRepository,
  type AmoCrmIntegrationRepositoryContract,
} from '../repositories/AmoCrmIntegrationRepository';

interface UseAmoCrmIntegrationOptions {
  repositoryFactory?: (tenantId: string) => AmoCrmIntegrationRepositoryContract;
  openAuthorizationWindow?: (url: string) => void;
  callbackSearch?: string;
}

export interface UseAmoCrmIntegrationResult {
  health: AmoCrmHealth | null;
  loading: boolean;
  connecting: boolean;
  disconnecting: boolean;
  reconnecting: boolean;
  checking: boolean;
  error: AmoCrmIntegrationError | null;
  role?: string;
  connect: () => Promise<void>;
  disconnect: () => Promise<void>;
  reconnect: () => Promise<void>;
  check: () => Promise<void>;
}

interface TenantValue<T> {
  tenantId: string;
  value: T;
}

const defaultRepositoryFactory = (tenantId: string) => new AmoCrmIntegrationRepository(tenantId);
const defaultOpenWindow = (url: string) => {
  window.open(url, 'amocrm-oauth', 'popup,width=760,height=640,resizable=yes,scrollbars=yes');
};

export function useAmoCrmIntegration(
  options: UseAmoCrmIntegrationOptions = {},
): UseAmoCrmIntegrationResult {
  const { activeTenant } = useTenant();
  const tenantId = activeTenant?.tenantId;
  const role = activeTenant?.role;
  const canViewIntegration = role === 'clinic_owner' || role === 'clinic_admin' || role === 'registrar';
  const repositoryFactory = options.repositoryFactory ?? defaultRepositoryFactory;
  const openAuthorizationWindow = options.openAuthorizationWindow ?? defaultOpenWindow;
  const callbackSearch = options.callbackSearch ?? (typeof window === 'undefined' ? '' : window.location.search);

  const repository = useMemo(
    () => tenantId && canViewIntegration ? repositoryFactory(tenantId) : null,
    [canViewIntegration, repositoryFactory, tenantId],
  );

  const [healthState, setHealthState] = useState<TenantValue<AmoCrmHealth> | null>(null);
  const [errorState, setErrorState] = useState<TenantValue<AmoCrmIntegrationError> | null>(null);
  const [loadingTenant, setLoadingTenant] = useState<string | null>(null);
  const [connectingTenant, setConnectingTenant] = useState<string | null>(null);
  const [disconnectingTenant, setDisconnectingTenant] = useState<string | null>(null);
  const [reconnectingTenant, setReconnectingTenant] = useState<string | null>(null);
  const [checkingTenant, setCheckingTenant] = useState<string | null>(null);
  const requestSequence = useRef(0);
  const callbackHandled = useRef<string | null>(null);

  const health = healthState && healthState.tenantId === tenantId ? healthState.value : null;
  const error = errorState && errorState.tenantId === tenantId ? errorState.value : null;
  const loading = Boolean(tenantId && loadingTenant === tenantId);
  const connecting = Boolean(tenantId && connectingTenant === tenantId);
  const disconnecting = Boolean(tenantId && disconnectingTenant === tenantId);
  const reconnecting = Boolean(tenantId && reconnectingTenant === tenantId);
  const checking = Boolean(tenantId && checkingTenant === tenantId);

  const loadHealth = useCallback(async (mode: 'load' | 'check' = 'load') => {
    if (!repository || !tenantId) return;
    const targetTenant = tenantId;
    const sequence = ++requestSequence.current;
    if (mode === 'load') setLoadingTenant(targetTenant);
    else setCheckingTenant(targetTenant);
    setErrorState(null);
    try {
      const next = mode === 'check'
        ? await repository.requestAmoCrmHealthRefresh()
        : await repository.getAmoCrmIntegrationHealth();
      if (sequence === requestSequence.current) {
        setHealthState({ tenantId: targetTenant, value: next });
      }
    } catch (cause) {
      if (sequence === requestSequence.current) {
        setErrorState({ tenantId: targetTenant, value: toSafeAmoCrmError(cause) });
      }
    } finally {
      if (sequence === requestSequence.current) {
        if (mode === 'load') setLoadingTenant(null);
        else setCheckingTenant(null);
      }
    }
  }, [repository, tenantId]);

  useEffect(() => {
    requestSequence.current += 1;
    const params = new URLSearchParams(callbackSearch);
    const callbackStatus = params.get('amocrm_status');
    callbackHandled.current = tenantId && callbackStatus
      ? `${tenantId}:${callbackStatus}:${params.get('amocrm_error') || ''}`
      : null;
    if (!tenantId) return undefined;
    let active = true;
    queueMicrotask(() => { if (active) void loadHealth(); });
    return () => { active = false; };
  }, [callbackSearch, tenantId, loadHealth]);

  useEffect(() => {
    if (!tenantId || !repository) return;
    const params = new URLSearchParams(callbackSearch);
    const callbackStatus = params.get('amocrm_status');
    if (!callbackStatus) return;
    const callbackKey = `${tenantId}:${callbackStatus}:${params.get('amocrm_error') || ''}`;
    if (callbackHandled.current === callbackKey) return;
    callbackHandled.current = callbackKey;
    let active = true;
    queueMicrotask(() => { if (active) void loadHealth(); });
    return () => { active = false; };
  }, [callbackSearch, loadHealth, repository, tenantId]);

  const connect = useCallback(async () => {
    if (!repository || !tenantId || connecting || reconnecting) return;
    const targetTenant = tenantId;
    setConnectingTenant(targetTenant);
    setErrorState(null);
    try {
      const result = await repository.startAmoCrmConnection();
      openAuthorizationWindow(result.authorizationUrl);
    } catch (cause) {
      setErrorState({ tenantId: targetTenant, value: toSafeAmoCrmError(cause) });
    } finally {
      setConnectingTenant((current) => current === targetTenant ? null : current);
    }
  }, [connecting, openAuthorizationWindow, reconnecting, repository, tenantId]);

  const reconnect = useCallback(async () => {
    if (!repository || !tenantId || reconnecting || connecting) return;
    const targetTenant = tenantId;
    setReconnectingTenant(targetTenant);
    setErrorState(null);
    try {
      const result = await repository.reconnectAmoCrmConnection();
      openAuthorizationWindow(result.authorizationUrl);
    } catch (cause) {
      setErrorState({ tenantId: targetTenant, value: toSafeAmoCrmError(cause) });
    } finally {
      setReconnectingTenant((current) => current === targetTenant ? null : current);
    }
  }, [connecting, openAuthorizationWindow, reconnecting, repository, tenantId]);

  const disconnect = useCallback(async () => {
    if (!repository || !tenantId || disconnecting) return;
    const targetTenant = tenantId;
    setDisconnectingTenant(targetTenant);
    setErrorState(null);
    try {
      const next = await repository.disconnectAmoCrmConnection();
      setHealthState({ tenantId: targetTenant, value: next });
    } catch (cause) {
      setErrorState({ tenantId: targetTenant, value: toSafeAmoCrmError(cause) });
    } finally {
      setDisconnectingTenant((current) => current === targetTenant ? null : current);
    }
  }, [disconnecting, repository, tenantId]);

  const check = useCallback(async () => {
    if (checking) return;
    await loadHealth('check');
  }, [checking, loadHealth]);

  return {
    health,
    loading,
    connecting,
    disconnecting,
    reconnecting,
    checking,
    error,
    role,
    connect,
    disconnect,
    reconnect,
    check,
  };
}
