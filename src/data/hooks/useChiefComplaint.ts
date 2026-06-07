import { useState, useEffect, useCallback } from 'react';
import type { ChiefComplaint } from '../../types';
import { LocalStorageChiefComplaintRepository } from '../repositories/ChiefComplaintRepository';

export function useChiefComplaint(patientId: string) {
  const [complaint, setComplaint] = useState<ChiefComplaint | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(!!patientId);
  const [isError, setIsError] = useState<boolean>(false);
  const [error, setError] = useState<Error | null>(null);
  const [isSaving, setIsSaving] = useState<boolean>(false);

  const fetchComplaint = useCallback(async () => {
    setIsLoading(true);
    setIsError(false);
    setError(null);
    try {
      const data = await LocalStorageChiefComplaintRepository.getChiefComplaint(patientId);
      setComplaint(data);
    } catch (err) {
      setIsError(true);
      setError(err instanceof Error ? err : new Error(String(err)));
    } finally {
      setIsLoading(false);
    }
  }, [patientId]);

  useEffect(() => {
    let mounted = true;

    if (!patientId) {
      return;
    }

    const initFetch = async () => {
      setIsLoading(true);
      setIsError(false);
      setError(null);
      try {
        const data = await LocalStorageChiefComplaintRepository.getChiefComplaint(patientId);
        if (mounted) {
          setComplaint(data);
          setIsLoading(false);
        }
      } catch (err) {
        if (mounted) {
          setIsError(true);
          setError(err instanceof Error ? err : new Error(String(err)));
          setIsLoading(false);
        }
      }
    };

    initFetch();

    return () => {
      mounted = false;
    };
  }, [patientId]);

  const saveComplaint = async (
    input: Omit<ChiefComplaint, 'id' | 'patientId' | 'createdAt' | 'updatedAt'>
  ) => {
    setIsSaving(true);
    setIsError(false);
    setError(null);
    try {
      await LocalStorageChiefComplaintRepository.saveChiefComplaint(patientId, input);
      // Refetch immediately to get the updated entity (with generated id/createdAt/updatedAt)
      await fetchComplaint();
    } catch (err) {
      setIsError(true);
      setError(err instanceof Error ? err : new Error(String(err)));
      throw err;
    } finally {
      setIsSaving(false);
    }
  };

  return {
    complaint,
    isLoading,
    isError,
    error,
    isSaving,
    refetch: fetchComplaint,
    saveComplaint,
  };
}
