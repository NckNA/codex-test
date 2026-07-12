/* eslint-disable @typescript-eslint/no-explicit-any */
// @vitest-environment jsdom
(globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
import { act } from 'react';
import { createRoot } from 'react-dom/client';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { PatientHistoryTab } from './PatientHistoryTab';
import { usePatientAppointments } from '../../../data/hooks/usePatientAppointments';
import { useClinicDoctors } from '../../../data/hooks/useClinicDoctors';
import type { Appointment } from '../../../types';

vi.mock('../../../data/hooks/usePatientAppointments', () => ({ usePatientAppointments: vi.fn() }));
vi.mock('../../../data/hooks/useClinicDoctors', () => ({ useClinicDoctors: vi.fn() }));

const row = (overrides: Partial<Appointment> = {}): Appointment => ({
  id: 'appointment-1',
  patientId: 'patient-1',
  doctorId: 'doctor-1',
  cabinet: 'A1',
  service: 'Осмотр',
  status: 'confirmed',
  start: '2026-08-01T10:00:00',
  end: '2026-08-01T11:00:00',
  createdAt: '2026-07-01T10:00:00',
  updatedAt: '2026-07-01T10:00:00+00:00',
  ...overrides,
});

describe('PatientHistoryTab', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(useClinicDoctors).mockReturnValue({
      doctors: [{ id: 'doctor-1', fullName: 'Доктор Один', specialization: '', cabinet: 'A1', color: '', active: true }],
      isLoading: false,
      isError: false,
    } as any);
  });

  const render = async () => {
    const container = document.createElement('div');
    const root = createRoot(container);
    await act(async () => root.render(<PatientHistoryTab patientId="patient-1" />));
    return { container, root };
  };

  it('displays authoritative appointment facts including doctor, time and status', async () => {
    vi.mocked(usePatientAppointments).mockReturnValue({
      appointments: [row()],
      isLoading: false,
      isError: false,
    } as any);
    const { container, root } = await render();

    expect(container.textContent).toContain('Осмотр');
    expect(container.textContent).toContain('Доктор Один');
    expect(container.textContent).toContain('Подтвержден');
    expect(container.textContent).toContain('10:00');
    await act(async () => root.unmount());
  });

  it('keeps cancelled appointments visible as history facts', async () => {
    vi.mocked(usePatientAppointments).mockReturnValue({
      appointments: [row({ status: 'cancelled', service: 'Отменённый приём' })],
      isLoading: false,
      isError: false,
    } as any);
    const { container, root } = await render();

    expect(container.textContent).toContain('Отменённый приём');
    expect(container.textContent).toContain('Отменен');
    await act(async () => root.unmount());
  });

  it('shows auditable cancellation metadata without raw actor UUID', async () => {
    vi.mocked(usePatientAppointments).mockReturnValue({
      appointments: [row({
        status: 'cancelled',
        cancelledAt: '2026-08-01T12:00:00',
        cancelledBy: 'raw-user-uuid',
        cancellationSource: 'patient',
        cancellationReason: 'Пациент попросил отменить',
        lifecycleMetadataVersion: 1,
      })],
      isLoading: false,
      isError: false,
    } as any);
    const { container, root } = await render();

    const metadata = container.querySelector('[data-testid="history-cancellation-appointment-1"]');
    expect(metadata?.textContent).toContain('Пациент попросил отменить');
    expect(metadata?.textContent).toContain('Источник: Пациент');
    expect(metadata?.textContent).toContain('Сотрудник клиники');
    expect(metadata?.textContent).not.toContain('raw-user-uuid');
    await act(async () => root.unmount());
  });

  it('shows auditable no-show metadata without creating treatment wording', async () => {
    vi.mocked(usePatientAppointments).mockReturnValue({
      appointments: [row({
        status: 'no_show',
        noShowAt: '2026-08-01T12:00:00',
        noShowBy: 'raw-user-uuid',
        noShowReason: 'Не отвечает на звонки',
        lifecycleMetadataVersion: 1,
      })],
      isLoading: false,
      isError: false,
    } as any);
    const { container, root } = await render();

    const metadata = container.querySelector('[data-testid="history-no-show-appointment-1"]');
    expect(metadata?.textContent).toContain('Не отвечает на звонки');
    expect(metadata?.textContent).toContain('Сотрудник клиники');
    expect(metadata?.textContent).not.toContain('raw-user-uuid');
    expect(metadata?.textContent).not.toContain('Лечение выполнено');
    await act(async () => root.unmount());
  });

  it('shows confirmation facts without presenting contact as clinical treatment', async () => {
    vi.mocked(usePatientAppointments).mockReturnValue({
      appointments: [row({
        confirmationState: 'confirmed',
        confirmedAt: '2026-08-01T09:30:00',
        confirmationChannel: 'whatsapp',
        confirmationAttemptCount: 2,
        lastConfirmationAttemptAt: '2026-08-01T09:30:00',
        lastConfirmationOutcome: 'confirmed',
        lastConfirmationNote: 'Пациент подтвердил',
      })],
      isLoading: false,
      isError: false,
    } as any);
    const { container, root } = await render();

    const metadata = container.querySelector('[data-testid="history-confirmation-appointment-1"]');
    expect(metadata?.textContent).toContain('Подтверждена');
    expect(metadata?.textContent).toContain('Попыток связи: 2');
    expect(metadata?.textContent).toContain('Подтвердил');
    expect(metadata?.textContent).toContain('WhatsApp');
    expect(metadata?.textContent).toContain('Пациент подтвердил');
    expect(metadata?.textContent).not.toContain('Лечение выполнено');
    await act(async () => root.unmount());
  });

  it('shows loading and empty states without demo rows', async () => {
    vi.mocked(usePatientAppointments).mockReturnValue({ appointments: [], isLoading: true, isError: false } as any);
    const loading = await render();
    expect(loading.container.textContent).toContain('Загрузка истории приёмов...');
    await act(async () => loading.root.unmount());

    vi.mocked(usePatientAppointments).mockReturnValue({ appointments: [], isLoading: false, isError: false } as any);
    const empty = await render();
    expect(empty.container.textContent).toContain('У пациента еще не было приёмов.');
    await act(async () => empty.root.unmount());
  });

  it('shows only the safe patient appointment error', async () => {
    vi.mocked(usePatientAppointments).mockReturnValue({
      appointments: [],
      isLoading: false,
      isError: true,
      error: new Error('SQLSTATE 42501 public.appointments'),
    } as any);
    const { container, root } = await render();

    expect(container.textContent).toContain('Не удалось загрузить записи пациента.');
    expect(container.textContent).not.toContain('SQLSTATE');
    expect(container.textContent).not.toContain('appointments');
    await act(async () => root.unmount());
  });

  it('reflects edited appointment time and status on rerender', async () => {
    let appointments = [row()];
    vi.mocked(usePatientAppointments).mockImplementation(() => ({
      appointments,
      isLoading: false,
      isError: false,
    } as any));
    const container = document.createElement('div');
    const root = createRoot(container);
    await act(async () => root.render(<PatientHistoryTab patientId="patient-1" />));
    expect(container.textContent).toContain('10:00');

    appointments = [row({ start: '2026-08-01T12:30:00', end: '2026-08-01T13:30:00', status: 'arrived' })];
    await act(async () => root.render(<PatientHistoryTab patientId="patient-1" />));

    expect(container.textContent).toContain('12:30');
    expect(container.textContent).toContain('Пришел');
    await act(async () => root.unmount());
  });
});
