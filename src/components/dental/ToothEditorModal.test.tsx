/** @vitest-environment jsdom */
import React from 'react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { createRoot } from 'react-dom/client';
import { act } from 'react';
import { ToothEditorModal } from './ToothEditorModal';
import { ToothRecord } from '../../types';

describe('ToothEditorModal', () => {
  let container: HTMLDivElement | null = null;
  let root: ReturnType<typeof createRoot> | null = null;

  beforeEach(() => {
    container = document.createElement('div');
    document.body.appendChild(container);
    root = createRoot(container);
  });

  afterEach(() => {
    act(() => {
      root.unmount();
    });
    container?.remove();
    container = null;
    vi.clearAllMocks();
  });

  const mockTooth: ToothRecord = {
    toothNumber: 11,
    condition: 'healthy',
    updatedAt: new Date().toISOString()
  };

  it('renders structured clinical section headers', async () => {
    await act(async () => {
      root.render(
        <ToothEditorModal
          isOpen={true}
          tooth={mockTooth}
          patientId="p1"
          existingFindings={[]}
          onClose={() => {}}
          onSave={() => {}}
        />
      );
    });

    const html = container!.innerHTML;
    expect(html).toContain('Основное состояние');
    expect(html).toContain('Коронка / Реставрация');
    expect(html).toContain('Десна / Мягкие ткани');
    expect(html).toContain('Корни / Каналы');
    expect(html).toContain('Костная ткань');
    expect(html).toContain('Клинические заметки');
    expect(html).toContain('Создать или обновить проблему по этому зубу');
  });

  it('condition select works and shows surfaces when condition requires treatment', async () => {
    await act(async () => {
      root.render(
        <ToothEditorModal
          isOpen={true}
          tooth={mockTooth}
          patientId="p1"
          existingFindings={[]}
          onClose={() => {}}
          onSave={() => {}}
        />
      );
    });

    const select = container!.querySelector('select[name="condition"]') as HTMLSelectElement;
    expect(select).not.toBeNull();
    expect(select.value).toBe('healthy');
    expect(container!.innerHTML).not.toContain('Поверхности');

    await act(async () => {
      select.value = 'caries';
      select.dispatchEvent(new Event('change', { bubbles: true }));
    });

    expect(container!.innerHTML).toContain('Поверхности');
    expect(container!.innerHTML).toContain('Жевательная');
    expect(container!.innerHTML).toContain('Мезиальная');
  });

  it('save and reset buttons remain available', async () => {
    await act(async () => {
      root.render(
        <ToothEditorModal
          isOpen={true}
          tooth={mockTooth}
          patientId="p1"
          existingFindings={[]}
          onClose={() => {}}
          onSave={() => {}}
        />
      );
    });

    const saveButton = container!.querySelector('button[type="submit"]');
    const resetText = container!.innerHTML;
    
    expect(saveButton).not.toBeNull();
    expect(saveButton!.textContent).toBe('Сохранить');
    expect(resetText).toContain('Сбросить (Здоров)');
  });
});
