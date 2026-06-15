// @vitest-environment jsdom
import { describe, it, expect, afterEach, vi } from 'vitest';
import { createRoot, type Root } from 'react-dom/client';
import { act } from 'react';
import { CreatePlanFromFindingsModal } from './CreatePlanFromFindingsModal';
import type { DentalFinding, TreatmentPlan } from '../../types';

function makeFinding(overrides: Partial<DentalFinding>): DentalFinding {
  return {
    id: 'finding-1',
    patientId: 'patient-1',
    toothNumber: 11,
    title: 'Finding title',
    category: 'caries',
    severity: 'high',
    description: '',
    isChiefComplaintRelated: false,
    includeInTreatmentPlan: true,
    status: 'discovered',
    createdAt: '',
    updatedAt: '',
    ...overrides,
  };
}

const activePlan: TreatmentPlan = {
  id: 'plan-1',
  patientId: 'patient-1',
  title: 'Active plan',
  status: 'draft',
  stages: [
    {
      id: 'stage-1',
      title: 'Stage',
      teeth: [],
      description: '',
      price: 0,
      status: 'planned',
      findingIds: ['linked-active', 'linked-archived'],
    },
  ],
  totalPrice: 0,
  createdAt: '',
  updatedAt: '',
};

async function renderModal(findings: DentalFinding[], treatmentPlans: TreatmentPlan[] = []) {
  const container = document.createElement('div');
  document.body.appendChild(container);
  const root = createRoot(container);
  const onCreatePlanFromFindings = vi.fn().mockResolvedValue(undefined);

  await act(async () => {
    root.render(
      <CreatePlanFromFindingsModal
        isOpen
        findings={findings}
        treatmentPlans={treatmentPlans}
        onClose={vi.fn()}
        onCreatePlanFromFindings={onCreatePlanFromFindings}
      />,
    );
  });

  return { container, root, onCreatePlanFromFindings };
}

async function cleanup(root: Root, container: HTMLElement) {
  await act(async () => {
    root.unmount();
  });
  container.remove();
}

describe('CreatePlanFromFindingsModal finding eligibility', () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('shows discovered and monitoring findings while excluding completed, declined and archived findings', async () => {
    const { container, root } = await renderModal([
      makeFinding({ id: 'discovered', title: 'Discovered eligible', status: 'discovered' }),
      makeFinding({ id: 'monitoring', title: 'Monitoring eligible', status: 'monitoring' }),
      makeFinding({ id: 'completed', title: 'Completed hidden', status: 'completed' }),
      makeFinding({ id: 'declined', title: 'Declined hidden', status: 'declined_by_patient' }),
      makeFinding({ id: 'archived', title: 'Archived hidden', status: 'archived' }),
    ]);

    expect(container.textContent).toContain('Discovered eligible');
    expect(container.textContent).toContain('Monitoring eligible');
    expect(container.textContent).not.toContain('Completed hidden');
    expect(container.textContent).not.toContain('Declined hidden');
    expect(container.textContent).not.toContain('Archived hidden');

    await cleanup(root, container);
  });

  it('keeps active linked finding visible as disabled but hides archived linked finding', async () => {
    const { container, root } = await renderModal([
      makeFinding({ id: 'linked-active', title: 'Linked active finding', status: 'discovered' }),
      makeFinding({ id: 'linked-archived', title: 'Linked archived finding', status: 'archived' }),
    ], [activePlan]);

    expect(container.textContent).toContain('Linked active finding');
    expect(container.textContent).toContain('Уже в плане: Active plan');
    expect(container.textContent).not.toContain('Linked archived finding');

    const linkedCheckbox = container.querySelector('input[type="checkbox"]');
    expect(linkedCheckbox).toBeInstanceOf(HTMLInputElement);
    expect((linkedCheckbox as HTMLInputElement).disabled).toBe(true);

    await cleanup(root, container);
  });

  it('mentions archived findings in the empty-state explanation', async () => {
    const { container, root } = await renderModal([
      makeFinding({ id: 'archived-only', title: 'Archived only', status: 'archived' }),
    ]);

    expect(container.textContent).toContain('Нет проблем для включения в план лечения');
    expect(container.textContent).toContain('Проблемы уже завершены, архивированы или пациент отказался от лечения.');

    await cleanup(root, container);
  });
});
