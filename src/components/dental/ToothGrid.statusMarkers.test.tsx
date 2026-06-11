import { describe, it, expect, vi } from 'vitest';
import { createRoot } from 'react-dom/client';
import { act } from 'react';
import { ToothGrid } from './ToothGrid';
import type { DentalFinding, ToothRecord } from '../../types';

// @vitest-environment jsdom
(globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

describe('ToothGrid status markers', () => {
  const baseTooth: ToothRecord = {
    toothNumber: 18,
    condition: 'healthy',
    surfaces: [],
    crown: '',
    root: '',
    gum: '',
    bone: '',
    canal: '',
    notes: '',
    updatedAt: '2023-01-01T00:00:00.000Z',
  };

  const renderGrid = async (teeth: ToothRecord[], findings: DentalFinding[] = []) => {
    const container = document.createElement('div');
    const root = createRoot(container);

    await act(async () => {
      root.render(<ToothGrid teeth={teeth} findings={findings} onToothClick={vi.fn()} />);
    });

    return { container, root };
  };

  it('renders diagnosis and work status markers from tooth selections', async () => {
    const { container, root } = await renderGrid([
      {
        ...baseTooth,
        diagnoses: ['dx_caries_enamel'],
        plannedWorkRecords: [
          {
            id: 'pwr-18-crown',
            workId: 'work_filling_1_surface',
            zone: 'crown',
            status: 'planned',
            createdAt: '2023-01-01T00:00:00.000Z',
            updatedAt: '2023-01-01T00:00:00.000Z',
          },
        ],
      },
    ]);

    expect(container.querySelector('[data-testid="status-marker-18-diagnosis"]')).not.toBeNull();
    expect(container.querySelector('[data-testid="status-marker-18-work"]')).not.toBeNull();
    expect(container.textContent).toContain('Статусы: Есть диагноз, Есть работа');
    expect(container.textContent).toContain('Есть диагноз');
    expect(container.textContent).toContain('Есть работа');

    await act(async () => {
      root.unmount();
    });
  });

  it('renders urgent and in-plan status markers from findings', async () => {
    const findings: DentalFinding[] = [
      {
        id: 'finding-18-urgent',
        patientId: 'p1',
        toothNumber: 18,
        title: 'Срочная проблема',
        category: 'risk_zone',
        severity: 'urgent',
        description: 'Требует внимания',
        isChiefComplaintRelated: false,
        includeInTreatmentPlan: false,
        status: 'discovered',
        clinicalZone: 'bone',
        createdAt: '2023-01-01T00:00:00.000Z',
        updatedAt: '2023-01-01T00:00:00.000Z',
      },
      {
        id: 'finding-18-plan',
        patientId: 'p1',
        toothNumber: 18,
        title: 'В плане',
        category: 'caries',
        severity: 'medium',
        description: 'Добавлено в план',
        isChiefComplaintRelated: false,
        includeInTreatmentPlan: true,
        status: 'included_in_plan',
        clinicalZone: 'crown',
        createdAt: '2023-01-01T00:00:00.000Z',
        updatedAt: '2023-01-01T00:00:00.000Z',
      },
    ];

    const { container, root } = await renderGrid([baseTooth], findings);

    expect(container.querySelector('[data-testid="status-marker-18-urgent"]')).not.toBeNull();
    expect(container.querySelector('[data-testid="status-marker-18-inPlan"]')).not.toBeNull();
    expect(container.textContent).toContain('Статусы: Срочно, В плане');
    expect(container.textContent).toContain('Зоны: Коронка (в плане), Кость (риск)');

    await act(async () => {
      root.unmount();
    });
  });

  it('renders observing status marker from observing finding', async () => {
    const findings: DentalFinding[] = [
      {
        id: 'finding-18-observe',
        patientId: 'p1',
        toothNumber: 18,
        title: 'Наблюдение',
        category: 'other',
        severity: 'low',
        description: 'На контроле',
        isChiefComplaintRelated: false,
        includeInTreatmentPlan: false,
        status: 'observing',
        clinicalZone: 'periodontium',
        createdAt: '2023-01-01T00:00:00.000Z',
        updatedAt: '2023-01-01T00:00:00.000Z',
      },
    ];

    const { container, root } = await renderGrid([baseTooth], findings);

    expect(container.querySelector('[data-testid="status-marker-18-observing"]')).not.toBeNull();
    expect(container.textContent).toContain('Статусы: Наблюдение');

    await act(async () => {
      root.unmount();
    });
  });
});
