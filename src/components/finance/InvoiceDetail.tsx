import { useMemo, useState, type FormEvent } from 'react';
import type { CompletedServiceBillingEligibility, FinanceRepository, Invoice, InvoiceItem } from '../../data/repositories/FinanceRepository';
import type { FinanceRpcClient } from '../../data/repositories/FinanceRpcClient';
import type { FinanceActionName } from '../../data/hooks/useFinanceActions';
import { FinanceStatusBadge } from './FinanceStatusBadge';
import { formatFinanceMoney, shortFinanceId } from './financeLabels';
import type { FinanceUserRole } from './financePermissions';
import { WriteOffActions } from './WriteOffActions';

interface InvoiceDetailProps {
  tenantId?: string | null;
  invoice: Invoice | null;
  items: InvoiceItem[];
  completedServiceBillingEligibility: CompletedServiceBillingEligibility[];
  role?: FinanceUserRole;
  repository?: FinanceRepository;
  rpcClient?: FinanceRpcClient;
  canAddItem: boolean;
  actionLoading: FinanceActionName | null;
  onChanged?: () => Promise<void> | void;
  onAddItem: (input: {
    invoiceId: string;
    serviceName: string;
    quantity: number;
    unitPrice: number;
    discountAmount?: number;
    adjustmentAmount?: number;
    completedServiceId?: string | null;
    serviceCode?: string | null;
    toothNumber?: string | null;
    toothSurface?: string | null;
    notes?: string | null;
  }) => Promise<void>;
}

function ItemField({ label, value }: { label: string; value?: string | number | null }) {
  return (
    <div>
      <dt className="text-xs font-medium uppercase tracking-wide text-slate-400">{label}</dt>
      <dd className="mt-1 text-sm text-slate-700">{value === undefined || value === null || value === '' ? '—' : value}</dd>
    </div>
  );
}

function parseOptionalAmount(value: string) {
  if (!value.trim()) return undefined;
  return Number(value);
}

export function InvoiceDetail({ tenantId, invoice, items, completedServiceBillingEligibility, role, repository, rpcClient, canAddItem, actionLoading, onChanged, onAddItem }: InvoiceDetailProps) {
  const [serviceName, setServiceName] = useState('');
  const [serviceCode, setServiceCode] = useState('');
  const [completedServiceId, setCompletedServiceId] = useState('');
  const [toothNumber, setToothNumber] = useState('');
  const [toothSurface, setToothSurface] = useState('');
  const [quantity, setQuantity] = useState('1');
  const [unitPrice, setUnitPrice] = useState('');
  const [discountAmount, setDiscountAmount] = useState('');
  const [adjustmentAmount, setAdjustmentAmount] = useState('');
  const [notes, setNotes] = useState('');
  const [formError, setFormError] = useState<string | null>(null);

  const invoiceItems = useMemo(() => (invoice ? items.filter((item) => item.invoiceId === invoice.id) : []), [invoice, items]);
  const completedServiceById = useMemo(() => new Map(completedServiceBillingEligibility.map((service) => [service.completedServiceId, service])), [completedServiceBillingEligibility]);
  const canUseForm = Boolean(invoice && canAddItem && ['draft', 'issued'].includes(invoice.status));
  const invoiceCurrency = invoice?.currency ?? 'KZT';

  const resetForm = () => {
    setServiceName('');
    setServiceCode('');
    setCompletedServiceId('');
    setToothNumber('');
    setToothSurface('');
    setQuantity('1');
    setUnitPrice('');
    setDiscountAmount('');
    setAdjustmentAmount('');
    setNotes('');
  };

  const handleCompletedServiceChange = (nextId: string) => {
    setCompletedServiceId(nextId);
    const service = completedServiceById.get(nextId);
    if (!service || service.billingState !== 'unbilled') return;
    setServiceName(service.serviceName);
    setServiceCode(service.serviceCode ?? '');
    setToothNumber(service.toothNumber ?? '');
    setToothSurface(service.toothSurface ?? '');
    setQuantity(String(service.quantity));
    setUnitPrice(service.unitPrice === null ? '' : String(service.unitPrice));
  };

  const handleAddItem = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setFormError(null);
    if (!invoice) { setFormError('Счёт не выбран.'); return; }
    const parsedQuantity = Number(quantity);
    const parsedUnitPrice = Number(unitPrice);
    const parsedDiscount = parseOptionalAmount(discountAmount);
    const parsedAdjustment = parseOptionalAmount(adjustmentAmount);
    if (!serviceName.trim()) { setFormError('Название услуги обязательно.'); return; }
    if (!Number.isFinite(parsedQuantity) || parsedQuantity <= 0) { setFormError('Количество должно быть больше 0.'); return; }
    if (!Number.isFinite(parsedUnitPrice) || parsedUnitPrice <= 0) { setFormError('Сумма должна быть больше 0.'); return; }
    if ((parsedDiscount !== undefined && (!Number.isFinite(parsedDiscount) || parsedDiscount < 0)) || (parsedAdjustment !== undefined && (!Number.isFinite(parsedAdjustment) || parsedAdjustment < 0))) {
      setFormError('Сумма не может быть отрицательной.');
      return;
    }
    try {
      await onAddItem({
        invoiceId: invoice.id,
        serviceName,
        quantity: parsedQuantity,
        unitPrice: parsedUnitPrice,
        discountAmount: parsedDiscount,
        adjustmentAmount: parsedAdjustment,
        completedServiceId,
        serviceCode,
        toothNumber,
        toothSurface,
        notes,
      });
      resetForm();
    } catch (error) {
      setFormError(error instanceof Error ? error.message : 'Не удалось выполнить финансовую операцию.');
    }
  };

  return (
    <section data-testid="finance-invoice-detail" className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
      <h3 className="text-lg font-semibold text-slate-900">Позиции счёта</h3>
      {!invoice && <p data-testid="finance-invoice-not-selected" className="mt-4 text-sm text-slate-500">Счёт не выбран.</p>}
      {invoice && <p className="mt-1 text-sm text-slate-500">{invoice.invoiceNumber || `Счёт ${shortFinanceId(invoice.id)}`}</p>}

      {canUseForm && (
        <form data-testid="finance-add-item-form" onSubmit={handleAddItem} className="mt-5 rounded-2xl border border-slate-100 bg-slate-50 p-4">
          <h4 className="text-sm font-semibold text-slate-800">Добавить позицию</h4>
          <div className="mt-4 grid gap-3 md:grid-cols-3">
            <label className="text-sm font-medium text-slate-700">Название услуги<input data-testid="finance-item-service-name" value={serviceName} onChange={(event) => setServiceName(event.target.value)} className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm" /></label>
            <label className="text-sm font-medium text-slate-700">Количество<input data-testid="finance-item-quantity" type="number" min="0" step="0.01" value={quantity} onChange={(event) => setQuantity(event.target.value)} className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm" /></label>
            <label className="text-sm font-medium text-slate-700">Цена<input data-testid="finance-item-unit-price" type="number" min="0" step="0.01" value={unitPrice} onChange={(event) => setUnitPrice(event.target.value)} className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm" /></label>
            <label className="text-sm font-medium text-slate-700">Код<input data-testid="finance-item-service-code" value={serviceCode} onChange={(event) => setServiceCode(event.target.value)} className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm" /></label>
            <label className="text-sm font-medium text-slate-700">Выполненная услуга
              <select data-testid="finance-completed-service-select" value={completedServiceId} onChange={(event) => handleCompletedServiceChange(event.target.value)} className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm">
                <option value="">Ручная позиция (без выполненной услуги)</option>
                {completedServiceBillingEligibility.map((service) => {
                  const billingDetail = service.billingState === 'billed'
                    ? ` — Уже включено в счёт${service.invoiceNumber ? ` №${service.invoiceNumber}` : ''}`
                    : service.billingState === 'unavailable' ? ' — Недоступно' : '';
                  return <option key={service.completedServiceId} value={service.completedServiceId} disabled={service.billingState !== 'unbilled'}>{service.serviceName}{billingDetail}</option>;
                })}
              </select>
            </label>
            <label className="text-sm font-medium text-slate-700">Зуб<input data-testid="finance-item-tooth-number" value={toothNumber} onChange={(event) => setToothNumber(event.target.value)} className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm" /></label>
            <label className="text-sm font-medium text-slate-700">Поверхность<input data-testid="finance-item-tooth-surface" value={toothSurface} onChange={(event) => setToothSurface(event.target.value)} className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm" /></label>
            <label className="text-sm font-medium text-slate-700">Скидка<input type="number" min="0" step="0.01" value={discountAmount} onChange={(event) => setDiscountAmount(event.target.value)} className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm" /></label>
            <label className="text-sm font-medium text-slate-700">Корректировка<input type="number" min="0" step="0.01" value={adjustmentAmount} onChange={(event) => setAdjustmentAmount(event.target.value)} className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm" /></label>
            <label className="text-sm font-medium text-slate-700 md:col-span-3">Примечание<input value={notes} onChange={(event) => setNotes(event.target.value)} className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm" /></label>
          </div>
          {formError && <p data-testid="finance-item-form-error" className="mt-3 text-sm font-medium text-rose-600">{formError}</p>}
          <button type="submit" data-testid="finance-add-item-submit" disabled={actionLoading !== null} className="mt-4 rounded-lg bg-blue-600 px-4 py-2 text-sm font-semibold text-white hover:bg-blue-700 disabled:opacity-60">
            {actionLoading === 'addInvoiceItem' ? 'Добавляем...' : 'Добавить позицию'}
          </button>
        </form>
      )}

      {invoice && invoiceItems.length === 0 && <p data-testid="finance-items-empty" className="mt-4 text-sm text-slate-500">Позиций пока нет.</p>}
      <div className="mt-4 space-y-3">
        {invoiceItems.map((item) => (
          <article key={item.id} data-testid={`finance-invoice-item-${item.id}`} className="rounded-2xl border border-slate-200 p-4">
            <div className="flex flex-wrap items-center gap-2">
              <FinanceStatusBadge kind="invoiceItem" status={item.status} />
              <span className="text-sm font-semibold text-slate-900">{item.serviceName}</span>
              {item.serviceCode && <span className="rounded-full bg-slate-100 px-2 py-1 text-xs text-slate-500">{item.serviceCode}</span>}
            </div>
            <dl className="mt-4 grid gap-4 md:grid-cols-4">
              <ItemField label="ID услуги" value={item.completedServiceId ? shortFinanceId(item.completedServiceId) : null} />
              <ItemField label="Зуб" value={item.toothNumber} />
              <ItemField label="Поверхность" value={item.toothSurface} />
              <ItemField label="Количество" value={item.quantity} />
              <ItemField label="Цена" value={formatFinanceMoney(item.unitPrice, invoiceCurrency)} />
              <ItemField label="Скидка" value={formatFinanceMoney(item.discountAmount, invoiceCurrency)} />
              <ItemField label="Корректировка" value={formatFinanceMoney(item.adjustmentAmount, invoiceCurrency)} />
              <ItemField label="Итого" value={formatFinanceMoney(item.totalAmount, invoiceCurrency)} />
            </dl>
          </article>
        ))}
      </div>
      {invoice && <WriteOffActions tenantId={tenantId} invoiceId={invoice.id} role={role} repository={repository} rpcClient={rpcClient} onChanged={onChanged} />}
    </section>
  );
}
