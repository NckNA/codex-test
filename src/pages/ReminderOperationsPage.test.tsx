/* eslint-disable @typescript-eslint/no-explicit-any */
// @vitest-environment jsdom
(globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
import { act } from 'react';
import { createRoot } from 'react-dom/client';
import { MemoryRouter } from 'react-router-dom';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { useTenant } from '../contexts/TenantContext';
import { useAppointmentReminderQueue } from '../data/hooks/useAppointmentReminderQueue';
import type { AppointmentReminderQueueItem } from '../types';
import { ReminderOperationsPage } from './ReminderOperationsPage';

vi.mock('../contexts/TenantContext', () => ({ useTenant: vi.fn() }));
vi.mock('../data/hooks/useAppointmentReminderQueue', () => ({ useAppointmentReminderQueue: vi.fn() }));

const makeItem = (
  id: string,
  dueAt: string,
  options: Partial<{
    patientName: string;
    phone: string;
    doctorId: string;
    doctorName: string;
    reminderType: AppointmentReminderQueueItem['job']['reminderType'];
    confirmationState: NonNullable<AppointmentReminderQueueItem['appointment']['confirmationState']>;
    terminal: boolean;
  }> = {},
): AppointmentReminderQueueItem => ({
  job: {
    id,
    tenantId: 'tenant-a',
    appointmentId: `appointment-${id}`,
    patientId: `patient-${id}`,
    reminderType: options.reminderType ?? 'confirmation_request',
    executionMode: 'manual',
    dueAt,
    originalDueAt: dueAt,
    state: options.terminal ? 'completed' : 'scheduled',
    operationalState: options.terminal ? 'completed' : (Date.parse(dueAt) <= Date.parse('2026-07-13T05:00:00+00:00') ? 'ready' : 'scheduled'),
    appointmentUpdatedAt: '2026-07-12T08:00:00.123456+00:00',
    policyVersion: 2,
    planKey: id.padEnd(64, 'a').slice(0, 64),
    payloadFingerprint: id.padEnd(64, 'b').slice(0, 64),
    priority: 50,
    createdAt: '2026-07-12T08:00:00+00:00',
    updatedAt: '2026-07-12T08:00:00.123456+00:00',
    completedAt: options.terminal ? '2026-07-13T05:30:00+00:00' : undefined,
    completedBy: options.terminal ? 'staff-a' : undefined,
    completionOutcome: options.terminal ? 'no_answer' : undefined,
    completionNote: options.terminal ? 'Не ответил' : undefined,
    confirmationAttemptId: options.terminal ? 'attempt-a' : undefined,
    terminalReason: options.terminal ? 'manual_completed' : undefined,
    metadata: {},
  },
  appointment: {
    id: `appointment-${id}`,
    patientId: `patient-${id}`,
    doctorId: options.doctorId ?? 'doctor-a',
    cabinet: 'A1',
    service: 'Осмотр',
    status: 'new',
    start: '2026-07-20T10:00:00+00:00',
    end: '2026-07-20T11:00:00+00:00',
    confirmationState: options.confirmationState ?? 'unconfirmed',
    confirmationAttemptCount: 1,
    createdAt: '2026-07-01T09:00:00+00:00',
    updatedAt: '2026-07-12T08:00:00.123456+00:00',
  },
  patient: {
    id: `patient-${id}`,
    fullName: options.patientName ?? `Пациент ${id}`,
    phone: options.phone ?? `+7700${id}`,
  },
  doctor: {
    id: options.doctorId ?? 'doctor-a',
    fullName: options.doctorName ?? 'Врач А',
    specialization: 'Терапевт',
    cabinet: 'A1',
  },
  attemptCount: 1,
  lastAttempt: {
    id: `attempt-${id}`,
    tenantId: 'tenant-a',
    appointmentId: `appointment-${id}`,
    patientId: `patient-${id}`,
    actorUserId: 'staff-a',
    channel: 'phone',
    outcome: 'no_answer',
    attemptedAt: '2026-07-12T07:00:00+00:00',
    createdAt: '2026-07-12T07:00:00+00:00',
  },
});

const overdue = makeItem('overdue', '2026-07-13T04:00:00+00:00', { patientName: 'Алина Просроченная' });
const today = makeItem('today', '2026-07-13T06:00:00+00:00', {
  patientName: 'Борис Сегодня',
  doctorId: 'doctor-b',
  doctorName: 'Врач Б',
  reminderType: 'day_before_reminder',
  confirmationState: 'contact_in_progress',
});
const upcoming = makeItem('upcoming', '2026-07-14T05:00:00+00:00', {
  patientName: 'Вера Будущая',
  reminderType: 'control_call_task',
});
const historyItem = makeItem('history', '2026-07-12T05:00:00+00:00', { patientName: 'Галина История', terminal: true });

function baseHook(overrides: Record<string, unknown> = {}) {
  return {
    jobs: [overdue, today, upcoming],
    history: [historyItem],
    loading: false,
    error: null,
    completingJobId: null,
    deferringJobId: null,
    skippingJobId: null,
    reconcilingOperation: false,
    canAccess: true,
    refresh: vi.fn().mockResolvedValue(undefined),
    completeJob: vi.fn().mockResolvedValue({}),
    deferJob: vi.fn().mockResolvedValue({}),
    skipJob: vi.fn().mockResolvedValue({}),
    clearError: vi.fn(),
    ...overrides,
  } as unknown as ReturnType<typeof useAppointmentReminderQueue>;
}

function renderPage() {
  const container = document.createElement('div');
  document.body.appendChild(container);
  const root = createRoot(container);
  act(() => root.render(<MemoryRouter><ReminderOperationsPage /></MemoryRouter>));
  return { container, root };
}

function buttonByText(container: HTMLElement, text: string): HTMLButtonElement {
  const button = [...container.querySelectorAll('button')].find((element) => element.textContent?.includes(text));
  if (!button) throw new Error(`Button not found: ${text}`);
  return button as HTMLButtonElement;
}

function setInput(element: HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement, value: string) {
  act(() => {
    const descriptor = Object.getOwnPropertyDescriptor(
      element instanceof HTMLSelectElement ? HTMLSelectElement.prototype
        : element instanceof HTMLTextAreaElement ? HTMLTextAreaElement.prototype
          : HTMLInputElement.prototype,
      'value',
    );
    descriptor?.set?.call(element, value);
    element.dispatchEvent(new Event(element instanceof HTMLSelectElement ? 'change' : 'input', { bubbles: true }));
  });
}

describe('ReminderOperationsPage', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-07-13T05:00:00+00:00'));
    vi.mocked(useTenant).mockReturnValue({
      activeTenant: { tenantId: 'tenant-a', tenantName: 'Clinic A', timezone: 'Asia/Almaty', role: 'registrar' },
    } as any);
    vi.mocked(useAppointmentReminderQueue).mockReturnValue(baseHook());
  });

  afterEach(() => {
    vi.useRealTimers();
    document.body.innerHTML = '';
  });

  it('shows overdue, today and upcoming work with required patient context', () => {
    const { container, root } = renderPage();
    expect(container.textContent).toContain('Просрочено');
    expect(container.textContent).toContain('Сегодня');
    expect(container.textContent).toContain('Предстоящее');
    expect(container.textContent).toContain('Алина Просроченная');
    expect(container.textContent).toContain('Борис Сегодня');
    expect(container.textContent).toContain('Вера Будущая');
    expect(container.textContent).toContain('Попыток: 1');
    expect([...container.querySelectorAll('button')].map((item) => item.textContent)).not.toContain('Отправить SMS');
    expect([...container.querySelectorAll('button')].map((item) => item.textContent)).not.toContain('Отправить WhatsApp');
    act(() => root.unmount());
  });

  it('filters by patient search, bucket, reminder type, doctor and confirmation state', () => {
    const { container, root } = renderPage();
    const filterSection = container.querySelector('[aria-label="Фильтры очереди"]')!;
    const input = filterSection.querySelector('input')!;
    const selects = filterSection.querySelectorAll('select');

    setInput(input, 'Борис');
    expect(container.querySelectorAll('[data-testid^="reminder-job-"]')).toHaveLength(1);
    expect(container.textContent).toContain('Борис Сегодня');

    setInput(input, '');
    setInput(selects[0], 'upcoming');
    expect(container.querySelectorAll('[data-testid^="reminder-job-"]')).toHaveLength(1);
    expect(container.textContent).toContain('Вера Будущая');

    setInput(selects[0], 'all');
    setInput(selects[1], 'day_before_reminder');
    expect(container.querySelectorAll('[data-testid^="reminder-job-"]')).toHaveLength(1);
    expect(container.textContent).toContain('Борис Сегодня');

    setInput(selects[1], 'all');
    setInput(selects[2], 'doctor-b');
    expect(container.querySelectorAll('[data-testid^="reminder-job-"]')).toHaveLength(1);

    setInput(selects[2], 'all');
    setInput(selects[3], 'contact_in_progress');
    expect(container.querySelectorAll('[data-testid^="reminder-job-"]')).toHaveLength(1);
    act(() => root.unmount());
  });

  it('validates completion, shows message_sent warning and records through the hook', async () => {
    const completeJob = vi.fn().mockResolvedValue({});
    vi.mocked(useAppointmentReminderQueue).mockReturnValue(baseHook({ completeJob }));
    const { container, root } = renderPage();
    act(() => buttonByText(container, 'Зафиксировать результат').click());
    const dialog = container.querySelector('[role="dialog"]')!;
    expect(dialog.textContent).toContain('Канал ручного контакта');

    await act(async () => { buttonByText(dialog as HTMLElement, 'Сохранить результат').click(); });
    expect(dialog.textContent).toContain('Выберите результат связи.');

    const selects = dialog.querySelectorAll('select');
    setInput(selects[1], 'message_sent');
    expect(dialog.textContent).toContain('не подтверждает запись');
    await act(async () => { buttonByText(dialog as HTMLElement, 'Сохранить результат').click(); });
    expect(completeJob).toHaveBeenCalledWith(expect.objectContaining({
      item: overdue,
      channel: 'phone',
      outcome: 'message_sent',
    }));
    expect(container.textContent).toContain('Задача завершена.');
    act(() => root.unmount());
  });

  it('validates tenant-local defer time and requires an explicit reason', async () => {
    const deferJob = vi.fn().mockResolvedValue({});
    vi.mocked(useAppointmentReminderQueue).mockReturnValue(baseHook({ deferJob }));
    const { container, root } = renderPage();
    act(() => buttonByText(container, 'Отложить').click());
    const dialog = container.querySelector('[role="dialog"]')!;
    expect(dialog.textContent).toContain('Значение «через час» автоматически не подставляется.');

    await act(async () => { buttonByText(dialog as HTMLElement, 'Отложить').click(); });
    expect(dialog.textContent).toContain('Укажите причину.');
    const datetime = dialog.querySelector('input[type="datetime-local"]') as HTMLInputElement;
    const textarea = dialog.querySelector('textarea')!;
    setInput(textarea, 'Согласовано с пациентом');
    setInput(datetime, '2026-07-14T12:00');
    await act(async () => { buttonByText(dialog as HTMLElement, 'Отложить').click(); });
    expect(deferJob).toHaveBeenCalledWith(expect.objectContaining({
      item: overdue,
      reason: 'Согласовано с пациентом',
      newDueAt: expect.stringMatching(/Z|[+-]\d{2}:\d{2}$/),
    }));
    expect(container.textContent).toContain('Задача отложена.');
    act(() => root.unmount());
  });

  it('requires a skip reason, preserves the history warning and calls skip', async () => {
    const skipJob = vi.fn().mockResolvedValue({});
    vi.mocked(useAppointmentReminderQueue).mockReturnValue(baseHook({ skipJob }));
    const { container, root } = renderPage();
    act(() => buttonByText(container, 'Пропустить').click());
    const dialog = container.querySelector('[role="dialog"]')!;
    expect(dialog.textContent).toContain('останется в истории');
    await act(async () => { buttonByText(dialog as HTMLElement, 'Пропустить').click(); });
    expect(dialog.textContent).toContain('Укажите причину.');
    setInput(dialog.querySelector('textarea')!, 'Не требуется');
    await act(async () => { buttonByText(dialog as HTMLElement, 'Пропустить').click(); });
    expect(skipJob).toHaveBeenCalledWith({ item: overdue, reason: 'Не требуется' });
    expect(container.textContent).toContain('Задача пропущена.');
    act(() => root.unmount());
  });

  it('keeps the completion dialog open and displays a safe backend error', async () => {
    const completeJob = vi.fn().mockRejectedValue(new Error('Задача устарела из-за изменения записи. Обновите очередь.'));
    vi.mocked(useAppointmentReminderQueue).mockReturnValue(baseHook({ completeJob }));
    const { container, root } = renderPage();
    act(() => buttonByText(container, 'Зафиксировать результат').click());
    const dialog = container.querySelector('[role="dialog"]')!;
    setInput(dialog.querySelectorAll('select')[1], 'no_answer');
    await act(async () => { buttonByText(dialog as HTMLElement, 'Сохранить результат').click(); });
    expect(container.querySelector('[role="dialog"]')).not.toBeNull();
    expect(dialog.textContent).toContain('Задача устарела из-за изменения записи. Обновите очередь.');
    act(() => root.unmount());
  });

  it('blocks unauthorized roles without rendering queue actions', () => {
    vi.mocked(useAppointmentReminderQueue).mockReturnValue(baseHook({ canAccess: false, jobs: [], history: [] }));
    const { container, root } = renderPage();
    expect(container.textContent).toContain('Очередь напоминаний недоступна');
    expect(container.textContent).toContain('Недостаточно прав');
    expect(container.textContent).not.toContain('Зафиксировать результат');
    act(() => root.unmount());
  });

  it('shows terminal administrative history with actor, result, reason and attempt', () => {
    const { container, root } = renderPage();
    act(() => buttonByText(container, 'История').click());
    expect(container.querySelector('[aria-label="История напоминаний"]')).not.toBeNull();
    expect(container.textContent).toContain('Галина История');
    expect(container.textContent).toContain('Завершена');
    expect(container.textContent).toContain('Результат: Не ответил');
    expect(container.textContent).toContain('Сотрудник: staff-a');
    expect(container.textContent).toContain('Попытка связи: attempt-a');
    act(() => root.unmount());
  });
});
