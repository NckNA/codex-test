/* eslint-disable @typescript-eslint/no-explicit-any */
// @vitest-environment jsdom
(globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, describe, expect, it, vi } from 'vitest';
import type { Appointment, AppointmentConfirmationAttempt } from '../../types';
import { AppointmentConfirmationPanel } from './AppointmentConfirmationPanel';
import { appointmentNeedsConfirmationAttention } from './appointmentConfirmation';

const appointment: Appointment = {
  id: 'appointment-1', patientId: 'patient-1', doctorId: 'doctor-1', cabinet: 'A1', service: 'Осмотр',
  start: '2026-08-01T10:00:00Z', end: '2026-08-01T11:00:00Z', status: 'new', createdAt: '2026-07-01T09:00:00Z',
  updatedAt: '2026-07-01T09:00:00+00:00', confirmationState: 'unconfirmed', confirmationAttemptCount: 0,
};

const attempt: AppointmentConfirmationAttempt = {
  id: 'attempt-1', tenantId: 'tenant-1', appointmentId: appointment.id, patientId: 'patient-1', actorUserId: 'actor-1',
  channel: 'phone', outcome: 'callback_requested', note: 'После обеда', attemptedAt: '2026-08-01T09:30:00Z', createdAt: '2026-08-01T09:30:00Z',
};

interface RenderOptions {
  value?: Appointment;
  role?: string;
  attempts?: AppointmentConfirmationAttempt[];
  isRecordingAttempt?: boolean;
  isConfirming?: boolean;
  isReconciling?: boolean;
  error?: string | null;
  onRecordAttempt?: any;
  onConfirm?: any;
}

const mounted: Array<{ root: Root; container: HTMLDivElement }> = [];

const renderPanel = async (options: RenderOptions = {}) => {
  const container = document.createElement('div');
  document.body.appendChild(container);
  const root = createRoot(container);
  mounted.push({ root, container });
  const props = {
    appointment: options.value || appointment,
    role: options.role ?? 'clinic_admin',
    attempts: options.attempts || [],
    isRecordingAttempt: options.isRecordingAttempt || false,
    isConfirming: options.isConfirming || false,
    isReconciling: options.isReconciling || false,
    error: options.error || null,
    onRecordAttempt: options.onRecordAttempt || vi.fn().mockResolvedValue({ ...appointment, confirmationState: 'contact_in_progress' }),
    onConfirm: options.onConfirm || vi.fn().mockResolvedValue({ ...appointment, confirmationState: 'confirmed' }),
  };
  await act(async () => root.render(<AppointmentConfirmationPanel
      timezone="Asia/Almaty" {...props} />));
  return { container, root, props };
};

const setValue = async (element: HTMLSelectElement | HTMLTextAreaElement, value: string) => {
  const prototype = element instanceof HTMLSelectElement ? HTMLSelectElement.prototype : HTMLTextAreaElement.prototype;
  await act(async () => {
    Object.getOwnPropertyDescriptor(prototype, 'value')?.set?.call(element, value);
    element.dispatchEvent(new Event(element instanceof HTMLSelectElement ? 'change' : 'input', { bubbles: true }));
  });
};

const click = async (element: Element | null) => {
  if (!(element instanceof HTMLElement)) throw new Error('Missing element');
  await act(async () => element.click());
};

afterEach(async () => {
  while (mounted.length) {
    const item = mounted.pop()!;
    await act(async () => item.root.unmount());
    item.container.remove();
  }
});

describe('AppointmentConfirmationPanel', () => {
  it('shows explicit confirmation state, count, latest attempt and history', async () => {
    const { container } = await renderPanel({
      value: { ...appointment, confirmationState: 'callback_requested', confirmationAttemptCount: 1, lastConfirmationOutcome: 'callback_requested', lastConfirmationAttemptAt: attempt.attemptedAt },
      attempts: [attempt],
    });
    expect(container.textContent).toContain('Просит перезвонить');
    expect(container.querySelector('[data-testid="appointment-confirmation-attempt-count"]')?.textContent).toBe('1');
    expect(container.querySelector('[data-testid="appointment-confirmation-latest-attempt"]')?.textContent).toContain('После обеда');
    expect(container.querySelector('[data-testid="appointment-confirmation-history"]')).not.toBeNull();
  });

  it('requires channel and outcome before recording an attempt', async () => {
    const { container, props } = await renderPanel();
    await click(container.querySelector('[data-testid="appointment-record-confirmation-attempt-action"]'));
    await click(container.querySelector('[data-testid="appointment-confirmation-submit"]'));
    expect(container.textContent).toContain('Выберите способ связи.');
    await setValue(container.querySelector('[data-testid="appointment-confirmation-channel"]') as HTMLSelectElement, 'phone');
    await click(container.querySelector('[data-testid="appointment-confirmation-submit"]'));
    expect(container.textContent).toContain('Выберите результат связи.');
    expect(props.onRecordAttempt).not.toHaveBeenCalled();
  });

  it('trims note and records message_sent without displaying confirmed success wording', async () => {
    const onRecordAttempt = vi.fn().mockResolvedValue({ ...appointment, confirmationState: 'contact_in_progress' });
    const { container } = await renderPanel({ onRecordAttempt });
    await click(container.querySelector('[data-testid="appointment-record-confirmation-attempt-action"]'));
    await setValue(container.querySelector('[data-testid="appointment-confirmation-channel"]') as HTMLSelectElement, 'sms');
    await setValue(container.querySelector('[data-testid="appointment-confirmation-outcome"]') as HTMLSelectElement, 'message_sent');
    await setValue(container.querySelector('[data-testid="appointment-confirmation-note"]') as HTMLTextAreaElement, '  Шаблон отправлен  ');
    await click(container.querySelector('[data-testid="appointment-confirmation-submit"]'));
    expect(onRecordAttempt).toHaveBeenCalledWith('sms', 'message_sent', 'Шаблон отправлен');
    expect(container.textContent).toContain('Попытка связи сохранена.');
    expect(container.textContent).not.toContain('Запись подтверждена.');
  });

  it('confirms with channel and shows success while keeping appointment status separate', async () => {
    const onConfirm = vi.fn().mockResolvedValue({ ...appointment, confirmationState: 'confirmed', status: 'new' });
    const { container } = await renderPanel({ onConfirm });
    await click(container.querySelector('[data-testid="appointment-confirm-action"]'));
    await setValue(container.querySelector('[data-testid="appointment-confirmation-channel"]') as HTMLSelectElement, 'whatsapp');
    await setValue(container.querySelector('[data-testid="appointment-confirmation-note"]') as HTMLTextAreaElement, '  Подтвердил  ');
    await click(container.querySelector('[data-testid="appointment-confirmation-submit"]'));
    expect(onConfirm).toHaveBeenCalledWith('whatsapp', 'Подтвердил');
    expect(container.textContent).toContain('Запись подтверждена.');
  });

  it('shows reconciliation and safe server error without closing the form', async () => {
    const { container } = await renderPanel({ isRecordingAttempt: true, isReconciling: true, error: 'Запись была изменена другим пользователем. Обновите расписание.' });
    await click(container.querySelector('[data-testid="appointment-record-confirmation-attempt-action"]'));
    expect(container.textContent).toContain('Проверяем, была ли операция сохранена…');
    expect(container.textContent).toContain('Запись была изменена другим пользователем. Обновите расписание.');
  });

  it.each(['clinic_owner', 'clinic_admin', 'registrar'])('allows operational role %s', async (role) => {
    const { container } = await renderPanel({ role });
    expect(container.querySelector('[data-testid="appointment-record-confirmation-attempt-action"]')).not.toBeNull();
    expect(container.querySelector('[data-testid="appointment-confirm-action"]')).not.toBeNull();
  });

  it.each(['doctor', 'cashier', 'unknown'])('hides mutation actions for %s but shows state', async (role) => {
    const { container } = await renderPanel({ role });
    expect(container.querySelector('[data-testid="appointment-confirmation-state"]')).not.toBeNull();
    expect(container.querySelector('[data-testid="appointment-record-confirmation-attempt-action"]')).toBeNull();
    expect(container.querySelector('[data-testid="appointment-confirm-action"]')).toBeNull();
  });

  it.each(['cancelled', 'no_show', 'completed', 'arrived', 'in_progress', 'blocked'] as const)('hides actions for terminal/operational status %s', async (status) => {
    const { container } = await renderPanel({ value: { ...appointment, status } });
    expect(container.querySelector('[data-testid="appointment-record-confirmation-attempt-action"]')).toBeNull();
    expect(container.querySelector('[data-testid="appointment-confirm-action"]')).toBeNull();
  });

  it('attention policy includes callback/unreachable and excludes confirmed/cancelled/no-show', () => {
    expect(appointmentNeedsConfirmationAttention({ ...appointment, confirmationState: 'callback_requested' })).toBe(true);
    expect(appointmentNeedsConfirmationAttention({ ...appointment, confirmationState: 'unreachable' })).toBe(true);
    expect(appointmentNeedsConfirmationAttention({ ...appointment, confirmationState: 'confirmed' })).toBe(false);
    expect(appointmentNeedsConfirmationAttention({ ...appointment, status: 'cancelled' })).toBe(false);
    expect(appointmentNeedsConfirmationAttention({ ...appointment, status: 'no_show' })).toBe(false);
  });
});
