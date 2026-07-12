/* eslint-disable @typescript-eslint/no-explicit-any */
// @vitest-environment jsdom
(globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { Appointment } from '../../types';
import { AppointmentCancellationDialog } from './AppointmentCancellationDialog';
import { AppointmentNoShowDialog } from './AppointmentNoShowDialog';

const appointment: Appointment = {
  id: 'appointment-1',
  patientId: 'patient-1',
  doctorId: 'doctor-1',
  cabinet: 'A1',
  service: 'Осмотр',
  status: 'confirmed',
  start: '2026-08-01T10:00:00',
  end: '2026-08-01T11:00:00',
  createdAt: '2026-07-01T09:00:00',
  updatedAt: '2026-07-01T09:30:00+00:00',
};

const setNativeValue = async (element: HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement, value: string) => {
  const prototype = element instanceof HTMLSelectElement
    ? HTMLSelectElement.prototype
    : element instanceof HTMLTextAreaElement
      ? HTMLTextAreaElement.prototype
      : HTMLInputElement.prototype;
  await act(async () => {
    Object.getOwnPropertyDescriptor(prototype, 'value')?.set?.call(element, value);
    element.dispatchEvent(new Event(element instanceof HTMLSelectElement ? 'change' : 'input', { bubbles: true }));
  });
};

const submit = async (container: HTMLElement) => {
  const form = container.querySelector('form') as HTMLFormElement;
  await act(async () => form.dispatchEvent(new Event('submit', { bubbles: true, cancelable: true })));
};

const cleanup = async (root: Root, container: HTMLElement) => {
  await act(async () => root.unmount());
  container.remove();
};

const renderCancellation = async (overrides: Record<string, unknown> = {}) => {
  const container = document.createElement('div');
  document.body.appendChild(container);
  const root = createRoot(container);
  const onConfirm = (overrides.onConfirm as any) || vi.fn().mockResolvedValue({ ...appointment, status: 'cancelled' });
  const onClose = vi.fn();
  await act(async () => root.render(
    <AppointmentCancellationDialog
      appointment={appointment}
      patientName="Пациент Один"
      doctorName="Врач Один"
      isSaving={Boolean(overrides.isSaving)}
      isReconciling={Boolean(overrides.isReconciling)}
      error={(overrides.error as Error | null) || null}
      onConfirm={onConfirm}
      onClose={onClose}
    />,
  ));
  return { container, root, onConfirm, onClose };
};

const renderNoShow = async (overrides: Record<string, unknown> = {}) => {
  const container = document.createElement('div');
  document.body.appendChild(container);
  const root = createRoot(container);
  const onConfirm = (overrides.onConfirm as any) || vi.fn().mockResolvedValue({ ...appointment, status: 'no_show' });
  const onClose = vi.fn();
  await act(async () => root.render(
    <AppointmentNoShowDialog
      appointment={appointment}
      patientName="Пациент Один"
      doctorName="Врач Один"
      isSaving={Boolean(overrides.isSaving)}
      isReconciling={Boolean(overrides.isReconciling)}
      error={(overrides.error as Error | null) || null}
      onConfirm={onConfirm}
      onClose={onClose}
    />,
  ));
  return { container, root, onConfirm, onClose };
};

describe('Appointment lifecycle dialogs', () => {
  beforeEach(() => vi.clearAllMocks());

  it('shows fixed appointment facts and cancellation warning', async () => {
    const view = await renderCancellation();
    expect(view.container.textContent).toContain('Пациент Один');
    expect(view.container.textContent).toContain('Врач Один');
    expect(view.container.textContent).toContain('confirmed');
    expect(view.container.textContent).toContain('Запись останется в истории, а время врача станет доступно для новой записи.');
    await cleanup(view.root, view.container);
  });

  it('requires cancellation source before submit', async () => {
    const view = await renderCancellation();
    await setNativeValue(view.container.querySelector('#cancellation-reason') as HTMLTextAreaElement, 'Причина');
    await submit(view.container);
    expect(view.container.textContent).toContain('Укажите, кто отменил запись.');
    expect(view.onConfirm).not.toHaveBeenCalled();
    await cleanup(view.root, view.container);
  });

  it('requires a non-empty cancellation reason', async () => {
    const view = await renderCancellation();
    await setNativeValue(view.container.querySelector('#cancellation-source') as HTMLSelectElement, 'patient');
    await setNativeValue(view.container.querySelector('#cancellation-reason') as HTMLTextAreaElement, '   ');
    await submit(view.container);
    expect(view.container.textContent).toContain('Укажите причину.');
    expect(view.onConfirm).not.toHaveBeenCalled();
    await cleanup(view.root, view.container);
  });

  it('trims cancellation reason and shows confirmed success', async () => {
    const view = await renderCancellation();
    await setNativeValue(view.container.querySelector('#cancellation-source') as HTMLSelectElement, 'clinic');
    await setNativeValue(view.container.querySelector('#cancellation-reason') as HTMLTextAreaElement, '  Клиника закрыта  ');
    await submit(view.container);
    expect(view.onConfirm).toHaveBeenCalledWith('clinic', 'Клиника закрыта');
    expect(view.container.textContent).toContain('Запись отменена.');
    await cleanup(view.root, view.container);
  });

  it('shows cancellation loading and recovery states with disabled controls', async () => {
    const view = await renderCancellation({ isSaving: true, isReconciling: true });
    expect(view.container.textContent).toContain('Проверяем, была ли запись отменена…');
    expect(view.container.textContent).toContain('Проверяем…');
    expect((view.container.querySelector('#cancellation-source') as HTMLSelectElement).disabled).toBe(true);
    await cleanup(view.root, view.container);
  });

  it('keeps cancellation form open for a safe conflict', async () => {
    const view = await renderCancellation({ error: new Error('Запись была изменена другим пользователем. Обновите расписание.') });
    expect(view.container.textContent).toContain('Запись была изменена другим пользователем. Обновите расписание.');
    expect(view.container.querySelector('form')).not.toBeNull();
    await cleanup(view.root, view.container);
  });

  it('renders a separate no-show workflow and explicit no-treatment warning', async () => {
    const view = await renderNoShow();
    expect(view.container.textContent).toContain('Отметить неявку');
    expect(view.container.textContent).toContain('Неявка будет сохранена в истории пациента. Лечение и выполненная услуга автоматически не создаются.');
    expect(view.container.textContent).not.toContain('Кто отменил запись');
    await cleanup(view.root, view.container);
  });

  it('requires no-show reason', async () => {
    const view = await renderNoShow();
    await submit(view.container);
    expect(view.container.textContent).toContain('Укажите причину.');
    expect(view.onConfirm).not.toHaveBeenCalled();
    await cleanup(view.root, view.container);
  });

  it('trims no-show reason and shows confirmed success', async () => {
    const view = await renderNoShow();
    await setNativeValue(view.container.querySelector('#no-show-reason') as HTMLTextAreaElement, '  Не отвечает  ');
    await submit(view.container);
    expect(view.onConfirm).toHaveBeenCalledWith('Не отвечает');
    expect(view.container.textContent).toContain('Неявка отмечена.');
    await cleanup(view.root, view.container);
  });

  it('shows no-show recovery and safe error states', async () => {
    const view = await renderNoShow({
      isSaving: true,
      isReconciling: true,
      error: new Error('Текущий статус записи не позволяет выполнить это действие.'),
    });
    expect(view.container.textContent).toContain('Проверяем, была ли неявка сохранена…');
    expect(view.container.textContent).toContain('Текущий статус записи не позволяет выполнить это действие.');
    expect((view.container.querySelector('#no-show-reason') as HTMLTextAreaElement).disabled).toBe(true);
    await cleanup(view.root, view.container);
  });
});
