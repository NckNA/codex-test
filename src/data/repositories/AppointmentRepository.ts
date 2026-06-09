import type { Appointment, AppointmentStatus, PaymentType, Source } from '../../types';
import { storage } from '../../utils/storage';
import { supabase } from '../../lib/supabaseClient';
import type { SupabaseClient } from '@supabase/supabase-js';

export interface IAppointmentRepository {
  listAppointmentsByPatient(patientId: string): Promise<Appointment[]>;
  listAppointments(): Promise<Appointment[]>;
  createAppointment(appointment: Appointment): Promise<void>;
  updateAppointment(appointment: Appointment): Promise<void>;
  deleteAppointment(appointmentId: string): Promise<void>;
}

export type AppointmentRepositoryBackend = 'local' | 'supabase';

export interface CreateAppointmentRepositoryOptions {
  tenantId?: string | null;
  backend: AppointmentRepositoryBackend;
}

export const LocalStorageAppointmentRepository: IAppointmentRepository = {
  listAppointmentsByPatient: async (patientId: string): Promise<Appointment[]> => {
    // Mimics the sorting behavior from the UI component directly in the repository
    const appointments = storage.getAppointments()
      .filter(a => a.patientId === patientId)
      .sort((a, b) => new Date(b.start).getTime() - new Date(a.start).getTime());
    return Promise.resolve(appointments);
  },
  listAppointments: async (): Promise<Appointment[]> => {
    return Promise.resolve(storage.getAppointments());
  },
  createAppointment: async (appointment: Appointment): Promise<void> => {
    storage.addAppointment(appointment);
    return Promise.resolve();
  },
  updateAppointment: async (appointment: Appointment): Promise<void> => {
    storage.updateAppointment(appointment);
    return Promise.resolve();
  },
  deleteAppointment: async (appointmentId: string): Promise<void> => {
    storage.deleteAppointment(appointmentId);
    return Promise.resolve();
  }
};

export class SupabaseAppointmentRepository implements IAppointmentRepository {
  private readonly tenantId: string;
  private readonly client: SupabaseClient;

  constructor(tenantId: string, client: SupabaseClient) {
    this.tenantId = tenantId;
    this.client = client;
  }

  async listAppointmentsByPatient(patientId: string): Promise<Appointment[]> {
    const { data, error } = await this.client
      .from('appointments')
      .select('*')
      .eq('tenant_id', this.tenantId)
      .eq('patient_id', patientId)
      .order('start_time', { ascending: false });

    if (error) throw error;
    return (data || []).map(this.mapToAppointment);
  }

  async listAppointments(): Promise<Appointment[]> {
    const { data, error } = await this.client
      .from('appointments')
      .select('*')
      .eq('tenant_id', this.tenantId)
      .order('start_time', { ascending: true });

    if (error) throw error;
    return (data || []).map(this.mapToAppointment);
  }

  async createAppointment(appointment: Appointment): Promise<void> {
    const id = this.normalizeId(appointment.id);
    const mappedRow = this.mapToRow({ ...appointment, id });
    const { error } = await this.client
      .from('appointments')
      .insert({
        ...mappedRow,
        tenant_id: this.tenantId
      });

    if (error) throw error;
  }

  async updateAppointment(appointment: Appointment): Promise<void> {
    const { error } = await this.client
      .from('appointments')
      .update(this.mapToRow(appointment))
      .eq('tenant_id', this.tenantId)
      .eq('id', appointment.id);

    if (error) throw error;
  }

  async deleteAppointment(appointmentId: string): Promise<void> {
    const { error } = await this.client
      .from('appointments')
      .delete()
      .eq('tenant_id', this.tenantId)
      .eq('id', appointmentId);

    if (error) throw error;
  }

  private normalizeId(id?: string): string {
    if (!id || id.length !== 36) {
      return crypto.randomUUID();
    }
    return id;
  }

  private normalizeTimeForDb(timeStr: string): string {
    if (!timeStr) return timeStr;
    if (timeStr.endsWith('Z') || /[+-]\d{2}:\d{2}$/.test(timeStr)) {
      return timeStr;
    }
    // Force UTC storage of local digits to prevent timezone shifting in UI
    return timeStr.length === 16 ? `${timeStr}:00Z` : `${timeStr}Z`;
  }

  private mapToRow(appointment: Appointment): Record<string, unknown> {
    return {
      id: appointment.id,
      patient_id: appointment.patientId || null,
      doctor_id: appointment.doctorId || null,
      cabinet: appointment.cabinet || '',
      service: appointment.service || '',
      status: appointment.status,
      payment_type: appointment.paymentType || null,
      source: appointment.source || null,
      price: appointment.price === undefined ? null : appointment.price,
      comment: appointment.comment || null,
      start_time: this.normalizeTimeForDb(appointment.start),
      end_time: this.normalizeTimeForDb(appointment.end),
      created_at: appointment.createdAt ? this.normalizeTimeForDb(appointment.createdAt) : undefined,
    };
  }

  private normalizeTimeFromDb(timeStr: string): string {
    if (!timeStr) return timeStr;
    // Strip trailing Z or timezone offset (e.g. +00:00) so UI treats it as local wall-clock time
    return timeStr.replace(/(Z|[+-]\d{2}:\d{2})$/, '');
  }

  private mapToAppointment = (row: Record<string, unknown>): Appointment => {
    return {
      id: row.id as string,
      patientId: (row.patient_id as string) || undefined,
      doctorId: row.doctor_id as string,
      cabinet: (row.cabinet as string) || '',
      service: (row.service as string) || '',
      status: row.status as AppointmentStatus,
      paymentType: (row.payment_type as PaymentType) || undefined,
      source: (row.source as Source) || undefined,
      price: row.price !== null ? Number(row.price) : undefined,
      comment: (row.comment as string) || undefined,
      start: this.normalizeTimeFromDb(row.start_time as string),
      end: this.normalizeTimeFromDb(row.end_time as string),
      createdAt: this.normalizeTimeFromDb(row.created_at as string),
    };
  };
}

export function createAppointmentRepository(options: CreateAppointmentRepositoryOptions): IAppointmentRepository {
  if (options.backend === 'supabase' && options.tenantId && supabase) {
    return new SupabaseAppointmentRepository(options.tenantId, supabase as SupabaseClient);
  }
  return LocalStorageAppointmentRepository;
}
