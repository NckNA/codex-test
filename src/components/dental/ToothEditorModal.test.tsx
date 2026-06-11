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
    condition: 'healthy',
    updatedAt: new Date().toISOString(),
  };

  function renderModal(onSave = vi.fn()) {
    act(() => {
      root.render(
        <ToothEditorModal
          isOpen={true}
          tooth={mockTooth}
          patientId="p1"
          existingFindings={[]}
          onClose={() => {}}
          onSave={onSave}
        />
      );
    });

    return onSave;
  }

  function getSelectByValue(value: string): HTMLSelectElement {
    const select = Array.from(container.querySelectorAll('select')).find((item) => item.value === value) as HTMLSelectElement | undefined;
    expect(select).toBeTruthy();
    return select!;
  }

  function clickByText(text: string) {
    const element = Array.from(container.querySelectorAll('button, label')).find((item) => item.textContent?.includes(text));
    expect(element).toBeTruthy();

    act(() => {
      element!.dispatchEvent(new MouseEvent('click', { bubbles: true }));
    });
  }

  function clickByAriaLabel(label: string) {
    const element = container.querySelector(`[aria-label="${label}"]`);
    expect(element).toBeTruthy();

    act(() => {
      element!.dispatchEvent(new MouseEvent('click', { bubbles: true }));
    });
  }

  it('renders the prototype editor shell with anatomical status, visual state, notes, and dictionary zones', () => {
    renderModal();

    const html = container.innerHTML;
    expect(html).toContain('Анатомический статус');
    expect(html).toContain('Отображение на формуле');
    expect(html).toContain('Выбранное');
    expect(html).toContain('Пока ничего не выбрано');
    expect(html).toContain('Общие заметки');
    expect(html).toContain('Создать клиническую проблему');
    expect(html).toContain('Коронка');
    expect(html).toContain('Каналы');
    expect(html).toContain('Десна');
    expect(html).toContain('Диагнозы / состояния');
  });

  it('changes available tabs when anatomical status changes', () => {
    renderModal();

    const presenceSelect = getSelectByValue('natural');

    act(() => {
      presenceSelect.value = 'missing';
      presenceSelect.dispatchEvent(new Event('change', { bubbles: true }));
    });

    const html = container.innerHTML;
    expect(html).toContain('Планирование');
    expect(html).toContain('Кость');
    expect(html).toContain('Отсутствие зуба');
    expect(html).not.toContain('Каналы');
  });

  it('shows treatment works after selecting a diagnosis', () => {
    renderModal();

    expect(container.innerHTML).toContain('Выберите диагноз выше');
    clickByText('Кариес эмали');

    const html = container.innerHTML;
    expect(html).toContain('Пломба 1 поверхность');
  });

  it('shows selected diagnosis and work chips with quick zone clearing', () => {
    renderModal();

    clickByText('Кариес эмали');
    clickByText('Пломба 1 поверхность');

    let html = container.innerHTML;
    expect(html).toContain('Планируемые работы');
    expect(html).toContain('Очистить зону');
    expect(html).toContain('Диагнозы: 1/');
    expect(html).toContain('Работы: 1/');

    clickByText('Очистить зону');

    html = container.innerHTML;
    expect(html).toContain('Пока ничего не выбрано');
    expect(html).toContain('Диагнозы: 0/');
    expect(html).toContain('Работы: 0/');
  });

  it('removes selected diagnosis from the summary chip', () => {
    renderModal();

    clickByText('Кариес эмали');
    expect(container.innerHTML).toContain('Убрать: Кариес эмали');

    clickByAriaLabel('Убрать: Кариес эмали');

    expect(container.innerHTML).toContain('Пока ничего не выбрано');
  });

  it('saves compatibility fields without creating a finding by default', () => {
    const onSave = renderModal();

    clickByText('Кариес эмали');
    clickByText('Пломба 1 поверхность');
    clickByText('Сохранить изменения');

    expect(onSave).toHaveBeenCalledTimes(1);
    const [savedTooth, findingPayload] = onSave.mock.calls[0] as [ToothRecord, unknown];

    expect(savedTooth.presenceStatus).toBe('natural');
    expect(savedTooth.diagnoses).toContain('dx_caries_enamel');
    expect(savedTooth.plannedWorks).toContain('work_filling_1_surface');
    expect(savedTooth.plannedWorkRecords?.[0]).toMatchObject({
      workId: 'work_filling_1_surface',
      zone: 'crown',
      status: 'planned',
    });
    expect(savedTooth.visualState).toBe('caries');
    expect(savedTooth.condition).toBe('caries');
    expect(findingPayload).toBeNull();
  });

  it('creates a finding payload when requested', () => {
    const onSave = renderModal();

    clickByText('Создать клиническую проблему');
    clickByText('Кариес эмали');
    clickByText('Сохранить изменения');

    expect(onSave).toHaveBeenCalledTimes(1);
    const [, findingPayload] = onSave.mock.calls[0] as [ToothRecord, { title?: string; description?: string }];

    expect(findingPayload.title).toContain('зуб 11');
    expect(findingPayload.description).toContain('Кариес эмали');
  });

  it('supports manual visual state override and reset', () => {
    renderModal();

    clickByText('Изменить вручную');
    const visualSelect = getSelectByValue('healthy');

    act(() => {
      visualSelect.value = 'filled';
      visualSelect.dispatchEvent(new Event('change', { bubbles: true }));
    });

    expect(container.innerHTML).toContain('Вернуть автоматический расчёт');
    clickByText('Сбросить');

    const html = container.innerHTML;
    expect(html).toContain('Расчётное состояние');
    expect(html).not.toContain('Вернуть автоматический расчёт');
  });
});
