import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useAuth } from '../../contexts/AuthContext';
import { useTenant } from '../../contexts/TenantContext';
import { isSupabaseConfigured } from '../../lib/supabaseClient';
import type {
  PatientAutomatedCommunicationChannel,
  PatientCommunicationConsentSource,
  PatientCommunicationConsentState,
  PatientCommunicationLanguage,
  PatientCommunicationProfile,
  PatientCommunicationSuppressionReason,
  PatientPreferredCommunicationChannel,
} from '../../types';
import {
  createPatientCommunicationRepository,
  PatientCommunicationRepositoryError,
  type PatientCommunicationRepository,
  type UpsertPatientCommunicationContactInput,
} from '../repositories/PatientCommunicationRepository';

const MUTATION_ROLES = new Set(['clinic_owner', 'clinic_admin', 'registrar']);

const operationKey = (action: string, patientId: string): string => {
  const random = typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function'
    ? crypto.randomUUID()
    : `${Date.now()}-${Math.random().toString(16).slice(2)}`;
  return `patient-communication-${action}-${patientId}-${random}`;
};

export function usePatientCommunicationProfile(patientId?: string | null) {
  const { activeTenant } = useTenant();
  const { authMode } = useAuth();
  const tenantId = activeTenant?.tenantId ?? null;
  const canMutate = MUTATION_ROLES.has(activeTenant?.role ?? '');
  const backend = authMode === 'supabase-active' && tenantId && isSupabaseConfigured ? 'supabase' : 'local';

  const repository = useMemo(() => {
    if (authMode === 'supabase-active' && !tenantId) return null;
    return createPatientCommunicationRepository({ backend, tenantId });
  }, [authMode, backend, tenantId]);

  const [profile, setProfile] = useState<PatientCommunicationProfile | null>(null);
  const [loading, setLoading] = useState(false);
  const [savingContact, setSavingContact] = useState(false);
  const [updatingConsent, setUpdatingConsent] = useState(false);
  const [updatingPreferences, setUpdatingPreferences] = useState(false);
  const [updatingSuppression, setUpdatingSuppression] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const sequence = useRef(0);
  const busy = useRef(new Set<string>());

  const load = useCallback(async (
    repositoryValue: PatientCommunicationRepository,
    tenantValue: string,
    patientValue: string,
    clearPrevious: boolean,
  ) => {
    const request = ++sequence.current;
    if (clearPrevious) setProfile(null);
    setLoading(true);
    setError(null);
    try {
      const nextProfile = await repositoryValue.getPatientCommunicationProfile(patientValue);
      if (request !== sequence.current || tenantValue !== tenantId || patientValue !== patientId) return;
      setProfile(nextProfile);
    } catch (cause) {
      if (request !== sequence.current) return;
      setError(cause instanceof Error ? cause.message : 'Не удалось загрузить настройки связи.');
    } finally {
      if (request === sequence.current) setLoading(false);
    }
  }, [patientId, tenantId]);

  useEffect(() => {
    const tenantValue = tenantId;
    const patientValue = patientId;
    const repositoryValue = repository;
    queueMicrotask(() => {
      if (!tenantValue || !patientValue || !repositoryValue) {
        sequence.current += 1;
        setProfile(null);
        setLoading(false);
        setError(null);
        return;
      }
      void load(repositoryValue, tenantValue, patientValue, true);
    });
  }, [load, patientId, repository, tenantId]);

  const refresh = useCallback(async () => {
    if (!tenantId || !patientId || !repository) return;
    await load(repository, tenantId, patientId, false);
  }, [load, patientId, repository, tenantId]);

  const mutate = useCallback(async <T,>(
    key: string,
    setter: (value: boolean) => void,
    action: (repositoryValue: PatientCommunicationRepository, keyValue: string) => Promise<T>,
  ): Promise<T> => {
    if (!tenantId || !patientId || !repository || !canMutate) {
      const failure = new PatientCommunicationRepositoryError('permission', 'Недостаточно прав для изменения настроек связи.');
      setError(failure.message);
      throw failure;
    }
    if (busy.current.has(key)) {
      const failure = new PatientCommunicationRepositoryError('operation_failed', 'Не удалось сохранить настройки связи.');
      setError(failure.message);
      throw failure;
    }
    busy.current.add(key);
    setter(true);
    setError(null);
    try {
      const result = await action(repository, operationKey(key, patientId));
      await refresh();
      return result;
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Не удалось сохранить настройки связи.');
      throw cause;
    } finally {
      busy.current.delete(key);
      setter(false);
    }
  }, [canMutate, patientId, refresh, repository, tenantId]);

  const saveContact = useCallback((input: Omit<UpsertPatientCommunicationContactInput, 'patientId' | 'operationKey'>) => mutate(
    `contact:${input.contactId ?? 'new'}`,
    setSavingContact,
    (repositoryValue, keyValue) => repositoryValue.upsertContact({
      ...input,
      patientId: patientId ?? '',
      operationKey: keyValue,
    }),
  ), [mutate, patientId]);

  const archiveContact = useCallback((contactId: string, expectedUpdatedAt: string) => mutate(
    `archive:${contactId}`,
    setSavingContact,
    (repositoryValue, keyValue) => repositoryValue.archiveContact(patientId ?? '', contactId, expectedUpdatedAt, keyValue),
  ), [mutate, patientId]);

  const setPrimaryContact = useCallback((contactId: string, expectedUpdatedAt: string) => mutate(
    `primary:${contactId}`,
    setSavingContact,
    (repositoryValue, keyValue) => repositoryValue.setPrimaryContact(patientId ?? '', contactId, expectedUpdatedAt, keyValue),
  ), [mutate, patientId]);

  const savePreferences = useCallback((
    preferredLanguage: PatientCommunicationLanguage,
    preferredChannel: PatientPreferredCommunicationChannel,
    allowManualPhone: boolean,
  ) => mutate(
    'preferences',
    setUpdatingPreferences,
    (repositoryValue, keyValue) => repositoryValue.updatePreferences(
      patientId ?? '', preferredLanguage, preferredChannel, allowManualPhone, keyValue,
    ),
  ), [mutate, patientId]);

  const recordConsent = useCallback((
    channel: PatientAutomatedCommunicationChannel,
    state: PatientCommunicationConsentState,
    source: PatientCommunicationConsentSource,
    reason?: string,
  ) => mutate(
    `consent:${channel}`,
    setUpdatingConsent,
    (repositoryValue, keyValue) => repositoryValue.setConsent(
      patientId ?? '', channel, state, source, reason, keyValue,
    ),
  ), [mutate, patientId]);

  const changeSuppression = useCallback((
    channel: 'global' | 'phone' | PatientAutomatedCommunicationChannel,
    suppressed: boolean,
    reason?: PatientCommunicationSuppressionReason,
  ) => mutate(
    `suppression:${channel}`,
    setUpdatingSuppression,
    (repositoryValue, keyValue) => repositoryValue.setSuppression(
      patientId ?? '', channel, suppressed, reason, keyValue,
    ),
  ), [mutate, patientId]);

  return {
    profile,
    contacts: profile?.contacts ?? [],
    preferences: profile?.preferences ?? null,
    eligibility: profile?.eligibility ?? null,
    consentEvents: profile?.consentEvents ?? [],
    loading,
    savingContact,
    updatingConsent,
    updatingPreferences,
    updatingSuppression,
    error,
    canMutate,
    refresh,
    saveContact,
    archiveContact,
    setPrimaryContact,
    savePreferences,
    recordConsent,
    changeSuppression,
    clearError: () => setError(null),
  };
}
