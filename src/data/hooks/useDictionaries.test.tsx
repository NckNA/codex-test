// @vitest-environment jsdom
(globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { createRoot } from 'react-dom/client';
import { act } from 'react';
import type { ClinicalDiagnosis, ClinicalWork } from '../../config/clinicalDictionaries';
import { ClinicalDictionariesProvider, useDictionaries } from './useDictionaries';
import * as ClinicalDictionariesRepositoryModule from '../repositories/ClinicalDictionariesRepository';
import { useAuth } from '../../contexts/AuthContext';
import { useTenant } from '../../contexts/TenantContext';

const { mockSupabaseConfigured } = vi.hoisted(() => ({ mockSupabaseConfigured: { value: true } }));

vi.mock('../../lib/supabaseClient', () => ({
  supabase: {},
  get isSupabaseConfigured() {
    return mockSupabaseConfigured.value;
  }
}));

vi.mock('../../contexts/AuthContext', () => ({
  useAuth: vi.fn(),
}));

vi.mock('../../contexts/TenantContext', () => ({
  useTenant: vi.fn(),
}));

vi.mock('../repositories/ClinicalDictionariesRepository', () => {
  return {
    createClinicalDictionariesRepository: vi.fn(),
    ClinicalDictionariesRepository: {
      getDiagnoses: vi.fn().mockReturnValue([]),
      getWorks: vi.fn().mockReturnValue([]),
    }
  };
});

import type { IClinicalDictionariesRepository } from '../repositories/ClinicalDictionariesRepository';
import type { Mock } from 'vitest';

describe('useDictionaries', () => {
  let mockRepo: {
    getDiagnoses: Mock;
    getWorks: Mock;
    saveDiagnosis: Mock;
    saveWork: Mock;
  };

  beforeEach(() => {
    vi.restoreAllMocks();
    mockSupabaseConfigured.value = true;
    mockRepo = {
      getDiagnoses: vi.fn().mockResolvedValue([]),
      getWorks: vi.fn().mockResolvedValue([]),
      saveDiagnosis: vi.fn().mockResolvedValue(undefined),
      saveWork: vi.fn().mockResolvedValue(undefined),
    };
    vi.mocked(ClinicalDictionariesRepositoryModule.createClinicalDictionariesRepository).mockReturnValue(mockRepo as unknown as IClinicalDictionariesRepository);
  });

  const setup = async () => {
    let currentContext: ReturnType<typeof useDictionaries> | undefined;
    
    const TestComponent = () => {
      currentContext = useDictionaries();
      return null;
    };

    const container = document.createElement('div');
    const root = createRoot(container);

    await act(async () => {
      root.render(
        <ClinicalDictionariesProvider>
          <TestComponent />
        </ClinicalDictionariesProvider>
      );
    });

    return {
      get current() { return currentContext!; },
      unmount: async () => {
        await act(async () => {
          root.unmount();
        });
      }
    };
  };

  describe('A. Local/dev mode & backend routing', () => {
    it('uses local backend when authMode is dev', async () => {
      vi.mocked(useAuth).mockReturnValue({ authMode: 'dev' } as unknown as ReturnType<typeof useAuth>);
      vi.mocked(useTenant).mockReturnValue({ activeTenant: { tenantId: 'real-tenant-id', tenantName: 'Clinic' } } as unknown as ReturnType<typeof useTenant>);

      const { unmount } = await setup();
      
      expect(ClinicalDictionariesRepositoryModule.createClinicalDictionariesRepository).toHaveBeenCalledWith({ backend: 'local', tenantId: 'real-tenant-id' });
      await unmount();
    });

    it('uses supabase backend when authMode is supabase-active, configured, and tenant exists', async () => {
      vi.mocked(useAuth).mockReturnValue({ authMode: 'supabase-active' } as unknown as ReturnType<typeof useAuth>);
      vi.mocked(useTenant).mockReturnValue({ activeTenant: { tenantId: 'real-tenant-id', tenantName: 'Clinic' } } as unknown as ReturnType<typeof useTenant>);

      const { unmount } = await setup();
      
      expect(ClinicalDictionariesRepositoryModule.createClinicalDictionariesRepository).toHaveBeenCalledWith({ backend: 'supabase', tenantId: 'real-tenant-id' });
      await unmount();
    });

    it('uses local backend when authMode is supabase-active, activeTenant exists, but isSupabaseConfigured is false', async () => {
      mockSupabaseConfigured.value = false;
      vi.mocked(useAuth).mockReturnValue({ authMode: 'supabase-active' } as unknown as ReturnType<typeof useAuth>);
      vi.mocked(useTenant).mockReturnValue({ activeTenant: { tenantId: 'real-tenant-id', tenantName: 'Clinic' } } as unknown as ReturnType<typeof useTenant>);

      const { unmount } = await setup();
      
      expect(ClinicalDictionariesRepositoryModule.createClinicalDictionariesRepository).toHaveBeenCalledWith({ backend: 'local', tenantId: 'real-tenant-id' });
      await unmount();
    });

    it('creates local backend but short-circuits data loading when authMode is supabase-active but no tenant exists', async () => {
      vi.mocked(useAuth).mockReturnValue({ authMode: 'supabase-active' } as unknown as ReturnType<typeof useAuth>);
      vi.mocked(useTenant).mockReturnValue({ activeTenant: null } as unknown as ReturnType<typeof useTenant>);

      const result = await setup();
      
      expect(ClinicalDictionariesRepositoryModule.createClinicalDictionariesRepository).toHaveBeenCalledWith({ backend: 'local', tenantId: undefined });
      
      // Should not call getDiagnoses/getWorks
      expect(mockRepo.getDiagnoses).not.toHaveBeenCalled();
      expect(mockRepo.getWorks).not.toHaveBeenCalled();
      expect(result.current.diagnoses).toEqual([]);
      expect(result.current.works).toEqual([]);
      expect(result.current.loading).toBe(false);

      // Should fail safely on write
      await expect(result.current.saveDiagnosis({ id: 'd1' } as any)).rejects.toThrow("Active clinic is required for Supabase data access.");
      expect(mockRepo.saveDiagnosis).not.toHaveBeenCalled();

      await result.unmount();
    });
  });

  describe('B. Async loading and behavior', () => {
    beforeEach(() => {
      vi.mocked(useAuth).mockReturnValue({ authMode: 'supabase-active' } as unknown as ReturnType<typeof useAuth>);
      vi.mocked(useTenant).mockReturnValue({ activeTenant: { tenantId: 't1', tenantName: 'C1' } } as unknown as ReturnType<typeof useTenant>);
    });

    it('loads data initially and transitions loading state', async () => {
      mockRepo.getDiagnoses.mockResolvedValue([{ id: 'd1', name: 'Dx 1' }]);
      mockRepo.getWorks.mockResolvedValue([{ id: 'w1', name: 'Wk 1' }]);

      const result = await setup();
      
      expect(result.current.loading).toBe(false);
      expect(result.current.error).toBeNull();
      expect(result.current.diagnoses).toHaveLength(1);
      expect(result.current.diagnoses[0].name).toBe('Dx 1');
      expect(result.current.works).toHaveLength(1);
      
      await result.unmount();
    });

    it('keeps empty arrays if repository returns empty (no auto-seeding)', async () => {
      mockRepo.getDiagnoses.mockResolvedValue([]);
      mockRepo.getWorks.mockResolvedValue([]);

      const result = await setup();
      
      expect(result.current.diagnoses).toEqual([]);
      expect(result.current.works).toEqual([]);
      
      await result.unmount();
    });

    it('handles refresh function properly', async () => {
      mockRepo.getDiagnoses.mockResolvedValue([]);
      mockRepo.getWorks.mockResolvedValue([]);
      const result = await setup();

      mockRepo.getDiagnoses.mockResolvedValue([{ id: 'd2' }]);
      
      await act(async () => {
        await result.current.refresh();
      });

      expect(result.current.diagnoses).toHaveLength(1);
      await result.unmount();
    });
  });

  describe('C. Save behavior and optimistic updates', () => {
    beforeEach(() => {
      vi.mocked(useAuth).mockReturnValue({ authMode: 'dev' } as unknown as ReturnType<typeof useAuth>);
      vi.mocked(useTenant).mockReturnValue({ activeTenant: null } as unknown as ReturnType<typeof useTenant>);
    });

    it('saves diagnosis and updates local state optimistically', async () => {
      const result = await setup();
      
      expect(result.current.diagnoses).toHaveLength(0);

      await act(async () => {
        await result.current.saveDiagnosis({ id: 'd1', name: 'New Dx' } as unknown as ClinicalDiagnosis);
      });

      expect(mockRepo.saveDiagnosis).toHaveBeenCalledWith({ id: 'd1', name: 'New Dx' });
      expect(result.current.diagnoses).toHaveLength(1);
      expect(result.current.diagnoses[0].name).toBe('New Dx');

      // Update existing
      await act(async () => {
        await result.current.saveDiagnosis({ id: 'd1', name: 'Updated Dx' } as unknown as ClinicalDiagnosis);
      });

      expect(result.current.diagnoses).toHaveLength(1);
      expect(result.current.diagnoses[0].name).toBe('Updated Dx');

      await result.unmount();
    });

    it('saves work and updates local state optimistically', async () => {
      const result = await setup();
      
      await act(async () => {
        await result.current.saveWork({ id: 'w1', name: 'New Work' } as unknown as ClinicalWork);
      });

      expect(mockRepo.saveWork).toHaveBeenCalledWith({ id: 'w1', name: 'New Work' });
      expect(result.current.works).toHaveLength(1);
      expect(result.current.works[0].name).toBe('New Work');

      await result.unmount();
    });
  });

  describe('D. Error handling', () => {
    beforeEach(() => {
      vi.mocked(useAuth).mockReturnValue({ authMode: 'supabase-active' } as unknown as ReturnType<typeof useAuth>);
      vi.mocked(useTenant).mockReturnValue({ activeTenant: { tenantId: 't1', tenantName: 'C1' } } as unknown as ReturnType<typeof useTenant>);
    });

    it('surfaces repository load errors and settles loading', async () => {
      mockRepo.getDiagnoses.mockRejectedValue(new Error('Network load error'));
      
      const result = await setup();
      
      expect(result.current.loading).toBe(false);
      expect(result.current.error).toBe('Network load error');
      
      await result.unmount();
    });

    it('surfaces save errors and re-throws, keeping state unchanged', async () => {
      mockRepo.saveDiagnosis.mockRejectedValue(new Error('Save failed'));
      
      const result = await setup();
      
      let caughtErr = null;
      await act(async () => {
        try {
          await result.current.saveDiagnosis({ id: 'd1' } as unknown as ClinicalDiagnosis);
        } catch (e) {
          caughtErr = e;
        }
      });

      expect(caughtErr).toBeDefined();
      expect(result.current.error).toBe('Save failed');
      expect(result.current.diagnoses).toHaveLength(0); // optimistic update skipped
      
      await result.unmount();
    });
  });
});
