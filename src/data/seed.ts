import type { Patient, Doctor, Appointment } from '../types';

export const demoDoctors: Doctor[] = [
  { id: 'd1', fullName: 'Иванова Е.С.', specialization: 'Хирург-имплантолог', cabinet: 'Каб. 1', color: 'blue', active: true },
  { id: 'd2', fullName: 'Смирнов А.В.', specialization: 'Терапевт', cabinet: 'Каб. 2', color: 'indigo', active: true },
  { id: 'd3', fullName: 'Петров Д.Н.', specialization: 'Ортодонт', cabinet: 'Каб. 3', color: 'emerald', active: true },
  { id: 'd4', fullName: 'Сидорова О.П.', specialization: 'Гигиенист', cabinet: 'Каб. 4', color: 'purple', active: true },
  { id: 'd5', fullName: 'Кузнецов И.М.', specialization: 'Ортопед', cabinet: 'Каб. 5', color: 'amber', active: true },
  { id: 'd6', fullName: 'Попова А.А.', specialization: 'Детский стоматолог', cabinet: 'Каб. 1', color: 'pink', active: true },
  { id: 'd7', fullName: 'Лебедев В.К.', specialization: 'Терапевт', cabinet: 'Каб. 2', color: 'cyan', active: true },
  { id: 'd8', fullName: 'Морозова Н.И.', specialization: 'Пародонтолог', cabinet: 'Каб. 3', color: 'rose', active: true },
];

export const demoPatients: Patient[] = Array.from({ length: 20 }, (_, i) => ({
  balance: 0,
  bonusBalance: 0,
  id: `p${i + 1}`,
  fullName: [
    'Алексеев', 'Борисов', 'Васильев', 'Григорьев', 'Дмитриев',
    'Егоров', 'Жуков', 'Зайцев', 'Иванов', 'Крылов',
    'Лебедев', 'Макаров', 'Николаев', 'Орлов', 'Петров',
    'Романов', 'Смирнов', 'Тихонов', 'Ульянов', 'Федоров'
  ][i] + [' А.А.', ' Б.Б.', ' В.В.'][i % 3],
  phone: `+7 (999) 000-${String(1000 + i).padStart(4, '0')}`,
  source: ['phone', 'instagram', 'walk_in', 'referral'][i % 4] as 'phone' | 'instagram' | 'walk_in' | 'referral',
  status: 'active',
  createdAt: new Date().toISOString(),
}));

const todayStr = new Date().toISOString().split('T')[0];

export const demoAppointments: Appointment[] = [
  // Blocked slots
  {
    id: 'a1', doctorId: 'd1', cabinet: 'Каб. 1', service: 'Обед',
    start: `${todayStr}T13:00:00`, end: `${todayStr}T14:00:00`,
    status: 'blocked', createdAt: new Date().toISOString(),
  },
  {
    id: 'a2', doctorId: 'd2', cabinet: 'Каб. 2', service: 'Операция',
    start: `${todayStr}T10:00:00`, end: `${todayStr}T12:00:00`,
    status: 'blocked', createdAt: new Date().toISOString(),
  },
  {
    id: 'a_block1', doctorId: 'd3', cabinet: 'Каб. 3', service: 'Не записывать',
    start: `${todayStr}T15:00:00`, end: `${todayStr}T16:00:00`,
    status: 'blocked', createdAt: new Date().toISOString(),
  },
  {
    id: 'a_block2', doctorId: 'd4', cabinet: 'Каб. 4', service: 'Личное время',
    start: `${todayStr}T09:00:00`, end: `${todayStr}T10:00:00`,
    status: 'blocked', createdAt: new Date().toISOString(),
  },

  // Normal appointments
  {
    id: 'a3', patientId: 'p1', doctorId: 'd1', cabinet: 'Каб. 1',
    service: 'Консультация имплантолога', start: `${todayStr}T09:00:00`, end: `${todayStr}T10:00:00`,
    status: 'confirmed', paymentType: 'unpaid', source: 'phone', price: 2000,
    createdAt: new Date().toISOString(),
  },
  {
    id: 'a4', patientId: 'p2', doctorId: 'd3', cabinet: 'Каб. 3',
    service: 'Коррекция брекетов', start: `${todayStr}T11:30:00`, end: `${todayStr}T12:30:00`,
    status: 'arrived', paymentType: 'card', source: 'repeat', price: 5000,
    createdAt: new Date().toISOString(),
  },
  {
    id: 'a5', patientId: 'p3', doctorId: 'd4', cabinet: 'Каб. 4',
    service: 'Проф. гигиена', start: `${todayStr}T14:30:00`, end: `${todayStr}T15:30:00`,
    status: 'new', paymentType: 'unpaid', source: 'instagram', price: 4500,
    createdAt: new Date().toISOString(),
  },
  {
    id: 'a6', patientId: 'p4', doctorId: 'd5', cabinet: 'Каб. 5',
    service: 'Слепки', start: `${todayStr}T16:00:00`, end: `${todayStr}T16:30:00`,
    status: 'cancelled', paymentType: 'unpaid', source: 'phone', price: 0,
    createdAt: new Date().toISOString(),
  }
];
