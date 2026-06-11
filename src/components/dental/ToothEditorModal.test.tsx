/** @vitest-environment jsdom */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { createRoot, type Root } from 'react-dom/client';
import { act } from 'react';
import { ToothEditorModal } from './ToothEditorModal';
import type { ToothRecord } from '../../types';

describe('ToothEditorModal', () => {
  let container: HTMLDivElement;
  let root: Root;

  beforeEach(() => {
    container = document.createElement('div');
    document.body.appendChild(container);
    root = createRoot(container);
  });

  afterEach(() => {
    act(() => {
      root.unmount();
    });
    container.remove();
    vi.clearAllMocks();
  });

  const mockTooth: ToothRecord = {
    toothNumber: 11,
    presenceStatus: 'natural', visualState: 'healthy', diagnoses: [], plannedWorks: [], completedWorks: [], condition: 'healthy',
    updatedAt: new Date().toISOString()
  };

  it('renders structured clinical section headers based on active tab', async () => {
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

    let html = container.innerHTML;
    // By default, crown tab is active
    expect(html).toContain('Основное состояние');
    expect(html).toContain('Коронка / Реставрация');
    expect(html).toContain('Клинические заметки');
    expect(html).toContain('Создать или обновить проблему по этому зубу');
    
    // Switch to Root tab
    await act(async () => {
      const rootTab = Array.from(container.querySelectorAll('button')).find(b => b.textContent === 'Каналы');
      rootTab?.dispatchEvent(new MouseEvent('click', { bubbles: true }));
    });
    html = container.innerHTML;
    expect(html).toContain('Корни / Каналы');

    // Switch to Gum tab
    await act(async () => {
      const gumTab = Array.from(container.querySelectorAll('button')).find(b => b.textContent === 'Десна');
      gumTab?.dispatchEvent(new MouseEvent('click', { bubbles: true }));
    });
    html = container.innerHTML;
    expect(html).toContain('Десна / Мягкие ткани');

    // Switch to Bone tab
    await act(async () => {
      const boneTab = Array.from(container.querySelectorAll('button')).find(b => b.textContent === 'Кость');
      boneTab?.dispatchEvent(new MouseEvent('click', { bubbles: true }));
    });
    html = container.innerHTML;
    expect(html).toContain('Костная ткань');
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

    const select = container.querySelector('select[name="condition"]') as HTMLSelectElement;
    expect(select).not.toBeNull();
    expect(select.value).toBe('healthy');
    expect(container.innerHTML).not.toContain('Поверхности');

    await act(async () => {
      select.value = 'caries';
      select.dispatchEvent(new Event('change', { bubbles: true }));
    });

    expect(container.innerHTML).toContain('Поверхности');
    expect(container.innerHTML).toContain('Жевательная');
    expect(container.innerHTML).toContain('Мезиальная');
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

    const saveButton = container.querySelector('button[type="submit"]');
    const resetText = container.innerHTML;
    
    expect(saveButton).not.toBeNull();
    expect(saveButton!.textContent).toBe('Сохранить');
    expect(resetText).toContain('Сбросить (Здоров)');
  });
});
