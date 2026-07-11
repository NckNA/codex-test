// @vitest-environment jsdom
(globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type {
  FinanceRepository,
  Invoice,
  PatientFinanceSummary,
  PatientFundReservation,
  Payment,
  PaymentFundCapacity,
} from '../../data/repositories/FinanceRepository';
import type { FinanceRpcClient } from '../../data/repositories/FinanceRpcClient';
import { PatientFundReservationsPanel } from './PatientFundReservationsPanel';

vi.mock('../../lib/supabaseClient', () => ({ supabase: {}, isSupabaseConfigured: true }));

const tenantId = 'tenant-1';
const patientId = 'patient-1';
const payment = { id: 'payment-1', tenantId, patientId, status: 'received', paymentMethod: 'cash', amount: 1000, currency: 'KZT', receivedAt: '2026-07-11T00:00:00Z', updatedAt: '2026-07-11T00:00:00Z' } as Payment;
const capacity = { paymentId: payment.id, patientId, currency: 'KZT', paymentAmount: 1000, activeAllocatedAmount: 0, completedRefundAmount: 0, refundReservedAmount: 100, reservedDepositAmount: 300, grossUnallocatedAmount: 1000, availableCreditAmount: 600 } as PaymentFundCapacity;
const invoice = { id: 'invoice-1', tenantId, patientId, invoiceNumber: 'INV-1', status: 'issued', currency: 'KZT', balanceAmount: 500 } as Invoice;
const summary = {
  tenantId, patientId, asOf: '2026-07-11T00:00:00Z', modelVersion: 'finance-summary-v2', factComplete: true,
  currencies: [{ currency: 'KZT', totalInvoiced: 500, activeAllocatedAmount: 0, cashReceived: 1000, completedRefundAmount: 0, approvedWriteOffAmount: 0, currentDebt: 500, grossUnallocatedAmount: 1000, refundReservedAmount: 100, reservedDepositAmount: 300, availableCreditAmount: 600, netPositionAmount: 100, openInvoiceCount: 1, unpaidInvoiceCount: 1, partiallyPaidInvoiceCount: 0, lastPaymentAt: payment.receivedAt }], warnings: [],
} as PatientFinanceSummary;

function reservation(status: PatientFundReservation['status'], id: string = status): PatientFundReservation {
  const active = status === 'active' || status === 'partially_used';
  return {
    id, tenantId, patientId, paymentId: payment.id, currency: 'KZT',
    purposeType: id === 'other' ? 'other' : id === 'service' ? 'service' : 'general',
    purposeLabel: id === 'other' ? 'Ортопедия' : id === 'service' ? 'Имплантация' : null,
    appointmentId: null, treatmentPlanId: null, originalAmount: 300,
    consumedAmount: status === 'partially_used' ? 100 : status === 'fully_used' ? 300 : 0,
    releasedAmount: status === 'released' ? 300 : 0,
    remainingAmount: active ? (status === 'partially_used' ? 200 : 300) : 0,
    status, expiresAt: null, notes: id === 'other' ? 'Комментарий' : null,
    createdAt: '2026-07-11T00:00:00Z', updatedAt: null,
    releasedAt: status === 'released' ? '2026-07-11T01:00:00Z' : null, archivedAt: status === 'archived' ? '2026-07-11T02:00:00Z' : null,
  };
}

function repository(rows: PatientFundReservation[] = []): FinanceRepository {
  return {
    getPatientFundReservations: vi.fn().mockResolvedValue(rows),
    getPaymentFundCapacity: vi.fn().mockResolvedValue(capacity),
    listPaymentAllocations: vi.fn().mockResolvedValue([]),
  } as unknown as FinanceRepository;
}

function client(): FinanceRpcClient {
  return {
    createPatientFundReservation: vi.fn(),
    releasePatientFundReservation: vi.fn(),
    allocateReservedCredit: vi.fn(),
  } as unknown as FinanceRpcClient;
}

async function flush() {
  await act(async () => { await new Promise((resolve) => setTimeout(resolve, 0)); });
}

describe('PatientFundReservationsPanel', () => {
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
    vi.restoreAllMocks();
  });

  async function render(overrides: Partial<React.ComponentProps<typeof PatientFundReservationsPanel>> = {}) {
    const repo = overrides.repository ?? repository();
    const rpc = overrides.rpcClient ?? client();
    const props: React.ComponentProps<typeof PatientFundReservationsPanel> = {
      tenantId,
      patientId,
      role: 'clinic_admin',
      summary,
      payments: [payment],
      invoices: [invoice],
      repository: repo,
      rpcClient: rpc,
      onChanged: vi.fn(),
      ...overrides,
    };
    await act(async () => { root.render(<PatientFundReservationsPanel {...props} />); });
    await flush();
    return { props, repo, rpc };
  }

  it('renders separated credit, deposit, refund reserve, received money and debt totals', async () => {
    await render();
    const text = container.textContent ?? '';
    expect(text).toContain('Кредит и депозиты');
    expect(text).toContain('Доступный кредит');
    expect(text).toContain('Зарезервировано как депозит');
    expect(text).toContain('Зарезервировано под возврат');
    expect(text).toContain('Получено денег');
    expect(text).toContain('Долг');
    expect(text).toContain('Не распределено до резервов');
    expect(text).not.toContain('Баланс');
  });

  it('renders empty state and disables create when no credit exists', async () => {
    const repo = repository([]);
    vi.mocked(repo.getPaymentFundCapacity).mockResolvedValue({ ...capacity, availableCreditAmount: 0 });
    await render({ repository: repo });
    expect(container.querySelector('[data-testid="fund-reservation-empty"]')?.textContent).toContain('пока нет депозитов');
    expect(container.querySelector<HTMLButtonElement>('[data-testid="fund-reservation-create-open"]')?.disabled).toBe(true);
  });

  it('renders all lifecycle statuses, purpose labels and amounts without internal metadata', async () => {
    const rows = [
      reservation('active'), reservation('partially_used'), reservation('fully_used'),
      reservation('released'), reservation('refunded'), reservation('archived'), reservation('active', 'other'), reservation('active', 'service'),
    ];
    await render({ repository: repository(rows) });
    const text = container.textContent ?? '';
    for (const label of ['Активен', 'Частично использован', 'Использован полностью', 'Освобождён', 'Возвращён', 'Архив', 'Ортопедия', 'Имплантация']) {
      expect(text).toContain(label);
    }
    expect(text).toContain('Исходная сумма');
    expect(text).toContain('Использовано');
    expect(text).toContain('Освобождено');
    expect(text).toContain('Осталось');
    expect(text).not.toContain('idempotency');
    expect(text).not.toContain('metadata');
  });

  it('admin has create release and use actions while terminal cards have none', async () => {
    const rows = [reservation('active'), reservation('fully_used')];
    await render({ repository: repository(rows), role: 'clinic_admin' });
    expect(container.querySelector('[data-testid="fund-reservation-create-open"]')).not.toBeNull();
    expect(container.querySelector('[data-testid="fund-reservation-release-active"]')).not.toBeNull();
    expect(container.querySelector('[data-testid="fund-reservation-use-active"]')).not.toBeNull();
    expect(container.querySelector('[data-testid="fund-reservation-release-fully_used"]')).toBeNull();
    expect(container.querySelector('[data-testid="fund-reservation-use-fully_used"]')).toBeNull();
  });

  it('cashier can create and use but cannot release', async () => {
    await render({ repository: repository([reservation('active')]), role: 'cashier' });
    expect(container.querySelector('[data-testid="fund-reservation-create-open"]')).not.toBeNull();
    expect(container.querySelector('[data-testid="fund-reservation-use-active"]')).not.toBeNull();
    expect(container.querySelector('[data-testid="fund-reservation-release-active"]')).toBeNull();
  });

  it('doctor and registrar see only a deposit indicator and never fetch reservations', async () => {
    const repo = repository([reservation('active')]);
    await render({ repository: repo, role: 'doctor' });
    expect(repo.getPatientFundReservations).not.toHaveBeenCalled();
    expect(container.querySelector('[data-testid="fund-reservation-readonly-indicator"]')?.textContent).toContain('Депозит внесён');
    expect(container.querySelector('[data-testid="fund-reservation-create-open"]')).toBeNull();
    await render({ repository: repo, role: 'registrar' });
    expect(container.querySelector('[data-testid="fund-reservation-readonly-indicator"]')).not.toBeNull();
  });

  it('unknown role and no-tenant context render no data or actions', async () => {
    await render({ role: 'unknown' });
    expect(container.querySelector('[data-testid="patient-fund-reservations-panel"]')).toBeNull();
    await render({ tenantId: null, role: 'clinic_admin' });
    expect(container.querySelector('[data-testid="patient-fund-reservations-panel"]')).toBeNull();
  });

  it('filters active, used and released reservations', async () => {
    await render({ repository: repository([reservation('active'), reservation('partially_used'), reservation('fully_used'), reservation('released')]) });
    await act(async () => { container.querySelector<HTMLButtonElement>('[data-testid="fund-reservation-filter-released"]')?.click(); });
    expect(container.querySelector('[data-testid="fund-reservation-card-released"]')).not.toBeNull();
    expect(container.querySelector('[data-testid="fund-reservation-card-active"]')).toBeNull();
    await act(async () => { container.querySelector<HTMLButtonElement>('[data-testid="fund-reservation-filter-used"]')?.click(); });
    expect(container.querySelector('[data-testid="fund-reservation-card-partially_used"]')).not.toBeNull();
    expect(container.querySelector('[data-testid="fund-reservation-card-fully_used"]')).not.toBeNull();
  });

  it('opens create dialog and closes it on patient context change', async () => {
    const repo = repository([]);
    const { props } = await render({ repository: repo });
    await act(async () => { container.querySelector<HTMLButtonElement>('[data-testid="fund-reservation-create-open"]')?.click(); });
    expect(container.querySelector('[data-testid="create-fund-reservation-dialog"]')).not.toBeNull();
    await act(async () => { root.render(<PatientFundReservationsPanel {...props} patientId="patient-2" />); });
    await flush();
    expect(container.querySelector('[data-testid="create-fund-reservation-dialog"]')).toBeNull();
  });

  it('never displays raw SQL/PostgREST errors', async () => {
    const repo = repository([]);
    vi.mocked(repo.getPatientFundReservations).mockRejectedValue({ code: 'XX000', message: 'trigger private_finance failed' });
    await render({ repository: repo });
    expect(container.textContent).toContain('Не удалось загрузить кредит и депозиты пациента.');
    expect(container.textContent).not.toContain('trigger');
    expect(container.textContent).not.toContain('XX000');
  });
});
