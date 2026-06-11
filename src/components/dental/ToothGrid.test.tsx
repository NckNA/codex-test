import { describe, it, expect, vi } from 'vitest';
import { createRoot } from 'react-dom/client';
import { act } from 'react';
import { ToothGrid } from './ToothGrid';
import type { ToothRecord, DentalFinding, ToothNumber } from '../../types';

// @vitest-environment jsdom
(globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

describe('ToothGrid', () => {
  const mockTeeth: ToothRecord[] = [
    {
      toothNumber: 18,
      condition: 'healthy',
      surfaces: [],
      crown: '',
      root: '',
      gum: '',
      bone: '',
      canal: '',
      notes: '',
      updatedAt: '2023-01-01T00:00:00.000Z'
    },
    {
      toothNumber: 17,
      condition: 'caries',
      surfaces: ['occlusal'],
      crown: '',
      root: '',
      gum: '',
      bone: '',
      canal: '',
      notes: '',
      updatedAt: '2023-01-01T00:00:00.000Z'
    }
  ];

  const ADULT_UPPER_JAW: ToothNumber[] = [18, 17, 16, 15, 14, 13, 12, 11, 21, 22, 23, 24, 25, 26, 27, 28];
  const ADULT_LOWER_JAW: ToothNumber[] = [48, 47, 46, 45, 44, 43, 42, 41, 31, 32, 33, 34, 35, 36, 37, 38];
  const allAdultToothNumbers = [...ADULT_UPPER_JAW, ...ADULT_LOWER_JAW];

  const fullMockTeeth = allAdultToothNumbers.map(num => {
    const existing = mockTeeth.find(t => t.toothNumber === num);
    return existing || {
      toothNumber: num,
      condition: 'healthy',
      surfaces: [],
      crown: '',
      root: '',
      gum: '',
      bone: '',
      canal: '',
      notes: '',
      updatedAt: '2023-01-01T00:00:00.000Z'
    };
  }) as ToothRecord[];

  const findToothButton = (container: HTMLElement, toothNumber: number) => (
    Array.from(container.querySelectorAll('button')).find(btn => btn.getAttribute('aria-label')?.startsWith(`Редактировать зуб ${toothNumber}`))
  );

  it('renders tooth buttons correctly', async () => {
    const handleToothClick = vi.fn();
    const container = document.createElement('div');
    const root = createRoot(container);

    await act(async () => {
      root.render(<ToothGrid teeth={fullMockTeeth} onToothClick={handleToothClick} />);
    });

    const button18 = findToothButton(container, 18);
    expect(button18).not.toBeNull();
    expect(button18?.getAttribute('aria-label')).toBe('Редактировать зуб 18: Здоров');
    expect(button18?.textContent).toContain('18');

    await act(async () => {
      root.unmount();
    });
  });

  it('renders jaw labels, condition legend and zone legend', async () => {
    const handleToothClick = vi.fn();
    const container = document.createElement('div');
    const root = createRoot(container);

    await act(async () => {
      root.render(<ToothGrid teeth={fullMockTeeth} onToothClick={handleToothClick} />);
    });

    expect(container.textContent).toContain('Верхняя челюсть');
    expect(container.textContent).toContain('Нижняя челюсть');
    expect(container.textContent).toContain('Постоянная формула');
    expect(container.textContent).toContain('FDI 18–28');
    expect(container.textContent).toContain('Легенда зубной карты');
    expect(container.textContent).toContain('Кариес');
    expect(container.textContent).toContain('Активная находка');
    expect(container.textContent).toContain('Зона активна');
    expect(container.textContent).toContain('Зона в плане');
    expect(container.textContent).toContain('Зона риска');

    await act(async () => {
      root.unmount();
    });
  });

  it('renders child dentition numbers when child mode is active', async () => {
    const handleToothClick = vi.fn();
    const container = document.createElement('div');
    const root = createRoot(container);

    await act(async () => {
      root.render(<ToothGrid teeth={fullMockTeeth} dentitionMode="child" onToothClick={handleToothClick} />);
    });

    expect(container.textContent).toContain('Молочная формула');
    expect(container.textContent).toContain('FDI 55–65');
    expect(container.textContent).toContain('FDI 85–75');
    expect(findToothButton(container, 55)).not.toBeNull();
    expect(findToothButton(container, 85)).not.toBeNull();
    expect(findToothButton(container, 18)).toBeUndefined();

    await act(async () => {
      root.unmount();
    });
  });

  it('calls dentition mode change callback from the toggle', async () => {
    const handleToothClick = vi.fn();
    const handleDentitionModeChange = vi.fn();
    const container = document.createElement('div');
    const root = createRoot(container);

    await act(async () => {
      root.render(
        <ToothGrid
          teeth={fullMockTeeth}
          onToothClick={handleToothClick}
          dentitionMode="adult"
          onDentitionModeChange={handleDentitionModeChange}
        />
      );
    });

    const childToggle = Array.from(container.querySelectorAll('button')).find(btn => btn.textContent === 'Молочные');
    expect(childToggle).not.toBeNull();

    await act(async () => {
      childToggle?.dispatchEvent(new MouseEvent('click', { bubbles: true }));
    });

    expect(handleDentitionModeChange).toHaveBeenCalledWith('child');

    await act(async () => {
      root.unmount();
    });
  });

  it('creates a deciduous display tooth for child teeth that are not stored yet', async () => {
    const handleToothClick = vi.fn();
    const container = document.createElement('div');
    const root = createRoot(container);

    await act(async () => {
      root.render(<ToothGrid teeth={fullMockTeeth} dentitionMode="child" onToothClick={handleToothClick} />);
    });

    const button55 = findToothButton(container, 55);
    expect(button55).not.toBeNull();

    await act(async () => {
      button55?.dispatchEvent(new MouseEvent('click', { bubbles: true }));
    });

    expect(handleToothClick).toHaveBeenCalledWith(expect.objectContaining({
      toothNumber: 55,
      condition: 'healthy',
      presenceStatus: 'deciduous'
    }));

    await act(async () => {
      root.unmount();
    });
  });

  it('renders a planned crown zone marker from planned work records', async () => {
    const handleToothClick = vi.fn();
    const container = document.createElement('div');
    const root = createRoot(container);
    const teethWithPlannedWork = fullMockTeeth.map(tooth => tooth.toothNumber === 18
      ? {
          ...tooth,
          plannedWorkRecords: [
            {
              id: 'pwr-18-crown',
              workId: 'work-filling',
              zone: 'crown' as const,
              status: 'planned' as const,
              createdAt: '2023-01-01T00:00:00.000Z',
              updatedAt: '2023-01-01T00:00:00.000Z'
            }
          ]
        }
      : tooth);

    await act(async () => {
      root.render(<ToothGrid teeth={teethWithPlannedWork} onToothClick={handleToothClick} />);
    });

    expect(container.querySelector('[data-testid="zone-marker-18-crown-planned"]')).not.toBeNull();
    expect(container.textContent).toContain('Зоны: Коронка (в плане)');

    await act(async () => {
      root.unmount();
    });
  });

  it('renders a risk zone marker from a high severity finding and overrides planned marker', async () => {
    const handleToothClick = vi.fn();
    const container = document.createElement('div');
    const root = createRoot(container);
    const teethWithPlannedBoneWork = fullMockTeeth.map(tooth => tooth.toothNumber === 17
      ? {
          ...tooth,
          plannedWorkRecords: [
            {
              id: 'pwr-17-bone',
              workId: 'work-bone',
              zone: 'bone' as const,
              status: 'planned' as const,
              createdAt: '2023-01-01T00:00:00.000Z',
              updatedAt: '2023-01-01T00:00:00.000Z'
            }
          ]
        }
      : tooth);
    const findings: DentalFinding[] = [
      {
        id: 'finding-17-bone',
        patientId: 'p1',
        toothNumber: 17,
        title: 'Риск по кости',
        category: 'risk_zone',
        severity: 'high',
        description: 'Есть риск по костной ткани',
        isChiefComplaintRelated: false,
        includeInTreatmentPlan: false,
        status: 'discovered',
        clinicalZone: 'bone',
        createdAt: '2023-01-01T00:00:00.000Z',
        updatedAt: '2023-01-01T00:00:00.000Z'
      }
    ];

    await act(async () => {
      root.render(<ToothGrid teeth={teethWithPlannedBoneWork} findings={findings} onToothClick={handleToothClick} />);
    });

    expect(container.querySelector('[data-testid="zone-marker-17-bone-risk"]')).not.toBeNull();
    expect(container.querySelector('[data-testid="zone-marker-17-bone-planned"]')).toBeNull();
    expect(container.textContent).toContain('Зоны: Кость (риск)');

    await act(async () => {
      root.unmount();
    });
  });

  it('renders active zone markers from legacy tooth fields', async () => {
    const handleToothClick = vi.fn();
    const container = document.createElement('div');
    const root = createRoot(container);
    const teethWithLegacyZone = fullMockTeeth.map(tooth => tooth.toothNumber === 18
      ? {
          ...tooth,
          gum: 'Гингивит'
        }
      : tooth);

    await act(async () => {
      root.render(<ToothGrid teeth={teethWithLegacyZone} onToothClick={handleToothClick} />);
    });

    expect(container.querySelector('[data-testid="zone-marker-18-periodontium-active"]')).not.toBeNull();
    expect(container.textContent).toContain('Зоны: Десна (активно)');

    await act(async () => {
      root.unmount();
    });
  });

  it('calls onToothClick when an adult tooth is clicked', async () => {
    const handleToothClick = vi.fn();
    const container = document.createElement('div');
    const root = createRoot(container);

    await act(async () => {
      root.render(<ToothGrid teeth={fullMockTeeth} onToothClick={handleToothClick} />);
    });

    const button17 = findToothButton(container, 17);
    expect(button17).not.toBeNull();

    await act(async () => {
      button17?.dispatchEvent(new MouseEvent('click', { bubbles: true }));
    });

    expect(handleToothClick).toHaveBeenCalledTimes(1);
    expect(handleToothClick).toHaveBeenCalledWith(expect.objectContaining({
      toothNumber: 17,
      condition: 'caries'
    }));

    await act(async () => {
      root.unmount();
    });
  });

  it('applies selected-state classes when a tooth is selected', async () => {
    const handleToothClick = vi.fn();
    const container = document.createElement('div');
    const root = createRoot(container);

    await act(async () => {
      root.render(
        <ToothGrid
          teeth={fullMockTeeth}
          onToothClick={handleToothClick}
          selectedToothNumber={18}
        />
      );
    });

    const button18 = findToothButton(container, 18);
    expect(button18?.className).toContain('bg-blue-50');
    expect(button18?.className).toContain('ring-2');
    expect(button18?.className).toContain('ring-blue-400');

    const button17 = findToothButton(container, 17);
    expect(button17?.className).not.toContain('ring-blue-400');
    expect(button17?.className).toContain('hover:bg-slate-50');

    await act(async () => {
      root.unmount();
    });
  });
});
