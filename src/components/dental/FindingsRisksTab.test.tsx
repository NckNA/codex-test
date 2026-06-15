// @vitest-environment jsdom
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { createRoot, type Root } from 'react-dom/client';
import { act } from 'react';
import { FindingsRisksTab } from './FindingsRisksTab';
import type { DentalFinding } from '../../types';

vi.mock('../../data/hooks/usePatientFindings', () => ({
  usePatientFindings: vi.fn(),
}));

vi.mock('../../data/hooks/useChiefComplaint', () => ({
  useChiefComplaint: vi.fn(() => ({
    complaint: null,
    isLoading: false,
    isSaving: false,
    saveComplaint: vi.fn(),
  })),
}));

vi.mock('./FindingModal', () => ({
  FindingModal: ({ isOpen, finding }: { isOpen: boolean; finding?: DentalFinding | null }) => (
    isOpen ? <div data-testid="mock-finding-modal">{finding ? `Редактирование: ${finding.title}` : 'Новая проблема'}</div> : null
  ),
}));

import { usePatientFindings } from '../../data/hooks/usePatientFindings';

function makeFinding(overrides: Partial<DentalFinding>): DentalFinding {
  return {
    id: 'finding-1',
    patientId: 'p1',
    toothNumber: 11,
    title: 'Finding title',
    category: 'caries',
    severity: 'high',
    status: 'discovered',
    isChiefComplaintRelated: false,
    includeInTreatmentPlan: true,
    description: '',
    createdAt: '',
    updatedAt: '',
    ...overrides,
  };
}

function mockFindings(findings: DentalFinding[], overrides: Partial<ReturnType<typeof usePatientFindings>> = {}) {
  const value = {
    findings,
    isLoading: false,
    isError: false,
    error: null,
    isSaving: false,
    saveError: null,
    createFinding: vi.fn(),
    updateFinding: vi.fn(),
    deleteFinding: vi.fn(),
    refetch: vi.fn(),
    ...overrides,
  };

  vi.mocked(usePatientFindings).mockReturnValue(value as ReturnType<typeof usePatientFindings>);
  return value;
}

async function renderTab(findings: DentalFinding[], overrides?: Partial<ReturnType<typeof usePatientFindings>>) {
  const hookValue = mockFindings(findings, overrides);
  const container = document.createElement('div');
  document.body.appendChild(container);
  const root = createRoot(container);

  await act(async () => {
    root.render(<FindingsRisksTab patientId="p1" />);
  });

  return { container, root, hookValue };
}

async function cleanup(root: Root, container: HTMLElement) {
  await act(async () => {
    root.unmount();
  });
  container.remove();
}

describe('FindingsRisksTab archived findings behavior', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('hides archived findings from active sections by default and shows them only behind archive toggle', async () => {
    const { container, root } = await renderTab([
      makeFinding({ id: 'active-complaint', title: 'Active Complaint Problem', isChiefComplaintRelated: true }),
      makeFinding({ id: 'archived-complaint', title: 'Archived Complaint Problem', status: 'archived', isChiefComplaintRelated: true }),
      makeFinding({ id: 'completed', title: 'Completed Problem', status: 'completed', includeInTreatmentPlan: false }),
      makeFinding({ id: 'declined', title: 'Declined Problem', status: 'declined_by_patient', includeInTreatmentPlan: false }),
    ]);

    const complaintSection = Array.from(container.querySelectorAll('h4'))
      .find(h => h.textContent === 'Проблемы, связанные с жалобой:')?.parentElement;
    const inactiveSection = Array.from(container.querySelectorAll('h3'))
      .find(h => h.textContent === 'Отказ / Завершено')?.parentElement;

    expect(complaintSection?.textContent).toContain('Active Complaint Problem');
    expect(complaintSection?.textContent).not.toContain('Archived Complaint Problem');
    expect(inactiveSection?.textContent).toContain('Completed Problem');
    expect(inactiveSection?.textContent).toContain('Declined Problem');
    expect(inactiveSection?.textContent).not.toContain('Archived Complaint Problem');
    expect(container.textContent).not.toContain('Archived Complaint Problem');

    const toggle = Array.from(container.querySelectorAll('button')).find(button => button.textContent === 'Показать архивные записи');
    expect(toggle).toBeTruthy();

    await act(async () => {
      toggle?.dispatchEvent(new MouseEvent('click', { bubbles: true }));
    });

    const archiveSection = Array.from(container.querySelectorAll('h3'))
      .find(h => h.textContent === 'Архивные записи')
      ?.closest('section');
    expect(archiveSection?.textContent).toContain('Archived Complaint Problem');

    await cleanup(root, container);
  });

  it('uses archive wording and keeps repository archive path wired to deleteFinding', async () => {
    const confirmSpy = vi.spyOn(window, 'confirm').mockReturnValue(true);
    const deleteFinding = vi.fn().mockResolvedValue(undefined);
    const { container, root } = await renderTab([
      makeFinding({ id: 'active-1', title: 'Active finding' }),
    ], { deleteFinding });

    const archiveButton = container.querySelector('button[aria-label="Архивировать запись Active finding"]');
    expect(archiveButton).toBeTruthy();

    await act(async () => {
      archiveButton?.dispatchEvent(new MouseEvent('click', { bubbles: true }));
    });

    expect(confirmSpy).toHaveBeenCalledWith('Архивировать эту запись? Она исчезнет из активных списков, но останется в истории.');
    expect(deleteFinding).toHaveBeenCalledWith('active-1');

    await cleanup(root, container);
  });

  it('opens editor for active findings and hides active action controls on archived cards', async () => {
    const { container, root } = await renderTab([
      makeFinding({ id: 'editable', title: 'Editable finding' }),
      makeFinding({ id: 'archived', title: 'Archived finding', status: 'archived' }),
    ]);

    const editButton = container.querySelector('button[aria-label="Редактировать запись Editable finding"]');
    await act(async () => {
      editButton?.dispatchEvent(new MouseEvent('click', { bubbles: true }));
    });

    expect(container.textContent).toContain('Редактирование: Editable finding');

    const toggle = Array.from(container.querySelectorAll('button')).find(button => button.textContent === 'Показать архивные записи');
    await act(async () => {
      toggle?.dispatchEvent(new MouseEvent('click', { bubbles: true }));
    });

    const archiveSection = Array.from(container.querySelectorAll('h3'))
      .find(h => h.textContent === 'Архивные записи')
      ?.closest('section');
    expect(archiveSection?.textContent).toContain('Archived finding');
    expect(archiveSection?.textContent).not.toContain('В наблюдение');
    expect(archiveSection?.textContent).not.toContain('Отказ пациента');
    expect(archiveSection?.textContent).not.toContain('Завершить');
    expect(archiveSection?.textContent).not.toContain('В план');

    await cleanup(root, container);
  });
});
