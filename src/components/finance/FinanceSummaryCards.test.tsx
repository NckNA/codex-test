// @vitest-environment jsdom
(globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { PatientFinanceSummaryCard } from './PatientFinanceSummaryCard';
import { CashierPatientFinanceSummary } from '../cashier/CashierPatientFinanceSummary';
import type { PatientFinanceSummary } from '../../data/repositories/FinanceRepository';
import type { Patient } from '../../types';

const summary: PatientFinanceSummary = {
  tenantId: 'tenant-1',
  patientId: 'patient-1',
  asOf: '2026-07-11T00:00:00Z',
  modelVersion: 'finance-summary-v1',
  factComplete: true,
  currencies: [
    {
      currency: 'KZT', totalInvoiced: 1000, activeAllocatedAmount: 300, cashReceived: 1500,
      completedRefundAmount: 100, approvedWriteOffAmount: 0, currentDebt: 700,
      grossUnallocatedAmount: 1100, refundReservedAmount: 200, reservedDepositAmount: 300,
      availableCreditAmount: 600, netPositionAmount: 200, openInvoiceCount: 1,
      unpaidInvoiceCount: 1, partiallyPaidInvoiceCount: 1, lastPaymentAt: '2026-07-10T10:00:00Z',
    },
    {
      currency: 'USD', totalInvoiced: 0, activeAllocatedAmount: 0, cashReceived: 50,
      completedRefundAmount: 0, approvedWriteOffAmount: 0, currentDebt: 0,
      grossUnallocatedAmount: 50, refundReservedAmount: 0, reservedDepositAmount: 0,
      availableCreditAmount: 50, netPositionAmount: 50, openInvoiceCount: 0,
      unpaidInvoiceCount: 0, partiallyPaidInvoiceCount: 0, lastPaymentAt: '2026-07-09T10:00:00Z',
    },
  ],
  warnings: [{ code: 'MULTIPLE_CURRENCIES', currency: null, entityType: 'patient', entityId: 'patient-1', details: { currencyCount: 2 } }],
};
const patient = { id: 'patient-1', fullName: 'Тестовый пациент', phone: '+77000000000' } as Patient;

describe('finance summary cards', () => {
  let container: HTMLDivElement;
  let root: Root;
  beforeEach(() => {
    container = document.createElement('div');
    document.body.appendChild(container);
    root = createRoot(container);
  });
  afterEach(() => {
    act(() => root.unmount());
    container.remove();
  });

  it('renders separate patient currency buckets, authoritative metadata and warnings', () => {
    act(() => root.render(<PatientFinanceSummaryCard summary={summary} />));
    expect(container.querySelector('[data-testid="patient-finance-summary-currency-KZT"]')).not.toBeNull();
    expect(container.querySelector('[data-testid="patient-finance-summary-currency-USD"]')).not.toBeNull();
    expect(container.textContent).toContain('600 KZT');
    expect(container.textContent).toContain('50 USD');
    expect(container.textContent).toContain('finance-summary-v1');
    expect(container.querySelector('[data-testid="patient-finance-summary-warnings"]')).not.toBeNull();
  });

  it('renders separate cashier currency buckets and visible warnings', () => {
    act(() => root.render(<CashierPatientFinanceSummary patient={patient} summary={summary} />));
    expect(container.querySelector('[data-testid="cashier-summary-currency-KZT"]')).not.toBeNull();
    expect(container.querySelector('[data-testid="cashier-summary-currency-USD"]')).not.toBeNull();
    expect(container.textContent).toContain('Текущий долг');
    expect(container.textContent).toContain('Доступный кредит');
    expect(container.textContent).toContain('Резерв депозита');
    expect(container.textContent).toContain('300 KZT');
    expect(container.querySelector('[data-testid="cashier-summary-warnings"]')).not.toBeNull();
  });
});
