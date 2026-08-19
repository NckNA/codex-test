import { useState } from 'react';
import { ClipboardList, Package, Pencil, Plus, RotateCcw, CheckCircle2 } from 'lucide-react';
import { usePatientLaboratoryWorkOrders } from '../../../data/hooks/usePatientLaboratoryWorkOrders';
import { usePatientLaboratoryWorkReferences } from '../../../data/hooks/usePatientLaboratoryWorkReferences';
import { useLaboratoryWorkMutations } from '../../../data/hooks/useLaboratoryWorkMutations';
import type { LaboratoryAnatomicalScope, LaboratoryWorkOrderRecord } from '../../../data/repositories/LaboratoryWorkRepository';
import { formatInstantInTenant } from '../../../domain/timezone';
import { LaboratoryWorkOrderDialog, type LaboratoryWorkOrderDialogSubmit } from './LaboratoryWorkOrderDialog';
import { LaboratoryWorkCompleteDialog, LaboratoryWorkReopenDialog } from './LaboratoryWorkLifecycleDialogs';
import { getLaboratoryWorkRoleCapabilities, type LaboratoryWorkUserRole } from './laboratoryWorkPermissions';

interface PatientLaboratoryWorkTabProps {
  patientId: string;
  timezone: string;
  role?: LaboratoryWorkUserRole;
}

const STATUS_LABELS: Record<LaboratoryWorkOrderRecord['status'], string> = { in_progress: 'В работе', completed: 'Завершена' };
const STATUS_CLASS_NAMES: Record<LaboratoryWorkOrderRecord['status'], string> = { in_progress: 'bg-amber-100 text-amber-700', completed: 'bg-emerald-100 text-emerald-700' };
const ANATOMY_LABELS: Record<LaboratoryAnatomicalScope, string> = { upper_jaw: 'Верхняя челюсть', lower_jaw: 'Нижняя челюсть', oral_cavity: 'Полость рта', selected_teeth: 'Выбранные зубы' };

function formatTimestamp(value: string, timezone: string): string {
  return formatInstantInTenant(value, timezone, { dateStyle: 'medium', timeStyle: 'short' });
}

function formatAnatomy(order: LaboratoryWorkOrderRecord): string | null {
  const scopeLabel = order.anatomicalScope ? ANATOMY_LABELS[order.anatomicalScope] : null;
  const teeth = order.selectedTeeth.length > 0 ? order.selectedTeeth.join(', ') : null;
  if (scopeLabel === ANATOMY_LABELS.selected_teeth && teeth) return `${scopeLabel}: ${teeth}`;
  if (scopeLabel && teeth) return `${scopeLabel}; зубы: ${teeth}`;
  if (scopeLabel) return scopeLabel;
  if (teeth) return `Зубы: ${teeth}`;
  return null;
}

function OrderDetail({ label, value }: { label: string; value: string }) {
  return <div><dt className="text-xs font-medium uppercase tracking-wide text-slate-400">{label}</dt><dd className="mt-1 text-sm text-slate-700">{value}</dd></div>;
}

function hasValidVersion(order: LaboratoryWorkOrderRecord) {
  return Number.isInteger(order.mutationVersion) && (order.mutationVersion ?? 0) > 0;
}

export function PatientLaboratoryWorkTab({ patientId, timezone, role }: PatientLaboratoryWorkTabProps) {
  const capabilities = getLaboratoryWorkRoleCapabilities(role);
  const { orders, isLoading, isError, refetch } = usePatientLaboratoryWorkOrders(patientId);
  const { referencesByOrderId, isLoading: areReferencesLoading, isError: areReferencesError, refetch: refetchReferences } = usePatientLaboratoryWorkReferences(orders);
  const mutations = useLaboratoryWorkMutations({ refresh: refetch });
  const [dialog, setDialog] = useState<{ type: 'create' } | { type: 'edit' | 'complete' | 'reopen'; order: LaboratoryWorkOrderRecord } | null>(null);

  if (!capabilities.canView) {
    return <div data-testid="patient-laboratory-no-access" className="rounded-xl border border-slate-200 bg-white p-6 text-sm text-slate-600">Недостаточно прав для лабораторных работ.</div>;
  }

  const handleFormSubmit = async (submission: LaboratoryWorkOrderDialogSubmit) => {
    if (submission.mode === 'create') await mutations.createOrder(submission.input);
    else await mutations.updateOrder(submission.input);
    setDialog(null);
  };

  const handleComplete = async (order: LaboratoryWorkOrderRecord) => {
    if (!hasValidVersion(order)) return;
    try {
      await mutations.completeOrder({ orderId: order.id, expectedVersion: order.mutationVersion! });
      setDialog(null);
    } catch {
      // Hook exposes a bounded semantic error and canonical refresh state.
    }
  };

  const handleReopen = async (order: LaboratoryWorkOrderRecord, reason: string) => {
    if (!hasValidVersion(order)) return;
    try {
      await mutations.reopenOrder({ orderId: order.id, expectedVersion: order.mutationVersion!, reason });
      setDialog(null);
    } catch {
      // Hook exposes a bounded semantic error and canonical refresh state.
    }
  };

  return (
    <div className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm" data-testid="patient-laboratory-work-tab">
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-200 bg-slate-50/50 p-4">
        <h3 className="flex items-center gap-2 font-semibold text-slate-800"><Package className="h-4 w-4 text-slate-400" />Лабораторные работы</h3>
        <div className="flex items-center gap-2">
          <span className="rounded-full bg-slate-200 px-2 py-1 text-xs font-medium text-slate-600">Всего: {orders.length}</span>
          {capabilities.canCreate && mutations.available && <button type="button" data-testid="laboratory-create-button" onClick={() => setDialog({ type: 'create' })} className="inline-flex items-center gap-1.5 rounded-lg bg-blue-600 px-3 py-2 text-sm font-semibold text-white"><Plus className="h-4 w-4" />Новая работа</button>}
        </div>
      </div>

      {capabilities.canCreate && !mutations.available && <div data-testid="laboratory-mutations-unavailable" className="border-b border-amber-200 bg-amber-50 px-5 py-3 text-sm text-amber-800">Изменения доступны только в активной клинике с серверным подключением.</div>}
      {mutations.error && <div data-testid="laboratory-mutation-error" className="border-b border-red-200 bg-red-50 px-5 py-3 text-sm text-red-700">{mutations.error.message}</div>}
      {mutations.refreshWarning && <div data-testid="laboratory-refresh-warning" className="border-b border-amber-200 bg-amber-50 px-5 py-3 text-sm text-amber-800">{mutations.refreshWarning}</div>}
      {mutations.pendingRetryAction && <div data-testid="laboratory-uncertain-warning" className="flex flex-wrap items-center justify-between gap-3 border-b border-orange-200 bg-orange-50 px-5 py-3 text-sm text-orange-900"><span><strong>Результат операции пока не подтверждён.</strong> Не создавайте новую операцию.</span><button type="button" data-testid="laboratory-retry-pending" disabled={mutations.loading} onClick={() => void mutations.retryPendingMutation().catch(() => undefined)} className="rounded-lg border border-orange-300 bg-white px-3 py-1.5 font-medium">Повторить ту же операцию</button></div>}

      {isLoading ? (
        <div className="p-8 text-center text-slate-500" data-testid="laboratory-work-loading">Загрузка лабораторных работ...</div>
      ) : isError ? (
        <div className="p-8 text-center" data-testid="laboratory-work-error"><p className="text-red-600">Не удалось загрузить лабораторные работы пациента.</p><button type="button" onClick={() => refetch()} className="mt-4 rounded-lg border border-red-200 bg-white px-3 py-1.5 text-sm font-medium text-red-700">Повторить</button></div>
      ) : orders.length === 0 ? (
        <div className="p-8 text-center text-slate-500" data-testid="laboratory-work-empty"><ClipboardList className="mx-auto mb-3 h-12 w-12 text-slate-300" /><p>У пациента нет лабораторных работ.</p></div>
      ) : (
        <>
          {areReferencesLoading && <div className="border-b border-blue-100 bg-blue-50 px-5 py-3 text-sm text-blue-700" data-testid="laboratory-reference-loading">Загружаются данные врача, лаборатории и видов работ...</div>}
          {areReferencesError && <div className="flex items-center justify-between gap-4 border-b border-amber-200 bg-amber-50 px-5 py-3 text-sm text-amber-800" data-testid="laboratory-reference-error"><span>Лабораторные работы загружены, но не удалось получить названия справочных данных.</span><button type="button" onClick={() => refetchReferences()} className="shrink-0 rounded-lg border border-amber-300 bg-white px-3 py-1.5 text-xs font-medium">Повторить</button></div>}
          <div className="divide-y divide-slate-100">
            {orders.map((order) => {
              const anatomy = formatAnatomy(order);
              const references = referencesByOrderId[order.id];
              const validVersion = hasValidVersion(order);
              const canEdit = mutations.available && capabilities.canEdit && order.status === 'in_progress' && validVersion;
              const canComplete = mutations.available && capabilities.canComplete && order.status === 'in_progress' && validVersion;
              const canReopen = mutations.available && capabilities.canReopen && order.status === 'completed' && validVersion;
              return (
                <article key={order.id} className="p-5" data-testid={`laboratory-work-order-${order.id}`}>
                  <div className="flex flex-col justify-between gap-3 sm:flex-row sm:items-start">
                    <div><div className="flex flex-wrap items-center gap-2"><h4 className="font-semibold text-slate-800">{order.title}</h4>{order.orderNumber && <span className="text-xs font-medium text-slate-500">№ {order.orderNumber}</span>}</div><p className="mt-1 text-xs text-slate-400">Обновлено: {formatTimestamp(order.updatedAt, timezone)}</p></div>
                    <span className={`w-fit rounded-full px-2.5 py-1 text-xs font-semibold ${STATUS_CLASS_NAMES[order.status]}`} data-testid={`laboratory-work-status-${order.id}`}>{STATUS_LABELS[order.status]}</span>
                  </div>
                  <dl className="mt-4 grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
                    {references?.responsibleDoctorName && <OrderDetail label="Ответственный врач" value={references.responsibleDoctorName} />}
                    {references?.laboratoryName && <OrderDetail label="Лаборатория" value={references.laboratoryName} />}
                    {references && references.workTypeNames.length > 0 && <OrderDetail label="Виды работ" value={references.workTypeNames.join(', ')} />}
                    {order.plannedReadyAt && <OrderDetail label="Плановая готовность" value={formatTimestamp(order.plannedReadyAt, timezone)} />}
                    {order.sentToLabAt && <OrderDetail label="Отправлено в лабораторию" value={formatTimestamp(order.sentToLabAt, timezone)} />}
                    {order.receivedFromLabAt && <OrderDetail label="Получено из лаборатории" value={formatTimestamp(order.receivedFromLabAt, timezone)} />}
                    {order.tryInAt && <OrderDetail label="Примерка" value={formatTimestamp(order.tryInAt, timezone)} />}
                    {order.deliveredToPatientAt && <OrderDetail label="Выдано пациенту" value={formatTimestamp(order.deliveredToPatientAt, timezone)} />}
                    {order.shade && <OrderDetail label="Оттенок" value={order.shade} />}{anatomy && <OrderDetail label="Анатомическая область" value={anatomy} />}
                  </dl>
                  {order.comment && <div className="mt-4 rounded-lg bg-slate-50 p-3 text-sm text-slate-600"><span className="font-medium text-slate-700">Комментарий:</span> {order.comment}</div>}
                  {!validVersion && (capabilities.canEdit || capabilities.canComplete || capabilities.canReopen) && <div data-testid={`laboratory-version-warning-${order.id}`} className="mt-4 rounded-lg bg-amber-50 p-3 text-sm text-amber-800">Обновите текущие данные перед изменением этой лабораторной работы.</div>}
                  {(canEdit || canComplete || canReopen) && <div className="mt-4 flex flex-wrap gap-2 border-t border-slate-100 pt-4">
                    {canEdit && <button type="button" data-testid={`laboratory-edit-${order.id}`} onClick={() => setDialog({ type: 'edit', order })} className="inline-flex items-center gap-1.5 rounded-lg border border-slate-300 px-3 py-1.5 text-sm font-medium"><Pencil className="h-4 w-4" />Изменить</button>}
                    {canComplete && <button type="button" data-testid={`laboratory-complete-${order.id}`} onClick={() => setDialog({ type: 'complete', order })} className="inline-flex items-center gap-1.5 rounded-lg border border-emerald-300 px-3 py-1.5 text-sm font-medium text-emerald-700"><CheckCircle2 className="h-4 w-4" />Завершить работу</button>}
                    {canReopen && <button type="button" data-testid={`laboratory-reopen-${order.id}`} onClick={() => setDialog({ type: 'reopen', order })} className="inline-flex items-center gap-1.5 rounded-lg border border-amber-300 px-3 py-1.5 text-sm font-medium text-amber-800"><RotateCcw className="h-4 w-4" />Вернуть в работу</button>}
                  </div>}
                </article>
              );
            })}
          </div>
        </>
      )}

      {dialog?.type === 'create' && <LaboratoryWorkOrderDialog key="create" patientId={patientId} timezone={timezone} submitting={mutations.loading} onClose={() => setDialog(null)} onSubmit={handleFormSubmit} />}
      {dialog?.type === 'edit' && <LaboratoryWorkOrderDialog key={`edit-${dialog.order.id}-${dialog.order.mutationVersion ?? 'missing'}`} patientId={patientId} timezone={timezone} order={dialog.order} submitting={mutations.loading} onClose={() => setDialog(null)} onSubmit={handleFormSubmit} />}
      {dialog?.type === 'complete' && <LaboratoryWorkCompleteDialog order={dialog.order} submitting={mutations.loading} onClose={() => setDialog(null)} onConfirm={() => handleComplete(dialog.order)} />}
      {dialog?.type === 'reopen' && <LaboratoryWorkReopenDialog order={dialog.order} submitting={mutations.loading} onClose={() => setDialog(null)} onConfirm={(reason) => handleReopen(dialog.order, reason)} />}
    </div>
  );
}
