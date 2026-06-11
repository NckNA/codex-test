import { describe, it, expect, vi } from 'vitest';
import { createRoot } from 'react-dom/client';
import { act } from 'react';
import { ToothGrid } from './ToothGrid';
import type { ToothRecord } from '../../types';

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

  const UPPER_JAW = [18, 17, 16, 15, 14, 13, 12, 11, 21, 22, 23, 24, 25, 26, 27, 28];
  const LOWER_JAW = [48, 47, 46, 45, 44, 43, 42, 41, 31, 32, 33, 34, 35, 36, 37, 38];
  const allToothNumbers = [...UPPER_JAW, ...LOWER_JAW];
  
  const fullMockTeeth = allToothNumbers.map(num => {
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

  it('renders tooth buttons correctly', async () => {
    const handleToothClick = vi.fn();
    const container = document.createElement('div');
    const root = createRoot(container);

    await act(async () => {
      root.render(<ToothGrid teeth={fullMockTeeth} onToothClick={handleToothClick} />);
    });

    const button18 = Array.from(container.querySelectorAll('button')).find(btn => btn.getAttribute('aria-label') === 'Редактировать зуб 18');
    expect(button18).not.toBeNull();
    expect(button18?.textContent).toContain('18');

    await act(async () => {
      root.unmount();
    });
  });

  it('calls onToothClick when a tooth is clicked', async () => {
    const handleToothClick = vi.fn();
    const container = document.createElement('div');
    const root = createRoot(container);

    await act(async () => {
      root.render(<ToothGrid teeth={fullMockTeeth} onToothClick={handleToothClick} />);
    });

    const button17 = Array.from(container.querySelectorAll('button')).find(btn => btn.getAttribute('aria-label') === 'Редактировать зуб 17');
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

    const button18 = Array.from(container.querySelectorAll('button')).find(btn => btn.getAttribute('aria-label') === 'Редактировать зуб 18');
    expect(button18?.className).toContain('bg-blue-50/50');
    expect(button18?.className).toContain('ring-1');
    expect(button18?.className).toContain('ring-blue-300');

    const button17 = Array.from(container.querySelectorAll('button')).find(btn => btn.getAttribute('aria-label') === 'Редактировать зуб 17');
    expect(button17?.className).not.toContain('bg-blue-50/50');
    expect(button17?.className).not.toContain('ring-1');

    await act(async () => {
      root.unmount();
    });
  });
});
