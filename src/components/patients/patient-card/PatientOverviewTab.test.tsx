// @vitest-environment jsdom
(globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

import { act } from 'react';
import { createRoot } from 'react-dom/client';
import { describe, expect, it, vi } from 'vitest';
import type { Patient } from '../../../types';
import { PatientOverviewTab } from './PatientOverviewTab';

const patient: Patient = {
  id: 'patient-1',
  fullName: 'Authoritative Patient',
  phone: '+7 700 000 00 00',
  birthDate: '1990-01-01',
  source: 'phone',
  status: 'active',
  createdAt: '2026-01-01T00:00:00.000Z',
};

const dentalSummary = {
  needsTreatment: 0,
  missing: 0,
  activePlans: 0,
  totalAmount: 0,
  chiefComplaintText: '',
  highUrgentFindings: 0,
  notIncludedFindings: 0,
  monitoringFindings: 0,
};

describe('PatientOverviewTab appointment summary', () => {
  it('renders previous and next appointment values as appointment facts, not visits', () => {
    const container = document.createElement('div');
    const root = createRoot(container);

    act(() => root.render(
      <PatientOverviewTab
        patient={patient}
        dentalSummary={dentalSummary}
        lastVisit={new Date('2026-07-10T10:00:00.000Z')}
        nextVisit={new Date('2026-07-15T10:00:00.000Z')}
        onNavigateToSchedule={vi.fn()}
      />,
    ));

    expect(container.textContent).toContain('Записи');
    expect(container.textContent).toContain('Предыдущая');
    expect(container.textContent).toContain('Следующая');
    expect(container.textContent).toContain('10.07.2026');
    expect(container.textContent).toContain('15.07.2026');
    expect(container.textContent).not.toContain('Визиты');

    act(() => root.unmount());
  });
});
