import { describe, expect, it } from 'vitest';
import type { Appointment, ChiefComplaint, DentalFinding, Patient, TreatmentPlan } from '../../types';
import type { ActivityEvent } from '../repositories/AuditActivityRepository';
import type { TimelinePatientFile, PatientTimelineEvent } from './PatientTimelineAggregator';
import {
  ACTIVE_CLINIC_REQUIRED_FOR_TIMELINE,
  ACTIVITY_TIMELINE_CATEGORY_MAP,
  PATIENT_REQUIRED_FOR_TIMELINE,
  buildPatientTimeline,
  canRoleSeePatientTimelineEvent,
  filterPatientTimelineEvents,
  sortPatientTimelineEvents,
} from './PatientTimelineAggregator';

const tenantId = 'tenant-a';
const patientId = 'patient-a';

function finding(overrides: Partial<DentalFinding> = {}): DentalFinding {
  return {
    id: 'finding-a',
    patientId,
    toothNumber: 11,
    title: 'Кариес 11',
    category: 'caries',
    severity: 'medium',
    description: 'Описание находки',
    isChiefComplaintRelated: false,
    includeInTreatmentPlan: true,
    status: 'discovered',
    createdAt: '2026-01-02T10:00:00.000Z',
    updatedAt: '2026-01-02T11:00:00.000Z',
    ...overrides,
  };
}

function plan(overrides: Partial<TreatmentPlan> = {}): TreatmentPlan {
  return {
    id: 'plan-a',
    patientId,
    title: 'План лечения',
    status: 'draft',
    stages: [],
    totalPrice: 120000,
    createdAt: '2026-01-03T10:00:00.000Z',
    updatedAt: '2026-01-03T11:00:00.000Z',
    ...overrides,
  };
}

function appointment(overrides: Partial<Appointment> = {}): Appointment {
  return {
    id: 'appointment-a',
    patientId,
    doctorId: 'doctor-a',
    cabinet: '1',
    service: 'Консультация',
    start: '2026-01-04T10:00:00.000Z',
    end: '2026-01-04T10:30:00.000Z',
    status: 'confirmed',
    createdAt: '2026-01-01T08:00:00.000Z',
    ...overrides,
  };
}

function patientFile(overrides: Partial<TimelinePatientFile> = {}): TimelinePatientFile {
  return {
    id: 'file-a',
    tenantId,
    patientId,
    storageBucket: 'patient-files',
    storagePath: `${tenantId}/patients/${patientId}/dental-photos/file-a-photo.jpg`,
    originalFilename: 'photo.jpg',
    mimeType: 'image/jpeg',
    sizeBytes: 1024,
    fileKind: 'dental_photo',
    sourceContext: 'dental_chart',
    isArchived: false,
    createdAt: '2026-01-05T10:00:00.000Z',
    updatedAt: '2026-01-05T10:00:00.000Z',
    toothId: '11',
    findingId: 'finding-a',
    treatmentPlanId: 'plan-a',
    uploadedBy: 'doctor-a',
    ...overrides,
  };
}

function activityEvent(overrides: Partial<ActivityEvent> = {}): ActivityEvent {
  return {
    id: 'activity-a',
    tenantId,
    patientId,
    auditEventId: 'audit-a',
    actorUserId: 'doctor-a',
    category: 'finding',
    type: 'finding_note_added',
    title: 'Activity finding note added',
    description: 'Safe short description',
    sourceType: 'finding',
    sourceId: 'finding-a',
    sourceStatus: 'discovered',
    visibility: 'clinical',
    severity: 'info',
    occurredAt: '2026-01-06T10:00:00.000Z',
    metadata: { before_data: { raw: true }, after_data: { raw: true }, secret: 'do-not-render' },
    isArchived: false,
    createdAt: '2026-01-06T09:00:00.000Z',
    ...overrides,
  };
}

describe('PatientTimelineAggregator', () => {
  it('builds timeline events from findings', () => {
    const events = buildPatientTimeline({ tenantId, patientId, findings: [finding()] });

    expect(events).toHaveLength(1);
    expect(events[0]).toMatchObject({
      category: 'finding',
      sourceType: 'finding',
      sourceId: 'finding-a',
      findingId: 'finding-a',
      toothId: '11',
      visibility: 'clinical',
      sourceStatus: 'discovered',
      isArchived: false,
    });
  });

  it('builds timeline events from treatment plans without inventing stage events', () => {
    const events = buildPatientTimeline({ tenantId, patientId, treatmentPlans: [plan()] });

    expect(events).toHaveLength(1);
    expect(events[0]).toMatchObject({
      category: 'treatment_plan',
      sourceType: 'treatment_plan',
      treatmentPlanId: 'plan-a',
      visibility: 'clinical',
      sourceStatus: 'draft',
      metadata: { totalPrice: 120000, stageCount: 0 },
    });
  });

  it('builds appointment events without treating appointments as completed treatment', () => {
    const events = buildPatientTimeline({ tenantId, patientId, appointments: [appointment({ status: 'completed' })] });

    expect(events).toHaveLength(1);
    expect(events[0]).toMatchObject({
      category: 'appointment',
      sourceType: 'appointment',
      appointmentId: 'appointment-a',
      type: 'appointment_scheduled',
      sourceStatus: 'completed',
      visibility: 'admin',
    });
    expect(events[0].category).not.toBe('treatment_plan');
  });

  it('builds patient file events and preserves metadata source links', () => {
    const events = buildPatientTimeline({ tenantId, patientId, patientFiles: [patientFile()] });

    expect(events).toHaveLength(1);
    expect(events[0]).toMatchObject({
      category: 'file',
      sourceType: 'patient_file',
      fileId: 'file-a',
      toothId: '11',
      findingId: 'finding-a',
      treatmentPlanId: 'plan-a',
      actorUserId: 'doctor-a',
      visibility: 'clinical',
      isArchived: false,
    });
  });

  it('can include patient and chief complaint events when source data is passed in', () => {
    const patient: Patient = {
      id: patientId,
      fullName: 'Test Patient',
      phone: 'test-phone',
      source: 'phone',
      status: 'active',
      createdAt: '2026-01-01T09:00:00.000Z',
    };
    const complaint: ChiefComplaint = {
      id: 'complaint-a',
      patientId,
      text: 'Болит зуб',
      relatedTeeth: [11],
      createdAt: '2026-01-01T10:00:00.000Z',
      updatedAt: '2026-01-01T10:00:00.000Z',
    };

    const events = buildPatientTimeline({ tenantId, patientId, patient, chiefComplaint: complaint });

    expect(events.map((event) => event.category)).toEqual(['complaint', 'patient']);
    expect(events[0].sourceType).toBe('complaint');
    expect(events[1].sourceType).toBe('patient');
  });

  it('sorts events by occurredAt descending', () => {
    const events = buildPatientTimeline({
      tenantId,
      patientId,
      findings: [finding()],
      treatmentPlans: [plan()],
      appointments: [appointment()],
      patientFiles: [patientFile()],
    });

    expect(events.map((event) => event.sourceType)).toEqual([
      'patient_file',
      'appointment',
      'treatment_plan',
      'finding',
    ]);
  });

  it('uses a deterministic tie-break for equal timestamps', () => {
    const sameTime = '2026-01-06T10:00:00.000Z';
    const events: PatientTimelineEvent[] = [
      {
        id: 'z',
        tenantId,
        patientId,
        occurredAt: sameTime,
        category: 'file',
        type: 'b',
        title: 'File',
        sourceType: 'patient_file',
        sourceId: 'z',
        visibility: 'clinical',
      },
      {
        id: 'a',
        tenantId,
        patientId,
        occurredAt: sameTime,
        category: 'finding',
        type: 'a',
        title: 'Finding',
        sourceType: 'finding',
        sourceId: 'a',
        visibility: 'clinical',
      },
    ];

    expect(sortPatientTimelineEvents(events).map((event) => event.id)).toEqual(['a', 'z']);
  });

  it('excludes archived findings by default and includes them when requested', () => {
    const archived = finding({ id: 'finding-archived', status: 'archived' });

    expect(buildPatientTimeline({ tenantId, patientId, findings: [archived] })).toHaveLength(0);

    const events = buildPatientTimeline({ tenantId, patientId, findings: [archived], includeArchived: true });
    expect(events).toHaveLength(1);
    expect(events[0]).toMatchObject({ isArchived: true, type: 'finding_archived' });
  });

  it('excludes archived patient files by default and includes them when requested', () => {
    const archived = patientFile({
      id: 'file-archived',
      isArchived: true,
      archivedAt: '2026-01-07T10:00:00.000Z',
      archivedBy: 'doctor-a',
    });

    expect(buildPatientTimeline({ tenantId, patientId, patientFiles: [archived] })).toHaveLength(0);

    const events = buildPatientTimeline({ tenantId, patientId, patientFiles: [archived], includeArchived: true });
    expect(events).toHaveLength(1);
    expect(events[0]).toMatchObject({ isArchived: true, type: 'patient_file_archived', actorUserId: 'doctor-a' });
  });

  it('throws clear errors for missing tenantId or patientId', () => {
    expect(() => buildPatientTimeline({ tenantId: '', patientId })).toThrow(ACTIVE_CLINIC_REQUIRED_FOR_TIMELINE);
    expect(() => buildPatientTimeline({ tenantId, patientId: '' })).toThrow(PATIENT_REQUIRED_FOR_TIMELINE);
  });

  it('omits source events with invalid timestamps instead of inventing now-based events', () => {
    const events = buildPatientTimeline({
      tenantId,
      patientId,
      findings: [finding({ createdAt: '' })],
      treatmentPlans: [plan({ createdAt: 'not-a-date' })],
      patientFiles: [patientFile({ createdAt: 'bad-date' })],
    });

    expect(events).toHaveLength(0);
  });

  it('filters built events by category, visibility, and archived flag', () => {
    const events = buildPatientTimeline({
      tenantId,
      patientId,
      findings: [finding(), finding({ id: 'archived-finding', status: 'archived' })],
      appointments: [appointment()],
      includeArchived: true,
    });

    expect(filterPatientTimelineEvents(events, { categories: ['finding'] })).toHaveLength(2);
    expect(filterPatientTimelineEvents(events, { visibility: ['admin'] })).toHaveLength(1);
    expect(filterPatientTimelineEvents(events, { includeArchived: false })).toHaveLength(2);
  });

  it('keeps patientId scoped for all supported source objects', () => {
    const otherPatient: Patient = {
      id: 'other-patient',
      fullName: 'Other Patient',
      phone: 'test-phone',
      source: 'phone',
      status: 'active',
      createdAt: '2026-01-01T09:00:00.000Z',
    };
    const otherComplaint: ChiefComplaint = {
      id: 'complaint-other',
      patientId: 'other-patient',
      text: 'Other complaint',
      relatedTeeth: [12],
      createdAt: '2026-01-01T10:00:00.000Z',
      updatedAt: '2026-01-01T10:00:00.000Z',
    };

    const events = buildPatientTimeline({
      tenantId,
      patientId,
      patient: otherPatient,
      chiefComplaint: otherComplaint,
      findings: [finding({ id: 'other-finding', patientId: 'other-patient' })],
      treatmentPlans: [plan({ id: 'other-plan', patientId: 'other-patient' })],
      appointments: [appointment({ id: 'other-appointment', patientId: 'other-patient' })],
      patientFiles: [patientFile({ id: 'other-file', patientId: 'other-patient' })],
    });

    expect(events).toHaveLength(0);
  });

  it('builds timeline events from activity_events without exposing raw audit payloads', () => {
    const events = buildPatientTimeline({
      tenantId,
      patientId,
      activityEvents: [activityEvent()],
    });

    expect(events).toHaveLength(1);
    expect(events[0]).toMatchObject({
      id: 'activity_event:activity-a:finding_note_added',
      category: 'finding',
      sourceType: 'finding',
      sourceId: 'finding-a',
      sourceStatus: 'discovered',
      activityEventId: 'activity-a',
      auditEventId: 'audit-a',
      actorUserId: 'doctor-a',
      visibility: 'clinical',
      title: 'Activity finding note added',
      description: 'Safe short description',
    });
    expect(events[0].title).not.toContain('secret');
    expect(events[0].description).not.toContain('before_data');
    expect(JSON.stringify(events[0])).not.toContain('do-not-render');
  });

  it('uses occurredAt for activity timeline date and falls back to createdAt only when needed', () => {
    const [event] = buildPatientTimeline({
      tenantId,
      patientId,
      activityEvents: [activityEvent({ occurredAt: '2026-01-08T10:00:00.000Z', createdAt: '2026-01-01T10:00:00.000Z' })],
    });
    expect(event.occurredAt).toBe('2026-01-08T10:00:00.000Z');

    const [fallbackEvent] = buildPatientTimeline({
      tenantId,
      patientId,
      activityEvents: [activityEvent({ id: 'activity-fallback', occurredAt: 'not-a-date', createdAt: '2026-01-09T10:00:00.000Z' })],
    });
    expect(fallbackEvent.occurredAt).toBe('2026-01-09T10:00:00.000Z');
  });

  it('keeps activity_events additive and sorts them with domain timeline events', () => {
    const events = buildPatientTimeline({
      tenantId,
      patientId,
      findings: [finding()],
      appointments: [appointment()],
      activityEvents: [activityEvent({ occurredAt: '2026-01-03T12:00:00.000Z' })],
    });

    expect(events.map((event) => event.sourceType)).toEqual(['appointment', 'finding', 'finding']);
    expect(events.some((event) => event.activityEventId === 'activity-a')).toBe(true);
    expect(events.some((event) => event.findingId === 'finding-a')).toBe(true);
  });

  it('excludes archived activity events by default and includes them when requested', () => {
    const archived = activityEvent({ id: 'activity-archived', isArchived: true });

    expect(buildPatientTimeline({ tenantId, patientId, activityEvents: [archived] })).toHaveLength(0);

    const events = buildPatientTimeline({ tenantId, patientId, activityEvents: [archived], includeArchived: true });
    expect(events).toHaveLength(1);
    expect(events[0]).toMatchObject({ isArchived: true, activityEventId: 'activity-archived' });
  });

  it('keeps activity_events scoped by tenantId and patientId', () => {
    const events = buildPatientTimeline({
      tenantId,
      patientId,
      activityEvents: [
        activityEvent({ id: 'activity-ok' }),
        activityEvent({ id: 'activity-other-tenant', tenantId: 'tenant-b' }),
        activityEvent({ id: 'activity-other-patient', patientId: 'patient-b' }),
        activityEvent({ id: 'activity-null-patient', patientId: null }),
      ],
    });

    expect(events).toHaveLength(1);
    expect(events[0].activityEventId).toBe('activity-ok');
  });

  it('maps every ActivityEventCategory to an explicit safe timeline category', () => {
    expect(ACTIVITY_TIMELINE_CATEGORY_MAP).toEqual({
      patient: 'patient',
      complaint: 'complaint',
      dental_chart: 'dental_chart',
      finding: 'finding',
      treatment_plan: 'treatment_plan',
      appointment: 'appointment',
      visit: 'appointment',
      encounter: 'appointment',
      completed_service: 'treatment_plan',
      file: 'file',
      document: 'file',
      payment: 'payment',
      stock: 'stock',
      audit: 'audit',
      system: 'audit',
    });

    const categories = Object.keys(ACTIVITY_TIMELINE_CATEGORY_MAP) as Array<keyof typeof ACTIVITY_TIMELINE_CATEGORY_MAP>;
    const events = buildPatientTimeline({
      tenantId,
      patientId,
      activityEvents: categories.map((category) => activityEvent({ id: `activity-${category}`, category })),
      includeArchived: true,
    });

    expect(events).toHaveLength(categories.length);
    expect(events.map((event) => event.category)).toEqual(
      expect.arrayContaining(['patient', 'complaint', 'dental_chart', 'finding', 'treatment_plan', 'appointment', 'file', 'payment', 'stock', 'audit']),
    );
  });

  it('keeps timeline filters working with activity-derived events', () => {
    const events = buildPatientTimeline({
      tenantId,
      patientId,
      activityEvents: [
        activityEvent({ id: 'activity-admin', category: 'patient', visibility: 'admin' }),
        activityEvent({ id: 'activity-payment', category: 'payment', visibility: 'financial' }),
      ],
    });

    expect(filterPatientTimelineEvents(events, { categories: ['payment'] }).map((event) => event.id)).toEqual([
      'activity_event:activity-payment:finding_note_added',
    ]);
    expect(filterPatientTimelineEvents(events, { visibility: ['admin'] }).map((event) => event.id)).toEqual([
      'activity_event:activity-admin:finding_note_added',
    ]);
  });

  it('does not require Supabase, localStorage, browser, or local database', () => {
    const events = buildPatientTimeline({ tenantId, patientId, findings: [finding()] });

    expect(events[0].sourceType).toBe('finding');
  });

  it('implements conservative role visibility rules', () => {
    const clinicalEvent = buildPatientTimeline({ tenantId, patientId, findings: [finding()] })[0];
    const adminEvent = buildPatientTimeline({ tenantId, patientId, appointments: [appointment()] })[0];
    const financialEvent: PatientTimelineEvent = {
      id: 'payment:p1:created',
      tenantId,
      patientId,
      occurredAt: '2026-01-08T10:00:00.000Z',
      category: 'payment',
      type: 'payment_created',
      title: 'Оплата',
      sourceType: 'payment',
      sourceId: 'p1',
      visibility: 'financial',
    };

    expect(canRoleSeePatientTimelineEvent('clinic_admin', financialEvent)).toBe(true);
    expect(canRoleSeePatientTimelineEvent('doctor', clinicalEvent)).toBe(true);
    expect(canRoleSeePatientTimelineEvent('doctor', adminEvent)).toBe(true);
    expect(canRoleSeePatientTimelineEvent('doctor', financialEvent)).toBe(false);
    expect(canRoleSeePatientTimelineEvent('registrar', clinicalEvent)).toBe(false);
    expect(canRoleSeePatientTimelineEvent('registrar', adminEvent)).toBe(true);
    expect(canRoleSeePatientTimelineEvent('cashier', financialEvent)).toBe(true);
    expect(canRoleSeePatientTimelineEvent('platform_admin', clinicalEvent)).toBe(false);
    expect(canRoleSeePatientTimelineEvent(null, clinicalEvent)).toBe(false);
  });
});
