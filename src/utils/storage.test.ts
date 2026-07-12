// @vitest-environment jsdom
import { beforeEach, describe, expect, it } from 'vitest';
import { storage } from './storage';

describe('storage appointment bootstrap', () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it('does not create df_appointments when configured mode excludes appointment demo facts', () => {
    storage.init({ includeAppointments: false });

    expect(localStorage.getItem('df_initialized')).toBe('true');
    expect(localStorage.getItem('df_patients')).not.toBeNull();
    expect(localStorage.getItem('df_doctors')).not.toBeNull();
    expect(localStorage.getItem('df_appointments')).toBeNull();
  });

  it('does not delete or overwrite an existing appointment key', () => {
    const existing = JSON.stringify([{ id: 'user-owned-row' }]);
    localStorage.setItem('df_appointments', existing);

    storage.init({ includeAppointments: false });

    expect(localStorage.getItem('df_appointments')).toBe(existing);
  });

  it('initializes appointment demo facts only for explicit local mode', () => {
    storage.init({ includeAppointments: false });
    expect(localStorage.getItem('df_appointments')).toBeNull();

    storage.init({ includeAppointments: true });

    expect(storage.getAppointments().length).toBeGreaterThan(0);
  });

  it('keeps explicit local appointment CRUD functional', () => {
    storage.init({ includeAppointments: true });
    const originalCount = storage.getAppointments().length;
    const appointment = {
      id: 'local-test',
      patientId: 'patient-1',
      doctorId: 'doctor-1',
      cabinet: 'A1',
      service: 'Осмотр',
      status: 'new' as const,
      start: '2026-08-01T10:00:00',
      end: '2026-08-01T11:00:00',
      createdAt: '2026-07-01T10:00:00',
    };

    storage.addAppointment(appointment);
    expect(storage.getAppointments()).toHaveLength(originalCount + 1);

    storage.updateAppointment({ ...appointment, status: 'confirmed' });
    expect(storage.getAppointments().find((row) => row.id === appointment.id)?.status).toBe('confirmed');

    storage.deleteAppointment(appointment.id);
    expect(storage.getAppointments().some((row) => row.id === appointment.id)).toBe(false);
  });
});
