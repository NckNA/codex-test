/* eslint-disable @typescript-eslint/no-explicit-any */
// @vitest-environment jsdom
(globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { MemoryRouter } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { Appointment } from '../../types';
import { AppointmentModal } from './AppointmentModal';

const doctors = [
  { id: 'd1', fullName: 'Doctor One', specialization: 'Dentist', cabinet: 'A1', active: true, color: 'blue' },
  { id: 'd2', fullName: 'Doctor Two', specialization: 'Surgeon', cabinet: 'A2', active: true, color: 'green' },
];

const patients = [
  { id: 'p1', fullName: 'Patient One', phone: '111', source: 'walk_in', status: 'active', createdAt: '' } as any,
  { id: 'p2', fullName: 'Patient Two', phone: '222', source: 'phone', status: 'active', createdAt: '' } as any,
];

const baseInitial: Partial<Appointment> = {
  patientId: 'p1',
  doctorId: 'd1',
  cabinet: 'A1',
  service: 'Осмотр',
  status: 'new',
  paymentType: 'unpaid',
  source: 'phone',
  start: '2026-08-01T10:00:00',
  end: '2026-08-01T11:00:00',
};

interface RenderOptions {
  initialData?: Partial<Appointment>;
  appointments?: Appointment[];
  onSave?: any;
  onClose?: any;
  isSaving?: boolean;
  isReconciling?: boolean;
  serverError?: string | null;
}

const renderModal = async (options: RenderOptions = {}) => {
  const container = document.createElement('div');
  document.body.appendChild(container);
  const root = createRoot(container);
  const onSave = options.onSave || vi.fn().mockResolvedValue(true);
  const onClose = options.onClose || vi.fn();

  await act(async () => {
    root.render(
      <MemoryRouter>
        <AppointmentModal
          isOpen
          onClose={onClose}
          onSave={onSave}
          initialData={{ ...baseInitial, ...options.initialData }}
          appointments={options.appointments || []}
          doctors={doctors}
          patients={patients}
          isSaving={options.isSaving}
          isReconciling={options.isReconciling}
          serverError={options.serverError}
        />
      </MemoryRouter>,
    );
  });

  return { container, root, onSave, onClose };
};

const submit = async (container: HTMLElement) => {
  const form = container.querySelector('#appointment-form') as HTMLFormElement;
  await act(async () => {
    form.dispatchEvent(new Event('submit', { bubbles: true, cancelable: true }));
  });
};

const cleanup = async (root: Root, container: HTMLElement) => {
  await act(async () => root.unmount());
  container.remove();
};

describe('AppointmentModal', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('creates one appointment with a generated id and selected patient', async () => {
    const { container, root, onSave } = await renderModal();

    await submit(container);

    expect(onSave).toHaveBeenCalledTimes(1);
    const saved = onSave.mock.calls[0][0] as Appointment;
    expect(saved.id).toHaveLength(36);
    expect(saved.patientId).toBe('p1');
    expect(saved.doctorId).toBe('d1');
    await cleanup(root, container);
  });

  it('preserves existing appointment id and updatedAt for optimistic reschedule', async () => {
    const { container, root, onSave } = await renderModal({
      initialData: {
        id: 'existing-id',
        createdAt: '2026-07-01T09:00:00',
        updatedAt: '2026-07-01T09:30:00+00:00',
      },
    });

    await submit(container);

    const saved = onSave.mock.calls[0][0] as Appointment;
    expect(saved.id).toBe('existing-id');
    expect(saved.updatedAt).toBe('2026-07-01T09:30:00+00:00');
    await cleanup(root, container);
  });

  it('uses an immediate submit lock so rapid duplicate submits call onSave once', async () => {
    let resolveSave: ((value: boolean) => void) | undefined;
    const pending = new Promise<boolean>((resolve) => { resolveSave = resolve; });
    const onSave = vi.fn(() => pending);
    const { container, root } = await renderModal({ onSave });
    const form = container.querySelector('#appointment-form') as HTMLFormElement;

    await act(async () => {
      form.dispatchEvent(new Event('submit', { bubbles: true, cancelable: true }));
      form.dispatchEvent(new Event('submit', { bubbles: true, cancelable: true }));
      await Promise.resolve();
    });

    expect(onSave).toHaveBeenCalledTimes(1);
    expect((container.querySelector('button[form="appointment-form"]') as HTMLButtonElement).disabled).toBe(true);
    expect(container.textContent).toContain('Сохраняем запись…');

    await act(async () => resolveSave?.(true));
    await cleanup(root, container);
  });

  it('shows reconciliation state and disables dismissal while checking uncertain result', async () => {
    const onClose = vi.fn();
    const { container, root } = await renderModal({
      onClose,
      isSaving: true,
      isReconciling: true,
    });

    expect(container.textContent).toContain('Проверяем, была ли запись сохранена…');
    expect(container.textContent).toContain('Сохраняем запись…');
    const closeButton = container.querySelector('button[aria-label="Закрыть"]') as HTMLButtonElement;
    expect(closeButton.disabled).toBe(true);

    await act(async () => closeButton.click());
    expect(onClose).not.toHaveBeenCalled();
    await cleanup(root, container);
  });

  it('shows safe server doctor and patient conflicts without closing form', async () => {
    const doctor = await renderModal({ serverError: 'У врача уже есть запись на это время.' });
    expect(doctor.container.textContent).toContain('У врача уже есть запись на это время.');
    expect(doctor.container.querySelector('#appointment-form')).not.toBeNull();
    await cleanup(doctor.root, doctor.container);

    const patient = await renderModal({ serverError: 'У пациента уже есть другая запись на это время.' });
    expect(patient.container.textContent).toContain('У пациента уже есть другая запись на это время.');
    expect(patient.container.querySelector('#appointment-form')).not.toBeNull();
    await cleanup(patient.root, patient.container);
  });

  it('blocks doctor overlap using half-open client check', async () => {
    const existing: Appointment = {
      ...baseInitial,
      id: 'existing-doctor',
      patientId: 'p2',
      start: '2026-08-01T10:00:00',
      end: '2026-08-01T11:00:00',
      createdAt: '2026-07-01T09:00:00',
    } as Appointment;
    const { container, root, onSave } = await renderModal({
      initialData: { start: '2026-08-01T10:30:00', end: '2026-08-01T11:30:00' },
      appointments: [existing],
    });

    await submit(container);

    expect(onSave).not.toHaveBeenCalled();
    expect(container.textContent).toContain('У врача уже есть запись на это время.');
    await cleanup(root, container);
  });

  it('blocks patient overlap even when doctors differ', async () => {
    const existing: Appointment = {
      ...baseInitial,
      id: 'existing-patient',
      doctorId: 'd2',
      patientId: 'p1',
      createdAt: '2026-07-01T09:00:00',
    } as Appointment;
    const { container, root, onSave } = await renderModal({ appointments: [existing] });

    await submit(container);

    expect(onSave).not.toHaveBeenCalled();
    expect(container.textContent).toContain('У пациента уже есть другая запись на это время.');
    await cleanup(root, container);
  });

  it('allows back-to-back interval and ignores cancelled appointments in quick check', async () => {
    const active: Appointment = {
      ...baseInitial,
      id: 'active',
      patientId: 'p2',
      start: '2026-08-01T10:00:00',
      end: '2026-08-01T11:00:00',
      createdAt: '2026-07-01T09:00:00',
    } as Appointment;
    const adjacent = await renderModal({
      initialData: { start: '2026-08-01T11:00:00', end: '2026-08-01T12:00:00' },
      appointments: [active],
    });
    await submit(adjacent.container);
    expect(adjacent.onSave).toHaveBeenCalledTimes(1);
    await cleanup(adjacent.root, adjacent.container);

    const cancelled = await renderModal({
      appointments: [{ ...active, status: 'cancelled', patientId: 'p1' }],
    });
    await submit(cancelled.container);
    expect(cancelled.onSave).toHaveBeenCalledTimes(1);
    await cleanup(cancelled.root, cancelled.container);
  });

  it('rejects zero and negative intervals before repository call', async () => {
    const zero = await renderModal({ initialData: { end: '2026-08-01T10:00:00' } });
    await submit(zero.container);
    expect(zero.onSave).not.toHaveBeenCalled();
    expect(zero.container.textContent).toContain('Время окончания должно быть позже времени начала.');
    await cleanup(zero.root, zero.container);

    const negative = await renderModal({ initialData: { end: '2026-08-01T09:00:00' } });
    await submit(negative.container);
    expect(negative.onSave).not.toHaveBeenCalled();
    expect(negative.container.textContent).toContain('Время окончания должно быть позже времени начала.');
    await cleanup(negative.root, negative.container);
  });

  it('keeps form data open when save rejects', async () => {
    const onSave = vi.fn().mockRejectedValue(new Error('У врача уже есть запись на это время.'));
    const { container, root } = await renderModal({ onSave });

    await submit(container);

    expect(container.querySelector('#appointment-form')).not.toBeNull();
    expect(container.textContent).toContain('У врача уже есть запись на это время.');
    const service = container.querySelector('input[name="service"]') as HTMLInputElement;
    expect(service.value).toBe('Осмотр');
    await cleanup(root, container);
  });
});
