// @vitest-environment jsdom
(globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
import { act } from 'react';
import { createRoot } from 'react-dom/client';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { PatientTimelineTab } from './PatientTimelineTab';
import type { PatientTimelineEvent, PatientTimelineEventCategory } from '../../data/aggregators/PatientTimelineAggregator';

const baseEvent: PatientTimelineEvent = {
  id: 'finding:finding-1:created',
  tenantId: 'tenant-1',
  patientId: 'patient-1',
  occurredAt: '2026-01-03T10:00:00.000Z',
  category: 'finding',
  type: 'finding_discovered',
  title: 'Выявлена находка',
  description: 'Кариес 11',
  sourceType: 'finding',
  sourceId: 'finding-1',
  visibility: 'clinical',
  sourceStatus: 'discovered',
  toothId: '11',
};

function renderTimeline(overrides: Partial<Parameters<typeof PatientTimelineTab>[0]> = {}) {
  const container = document.createElement('div');
  const root = createRoot(container);
  const props: Parameters<typeof PatientTimelineTab>[0] = {
    events: [],
    isLoading: false,
    error: null,
    role: 'clinic_admin',
    includeArchived: false,
    onIncludeArchivedChange: vi.fn(),
    selectedCategory: 'all',
    onSelectedCategoryChange: vi.fn(),
    ...overrides,
  };

  act(() => root.render(<PatientTimelineTab {...props} />));
  return { container, root, props };
}

describe('PatientTimelineTab', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('renders empty state when events are empty', () => {
    const { container, root } = renderTimeline();
    expect(container.textContent).toContain('История пациента пока пуста.');
    act(() => root.unmount());
  });

  it('renders event title, date, category, status, and tooth label', () => {
    const { container, root } = renderTimeline({ events: [baseEvent] });
    expect(container.textContent).toContain('Выявлена находка');
    expect(container.textContent).toContain('Кариес 11');
    expect(container.textContent).toContain('Находка');
    expect(container.textContent).toContain('Обнаружено');
    expect(container.textContent).toContain('Зуб: 11');
    act(() => root.unmount());
  });

  it('sorts newest events first before rendering', () => {
    const older: PatientTimelineEvent = { ...baseEvent, id: 'old', sourceId: 'old', title: 'Старое событие', occurredAt: '2026-01-01T10:00:00.000Z' };
    const newer: PatientTimelineEvent = { ...baseEvent, id: 'new', sourceId: 'new', title: 'Новое событие', occurredAt: '2026-01-05T10:00:00.000Z' };
    const { container, root } = renderTimeline({ events: [older, newer] });
    expect(container.textContent?.indexOf('Новое событие')).toBeLessThan(container.textContent?.indexOf('Старое событие') ?? 9999);
    act(() => root.unmount());
  });

  it('category filter hides unrelated events and keeps matching events', () => {
    const appointment: PatientTimelineEvent = {
      ...baseEvent,
      id: 'appointment:appointment-1:scheduled',
      category: 'appointment',
      sourceType: 'appointment',
      sourceId: 'appointment-1',
      appointmentId: 'appointment-1',
      title: 'Запланирован приём',
      description: 'Консультация',
      visibility: 'admin',
      sourceStatus: 'confirmed',
    };
    const { container, root } = renderTimeline({ events: [baseEvent, appointment], selectedCategory: 'finding' });
    expect(container.textContent).toContain('Выявлена находка');
    expect(container.textContent).not.toContain('Запланирован приём');
    act(() => root.unmount());
  });

  it('calls category filter change handler when filter is clicked', async () => {
    const onSelectedCategoryChange = vi.fn();
    const { container, root } = renderTimeline({ onSelectedCategoryChange });
    const button = Array.from(container.querySelectorAll('button')).find((item) => item.textContent?.includes('Файлы')) as HTMLButtonElement;
    await act(async () => { button.click(); });
    expect(onSelectedCategoryChange).toHaveBeenCalledWith('file');
    act(() => root.unmount());
  });

  it('include archived toggle calls change handler and archived events stay hidden by default', async () => {
    const onIncludeArchivedChange = vi.fn();
    const archived: PatientTimelineEvent = { ...baseEvent, id: 'archived', sourceId: 'archived', title: 'Архивная находка', isArchived: true, sourceStatus: 'archived' };
    const { container, root } = renderTimeline({ events: [archived], onIncludeArchivedChange, includeArchived: false });
    expect(container.textContent).not.toContain('Архивная находка');
    const checkbox = container.querySelector('input[type="checkbox"]') as HTMLInputElement;
    await act(async () => { checkbox.click(); });
    expect(onIncludeArchivedChange).toHaveBeenCalledWith(true);
    act(() => root.unmount());
  });

  it('renders archived marker when includeArchived is enabled', () => {
    const archived: PatientTimelineEvent = { ...baseEvent, id: 'archived', sourceId: 'archived', title: 'Архивная находка', isArchived: true, sourceStatus: 'archived' };
    const { container, root } = renderTimeline({ events: [archived], includeArchived: true });
    expect(container.textContent).toContain('Архивная находка');
    expect(container.textContent).toContain('Архив');
    act(() => root.unmount());
  });

  it('is read-only and does not render mutation actions', () => {
    const { container, root } = renderTimeline({ events: [baseEvent] });
    expect(container.textContent).not.toContain('Редактировать');
    expect(container.textContent).not.toContain('Удалить');
    expect(container.textContent).not.toContain('Архивировать');
    expect(container.textContent).not.toContain('Сохранить');
    act(() => root.unmount());
  });

  it('hides clinical events from cashier role', () => {
    const { container, root } = renderTimeline({ events: [baseEvent], role: 'cashier' });
    expect(container.textContent).not.toContain('Выявлена находка');
    expect(container.textContent).toContain('История пациента пока пуста.');
    act(() => root.unmount());
  });

  it('shows safe message when active tenant role is missing', () => {
    const { container, root } = renderTimeline({ events: [baseEvent], role: null });
    expect(container.textContent).toContain('История пациента недоступна без активной клиники.');
    act(() => root.unmount());
  });

  it('keeps appointments labeled as appointments, not completed treatment', () => {
    const appointment: PatientTimelineEvent = {
      ...baseEvent,
      id: 'appointment:appointment-1:scheduled',
      category: 'appointment',
      sourceType: 'appointment',
      sourceId: 'appointment-1',
      title: 'Запланирован приём',
      description: 'Консультация',
      visibility: 'admin',
      sourceStatus: 'completed',
    };
    const { container, root } = renderTimeline({ events: [appointment] });
    expect(container.textContent).toContain('Приём');
    expect(container.textContent).toContain('Запланирован приём');
    expect(container.textContent).not.toContain('Завершено лечение');
    act(() => root.unmount());
  });

  it('shows patient file events without fetching signed urls or rendering thumbnails', () => {
    const fileEvent: PatientTimelineEvent = {
      ...baseEvent,
      id: 'patient_file:file-1:uploaded',
      category: 'file',
      sourceType: 'patient_file',
      sourceId: 'file-1',
      title: 'Загружен файл пациента',
      description: 'photo.png',
      fileId: 'file-1',
      sourceStatus: 'dental_photo',
    };
    const { container, root } = renderTimeline({ events: [fileEvent] });
    expect(container.textContent).toContain('Загружен файл пациента');
    expect(container.textContent).toContain('photo.png');
    expect(container.querySelector('img')).toBeNull();
    act(() => root.unmount());
  });
});
