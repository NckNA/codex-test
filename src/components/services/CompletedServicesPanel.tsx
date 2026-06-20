import { useMemo, useState } from 'react';
import type { FormEvent } from 'react';
import type {
  CompletedService,
  EncounterVisitRepository,
} from '../../data/repositories/EncounterVisitRepository';
import type { EncounterVisitRpcClient } from '../../data/repositories/EncounterVisitRpcClient';
import { useCompletedServices } from '../../data/hooks/useCompletedServices';
import { useCompletedServiceActions } from '../../data/hooks/useCompletedServiceActions';
import { CompletedServiceActions } from './CompletedServiceActions';
import { CompletedServiceStatusBadge } from './CompletedServiceStatusBadge';
import { formatCompletedServiceMoney } from './completedServiceLabels';
import { getCompletedServiceRoleCapabilities, type CompletedServiceUserRole } from './completedServicePermissions';

interface CompletedServicesPanelProps {
  tenantId?: string | null;
  patientId?: string | null;
  role?: CompletedServiceUserRole;
  repository?: EncounterVisitRepository;
  rpcClient?: EncounterVisitRpcClient;
}

function formatDateTime(value?: string | null) {
  if (!value) return '—';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '—';
  return date.toLocaleString('ru-RU', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

function safeMessage(error: unknown) {
  if (error instanceof Error) {
    const message = error.message.toLowerCase();
    if (message.includes('permission') || message.includes('denied') || message.includes('not allowed')) {
      return 'Недостаточно прав для выполненных услуг.';
    }
    if (message.includes('patient')) return 'Пациент не найден.';
    if (message.includes('clinic') || message.includes('tenant')) return 'Не выбрана клиника.';
  }
  return 'Не удалось обновить выполненную услугу. Попробуйте ещё раз.';
}

function sortServices(services: CompletedService[]) {
  return [...services].sort((left, right) => {
    const leftTime = Date.parse(left.performedAt || left.createdAt || '');
    const rightTime = Date.parse(right.performedAt || right.createdAt || '');
    return (Number.isNaN(rightTime) ? 0 : rightTime) - (Number.isNaN(leftTime) ? 0 : leftTime);
  });
}

function Field({ label, value }: { label: string; value?: string | number | null }) {
  return (
    <div>
      <dt className="text-xs font-medium uppercase tracking-wide text-slate-400">{label}</dt>
      <dd className="mt-1 text-sm text-slate-700">{value === undefined || value === null || value === '' ? '—' : value}</dd>
    </div>
  );
}

export function CompletedServicesPanel({ tenantId, patientId, role, repository, rpcClient }: CompletedServicesPanelProps) {
  const [serviceName, setServiceName] = useState('');
  const [serviceCode, setServiceCode] = useState('');
  const [toothNumber, setToothNumber] = useState('');
  const [toothSurface, setToothSurface] = useState('');
  const [quantity, setQuantity] = useState('1');
  const [unitPrice, setUnitPrice] = useState('');
  const [totalAmount, setTotalAmount] = useState('');
  const [currency, setCurrency] = useState('KZT');
  const [performedAt, setPerformedAt] = useState('');
  const [formError, setFormError] = useState<string | null>(null);

  const capabilities = useMemo(() => getCompletedServiceRoleCapabilities(role), [role]);

  const { services, isLoading, isError, error, refresh } = useCompletedServices({
    tenantId,
    patientId,
    includeVoided: true,
    repository,
    enabled: capabilities.canView,
  });

  const { actionLoading, error: actionError, recordService, voidService } = useCompletedServiceActions({
    tenantId,
    patientId,
    refresh,
    rpcClient,
  });

  const sortedServices = useMemo(() => sortServices(services), [services]);

  if (!tenantId) {
    return (
      <section data-testid="completed-services-no-tenant" className="rounded-2xl border border-amber-200 bg-amber-50 p-6 text-sm text-amber-800">
        Не выбрана клиника. Войдите в клинику, чтобы работать с выполненными услугами.
      </section>
    );
  }

  if (!patientId) {
    return (
      <section data-testid="completed-services-no-patient" className="rounded-2xl border border-slate-200 bg-white p-6 text-sm text-slate-600">
        Пациент не найден.
      </section>
    );
  }

  if (!capabilities.canView) {
    return (
      <section data-testid="completed-services-no-access" className="rounded-2xl border border-slate-200 bg-white p-6 text-sm text-slate-600">
        Недостаточно прав для просмотра выполненных услуг.
      </section>
    );
  }

  const parseOptionalNumber = (value: string) => {
    if (!value.trim()) return null;
    return Number(value);
  };

  const handleRecord = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setFormError(null);
    const parsedQuantity = Number(quantity);
    const parsedUnitPrice = parseOptionalNumber(unitPrice);
    const parsedTotalAmount = parseOptionalNumber(totalAmount);

    if (!serviceName.trim()) {
      setFormError('Название услуги обязательно.');
      return;
    }
    if (!Number.isFinite(parsedQuantity) || parsedQuantity <= 0) {
      setFormError('Количество должно быть больше 0.');
      return;
    }
    if ((parsedUnitPrice !== null && parsedUnitPrice < 0) || (parsedTotalAmount !== null && parsedTotalAmount < 0)) {
      setFormError('Сумма не может быть отрицательной.');
      return;
    }

    await recordService({
      serviceName,
      serviceCode,
      toothNumber,
      toothSurface,
      quantity: parsedQuantity,
      unitPrice: parsedUnitPrice,
      totalAmount: parsedTotalAmount,
      currency,
      performedAt: performedAt || null,
    });

    setServiceName('');
    setServiceCode('');
    setToothNumber('');
    setToothSurface('');
    setQuantity('1');
    setUnitPrice('');
    setTotalAmount('');
    setCurrency('KZT');
    setPerformedAt('');
  };

  return (
    <section data-testid="completed-services-panel" className="space-y-6">
      <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
        <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h2 className="text-xl font-semibold text-slate-900">Выполненные услуги</h2>
            <p className="mt-1 text-sm text-slate-500">
              Факт выполненной клинической или биллинговой услуги. Оплаты, склад и документы здесь не создаются.
            </p>
          </div>
        </div>

        {capabilities.canRecord && (
          <form data-testid="completed-service-create-form" onSubmit={handleRecord} className="mt-5 rounded-2xl border border-slate-100 bg-slate-50 p-4">
            <h3 className="text-sm font-semibold text-slate-800">Добавить выполненную услугу</h3>
            <div className="mt-4 grid gap-3 md:grid-cols-3">
              <label className="text-sm font-medium text-slate-700">
                Название услуги
                <input data-testid="completed-service-name-input" value={serviceName} onChange={(event) => setServiceName(event.target.value)} className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm" />
              </label>
              <label className="text-sm font-medium text-slate-700">
                Код
                <input data-testid="completed-service-code-input" value={serviceCode} onChange={(event) => setServiceCode(event.target.value)} className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm" />
              </label>
              <label className="text-sm font-medium text-slate-700">
                Количество
                <input data-testid="completed-service-quantity-input" type="number" min="0" step="0.01" value={quantity} onChange={(event) => setQuantity(event.target.value)} className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm" />
              </label>
              <label className="text-sm font-medium text-slate-700">
                Зуб
                <input data-testid="completed-service-tooth-input" value={toothNumber} onChange={(event) => setToothNumber(event.target.value)} className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm" />
              </label>
              <label className="text-sm font-medium text-slate-700">
                Поверхность
                <input data-testid="completed-service-surface-input" value={toothSurface} onChange={(event) => setToothSurface(event.target.value)} className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm" />
              </label>
              <label className="text-sm font-medium text-slate-700">
                Дата выполнения
                <input data-testid="completed-service-performed-at-input" type="datetime-local" value={performedAt} onChange={(event) => setPerformedAt(event.target.value)} className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm" />
              </label>
              <label className="text-sm font-medium text-slate-700">
                Цена
                <input data-testid="completed-service-unit-price-input" type="number" min="0" step="0.01" value={unitPrice} onChange={(event) => setUnitPrice(event.target.value)} className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm" />
              </label>
              <label className="text-sm font-medium text-slate-700">
                Сумма
                <input data-testid="completed-service-total-input" type="number" min="0" step="0.01" value={totalAmount} onChange={(event) => setTotalAmount(event.target.value)} className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm" />
              </label>
              <label className="text-sm font-medium text-slate-700">
                Валюта
                <input data-testid="completed-service-currency-input" value={currency} onChange={(event) => setCurrency(event.target.value)} className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm" />
              </label>
            </div>
            {(formError || actionError) && <p data-testid="completed-service-form-error" className="mt-3 text-sm font-medium text-rose-600">{formError || safeMessage(actionError)}</p>}
            <button type="submit" data-testid="completed-service-record-submit" disabled={actionLoading !== null} className="mt-4 rounded-lg bg-blue-600 px-4 py-2 text-sm font-semibold text-white hover:bg-blue-700 disabled:opacity-60">
              {actionLoading === 'record' ? 'Добавляем...' : 'Добавить выполненную услугу'}
            </button>
          </form>
        )}
      </div>

      {isLoading && <div data-testid="completed-services-loading" className="rounded-2xl border border-slate-200 bg-white p-6 text-sm text-slate-500">Загружаем выполненные услуги...</div>}

      {isError && <div data-testid="completed-services-error" className="rounded-2xl border border-rose-200 bg-rose-50 p-6 text-sm text-rose-700">{safeMessage(error)}</div>}

      {!isLoading && !isError && sortedServices.length === 0 && (
        <div data-testid="completed-services-empty" className="rounded-2xl border border-slate-200 bg-white p-6 text-sm text-slate-500">
          Выполненных услуг пока нет.
        </div>
      )}

      {!isLoading && !isError && sortedServices.length > 0 && (
        <div data-testid="completed-services-list" className="space-y-4">
          {sortedServices.map((service) => (
            <article key={service.id} data-testid={`completed-service-card-${service.id}`} className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
              <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                <div>
                  <div className="flex flex-wrap items-center gap-2">
                    <CompletedServiceStatusBadge status={service.status} />
                    <span className="text-sm font-semibold text-slate-900">{service.serviceName}</span>
                    {service.serviceCode && <span className="rounded-full bg-slate-100 px-2 py-1 text-xs text-slate-500">{service.serviceCode}</span>}
                  </div>
                  <p className="mt-2 text-sm text-slate-500">Выполнено: {formatDateTime(service.performedAt)}</p>
                </div>
                <div className="text-right text-sm font-semibold text-slate-800">{formatCompletedServiceMoney(service.totalAmount ?? service.unitPrice, service.currency)}</div>
              </div>

              <dl className="mt-4 grid gap-4 md:grid-cols-4">
                <Field label="Количество" value={service.quantity} />
                <Field label="Зуб" value={service.toothNumber} />
                <Field label="Поверхность" value={service.toothSurface} />
                <Field label="Исполнитель" value={service.performedBy} />
                <Field label="Визит" value={service.visitId} />
                <Field label="Приём" value={service.encounterId} />
                <Field label="План" value={service.treatmentPlanId} />
                <Field label="Этап" value={service.treatmentStageId} />
                <Field label="Справочник" value={service.clinicalDictionaryItemId} />
                {service.status === 'voided' && <Field label="Причина аннулирования" value={service.correctionReason} />}
                {service.voidedAt && <Field label="Аннулирована" value={formatDateTime(service.voidedAt)} />}
              </dl>

              <CompletedServiceActions service={service} role={role} actionLoading={actionLoading} onVoid={voidService} />
            </article>
          ))}
        </div>
      )}
    </section>
  );
}
