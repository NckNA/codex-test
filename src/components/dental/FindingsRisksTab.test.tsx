// @vitest-environment jsdom
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { createRoot } from 'react-dom/client';
import { act } from 'react';
import { FindingsRisksTab } from './FindingsRisksTab';
import type { DentalFinding } from '../../types';

vi.mock('../../data/hooks/usePatientFindings', () => ({
  usePatientFindings: vi.fn(),
}));

vi.mock('../../data/hooks/useChiefComplaint', () => ({
  useChiefComplaint: vi.fn(() => ({ data: 'Mock complaint' })),
}));

vi.mock('./FindingModal', () => ({
  FindingModal: () => <div data-testid="mock-finding-modal" />,
}));

import { usePatientFindings } from '../../data/hooks/usePatientFindings';

describe('FindingsRisksTab', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('filters out archived findings from active/chiefComplaintRelated problems', async () => {
    const findings: DentalFinding[] = [
      {
        id: '1',
        patientId: 'p1',
        toothNumber: 11,
        title: 'Active Complaint Problem',
        category: 'caries',
        severity: 'high',
        status: 'discovered',
        isChiefComplaintRelated: true,
        includeInTreatmentPlan: false,
        description: '',
        createdAt: '',
        updatedAt: ''
      },
      {
        id: '2',
        patientId: 'p1',
        toothNumber: 12,
        title: 'Archived Complaint Problem',
        category: 'caries',
        severity: 'high',
        status: 'archived',
        isChiefComplaintRelated: true,
        includeInTreatmentPlan: false,
        description: '',
        createdAt: '',
        updatedAt: ''
      }
    ];

    vi.mocked(usePatientFindings).mockReturnValue({
      findings,
      isLoading: false,
      isError: false,
      error: null,
      isSaving: false,
      saveError: null,
      createFinding: vi.fn() as unknown as ReturnType<typeof vi.fn>,
      updateFinding: vi.fn() as unknown as ReturnType<typeof vi.fn>,
      deleteFinding: vi.fn() as unknown as ReturnType<typeof vi.fn>,
      refetch: vi.fn() as unknown as ReturnType<typeof vi.fn>,
    });

    const container = document.createElement('div');
    const root = createRoot(container);

    await act(async () => {
      root.render(<FindingsRisksTab patientId="p1" />);
    });

    expect(container.textContent).toContain('Active Complaint Problem');
    
    // Check inactive section for Archived Complaint Problem
    const activeSection = Array.from(container.querySelectorAll('h4')).find(h => h.textContent === 'Проблемы, связанные с жалобой:')?.parentElement;
    const inactiveSection = Array.from(container.querySelectorAll('h3')).find(h => h.textContent === 'Архив / Отказ / Завершено')?.parentElement;

    expect(activeSection?.textContent).toContain('Active Complaint Problem');
    expect(activeSection?.textContent).not.toContain('Archived Complaint Problem');
    expect(inactiveSection?.textContent).toContain('Archived Complaint Problem');
    
    await act(async () => {
      root.unmount();
    });
  });

  it('hides normal workflow action buttons on archived findings', async () => {
    const findings: DentalFinding[] = [
      {
        id: '1',
        patientId: 'p1',
        toothNumber: 11,
        title: 'Archived Problem',
        category: 'caries',
        severity: 'high',
        status: 'archived',
        isChiefComplaintRelated: false,
        includeInTreatmentPlan: false,
        description: '',
        createdAt: '',
        updatedAt: ''
      }
    ];

    vi.mocked(usePatientFindings).mockReturnValue({
      findings,
      isLoading: false,
      isError: false,
      error: null,
      isSaving: false,
      saveError: null,
      createFinding: vi.fn() as unknown as ReturnType<typeof vi.fn>,
      updateFinding: vi.fn() as unknown as ReturnType<typeof vi.fn>,
      deleteFinding: vi.fn() as unknown as ReturnType<typeof vi.fn>,
      refetch: vi.fn() as unknown as ReturnType<typeof vi.fn>,
    });

    const container = document.createElement('div');
    const root = createRoot(container);

    await act(async () => {
      root.render(<FindingsRisksTab patientId="p1" />);
    });

    const inactiveSection = Array.from(container.querySelectorAll('h3')).find(h => h.textContent === 'Архив / Отказ / Завершено')?.parentElement;
    
    expect(inactiveSection?.textContent).toContain('Archived Problem');
    
    // It should not contain the normal workflow buttons
    expect(inactiveSection?.textContent).not.toContain('В наблюдение');
    expect(inactiveSection?.textContent).not.toContain('Отказ пациента');
    expect(inactiveSection?.textContent).not.toContain('Завершить');

    await act(async () => {
      root.unmount();
    });
  });
});
