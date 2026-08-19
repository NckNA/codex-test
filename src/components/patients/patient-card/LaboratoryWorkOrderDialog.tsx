import { useMemo, useState, type FormEvent } from 'react';
import { X } from 'lucide-react';
import { useLaboratoryMutationOptions } from '../../../data/hooks/useLaboratoryMutationOptions';
import type { CreateLaboratoryWorkOrderActionInput, UpdateLaboratoryWorkOrderActionInput } from '../../../data/hooks/useLaboratoryWorkMutations';
import type { LaboratoryAnatomicalScope, LaboratoryWorkOrderRecord } from '../../../data/repositories/LaboratoryWorkRepository';
import { TIMEZONE_ERROR_MESSAGES, TimezoneError, instantToTenantDateTimeInput, tenantDateTimeToInstant } from '../../../domain/timezone';

const VALID_FDI = new Set([
  11,12,13,14,15,16,17,18,21,22,23,24,25,26,27,28,
  31,32,33,34,35,36,37,38,41,42,43,44,45,46,47,48,
  51,52,53,54,55,61,62,63,64,65,71,72,73,74,75,81,82,83,84,85,
]);

export type LaboratoryWorkOrderDialogSubmit =
  | { mode: 'create'; input: CreateLaboratoryWorkOrderActionInput }
  | { mode: 'edit'; input: UpdateLaboratoryWorkOrderActionInput };

interface Props {
  patientId: string;
  patientLabel?: string | null;
  timezone: string;
  order?: LaboratoryWorkOrderRecord | null;
  submitting?: boolean;
  onClose: () => void;
  onSubmit: (value: LaboratoryWorkOrderDialogSubmit) => Promise<void> | void;
}

function localTime(value: string | null, timezone: string) {
  return value ? instantToTenantDateTimeInput(value, timezone) : '';
}

function optionalText(value: string) {
  const normalized = value.trim();
  return normalized ? normalized : null;
}

function parseTeeth(value: string): number[] {
  if (!value.trim()) return [];
  const values = value.split(/[\s,;]+/).filter(Boolean).map(Number);
  if (values.some((item) => !Number.isInteger(item) || !VALID_FDI.has(item))) {
    throw new Error('Укажите корректные номера зубов по системе FDI.');
  }
  return [...new Set(values)].sort((a, b) => a - b);
}

export function LaboratoryWorkOrderDialog({ patientId, patientLabel, timezone, order, submitting = false, onClose, onSubmit }: Props) {
  const isEdit = Boolean(order);
  const options = useLaboratoryMutationOptions(order?.id ?? null);
  const [title, setTitle] = useState(order?.title ?? '');
  const [orderNumber, setOrderNumber] = useState(order?.orderNumber ?? '');
  const [doctorId, setDoctorId] = useState(order?.responsibleDoctorId ?? '');
  const [laboratoryId, setLaboratoryId] = useState(order?.laboratoryId ?? '');
  const [sentToLabAt, setSentToLabAt] = useState(() => localTime(order?.sentToLabAt ?? null, timezone));
  const [plannedReadyAt, setPlannedReadyAt] = useState(() => localTime(order?.plannedReadyAt ?? null, timezone));
  const [receivedFromLabAt, setReceivedFromLabAt] = useState(() => localTime(order?.receivedFromLabAt ?? null, timezone));
  const [tryInAt, setTryInAt] = useState(() => localTime(order?.tryInAt ?? null, timezone));
  const [deliveredToPatientAt, setDeliveredToPatientAt] = useState(() => localTime(order?.deliveredToPatientAt ?? null, timezone));
  const [shade, setShade] = useState(order?.shade ?? '');
  const [anatomicalScope, setAnatomicalScope] = useState<LaboratoryAnatomicalScope | ''>(order?.anatomicalScope ?? '');
  const [teeth, setTeeth] = useState(order?.selectedTeeth.join(', ') ?? '');
  const [comment, setComment] = useState(order?.comment ?? '');
  const [workTypeOverride, setWorkTypeOverride] = useState<string[] | null>(null);
  const [formError, setFormError] = useState<string | null>(null);

  const selectedWorkTypeIds = workTypeOverride ?? options.selectedWorkTypeIds;
  const currentDoctorInactive = useMemo(
    () => options.doctors.some((item) => item.id === doctorId && !item.active),
    [doctorId, options.doctors],
  );
  const currentLaboratoryInactive = useMemo(
    () => options.laboratories.some((item) => item.id === laboratoryId && !item.active),
    [laboratoryId, options.laboratories],
  );

  const toInstant = (value: string) => value ? tenantDateTimeToInstant(value, timezone) : null;

  const handleSubmit = async (event: FormEvent) => {
    event.preventDefault();
    setFormError(null);
    if (!options.ready) {
      setFormError('Справочники лабораторной работы ещё не готовы.');
      return;
    }
    if (!title.trim()) {
      setFormError('Название работы обязательно.');
      return;
    }
    if (isEdit && (!order?.mutationVersion || !Number.isInteger(order.mutationVersion) || order.mutationVersion < 1)) {
      setFormError('Обновите текущие данные перед изменением лабораторной работы.');
      return;
    }
    try {
      const desired = {
        responsibleDoctorId: doctorId || null,
        laboratoryId: laboratoryId || null,
        orderNumber: optionalText(orderNumber),
        title: title.trim(),
        sentToLabAt: toInstant(sentToLabAt),
        plannedReadyAt: toInstant(plannedReadyAt),
        receivedFromLabAt: toInstant(receivedFromLabAt),
        tryInAt: toInstant(tryInAt),
        deliveredToPatientAt: toInstant(deliveredToPatientAt),
        shade: optionalText(shade),
        anatomicalScope: anatomicalScope || null,
        selectedTeeth: parseTeeth(teeth),
        comment: optionalText(comment),
        workTypeIds: [...new Set(selectedWorkTypeIds)].sort(),
      };
      if (order) {
        await onSubmit({ mode: 'edit', input: { ...desired, orderId: order.id, expectedVersion: order.mutationVersion! } });
      } else {
        await onSubmit({ mode: 'create', input: { ...desired, patientId } });
      }
    } catch (error) {
      if (error instanceof TimezoneError) setFormError(TIMEZONE_ERROR_MESSAGES[error.code]);
      else if (error instanceof Error) setFormError(error.message);
      else setFormError('Не удалось сохранить лабораторную работу.');
    }
  };

  const activeDoctors = options.doctors.filter((item) => item.active || item.id === doctorId);
  const activeLabs = options.laboratories.filter((item) => item.active || item.id === laboratoryId);
  const visibleWorkTypes = options.workTypes.filter((item) => item.active || selectedWorkTypeIds.includes(item.id));

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/40 p-4" data-testid="laboratory-order-dialog">
      <div className="max-h-[92vh] w-full max-w-4xl overflow-y-auto rounded-2xl bg-white shadow-2xl">
        <div className="flex items-center justify-between border-b border-slate-200 p-5">
          <div>
            <h3 className="text-lg font-semibold text-slate-900">{isEdit ? 'Изменить лабораторную работу' : 'Новая лабораторная работа'}</h3>
            <p className="mt-1 text-xs text-slate-500">Пациент: {patientLabel?.trim() || 'текущая карточка'}. Изменить пациента здесь нельзя.</p>
          </div>
          <button type="button" onClick={onClose} aria-label="Закрыть" className="rounded-lg p-2 text-slate-500 hover:bg-slate-100"><X className="h-5 w-5" /></button>
        </div>
        <form onSubmit={handleSubmit} className="space-y-5 p-5">
          {options.loading && <div className="rounded-lg bg-blue-50 p-3 text-sm text-blue-700">Загружаем справочники…</div>}
          {options.error && <div className="rounded-lg bg-red-50 p-3 text-sm text-red-700">{options.error.message}</div>}
          {(currentDoctorInactive || currentLaboratoryInactive) && <div className="rounded-lg bg-amber-50 p-3 text-sm text-amber-800">В заказе есть архивное справочное значение. Его можно сохранить, но нельзя выбрать заново после замены.</div>}
          <div className="grid gap-4 md:grid-cols-2">
            <label className="text-sm font-medium text-slate-700 md:col-span-2">Название работы *<input data-testid="laboratory-form-title" value={title} onChange={(e) => setTitle(e.target.value)} className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2" /></label>
            <label className="text-sm font-medium text-slate-700">Номер заказа<input data-testid="laboratory-form-order-number" value={orderNumber} onChange={(e) => setOrderNumber(e.target.value)} className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2" /></label>
            <label className="text-sm font-medium text-slate-700">Ответственный врач<select data-testid="laboratory-form-doctor" value={doctorId} onChange={(e) => setDoctorId(e.target.value)} className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2"><option value="">Не указан</option>{activeDoctors.map((item) => <option key={item.id} value={item.id} disabled={!item.active && item.id !== doctorId}>{item.name}{!item.active ? ' (архив)' : ''}</option>)}</select></label>
            <label className="text-sm font-medium text-slate-700">Лаборатория<select data-testid="laboratory-form-laboratory" value={laboratoryId} onChange={(e) => setLaboratoryId(e.target.value)} className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2"><option value="">Не указана</option>{activeLabs.map((item) => <option key={item.id} value={item.id}>{item.name}{!item.active ? ' (архив)' : ''}</option>)}</select></label>
            <label className="text-sm font-medium text-slate-700">Оттенок<input data-testid="laboratory-form-shade" value={shade} onChange={(e) => setShade(e.target.value)} className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2" /></label>
            <label className="text-sm font-medium text-slate-700">Анатомическая область<select data-testid="laboratory-form-anatomy" value={anatomicalScope} onChange={(e) => setAnatomicalScope(e.target.value as LaboratoryAnatomicalScope | '')} className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2"><option value="">Не указана</option><option value="upper_jaw">Верхняя челюсть</option><option value="lower_jaw">Нижняя челюсть</option><option value="oral_cavity">Полость рта</option><option value="selected_teeth">Выбранные зубы</option></select></label>
            <label className="text-sm font-medium text-slate-700">Зубы FDI<input data-testid="laboratory-form-teeth" placeholder="11, 12, 21" value={teeth} onChange={(e) => setTeeth(e.target.value)} className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2" /></label>
          </div>

          <fieldset className="rounded-xl border border-slate-200 p-4"><legend className="px-2 text-sm font-semibold text-slate-700">Виды работ</legend><div className="grid gap-2 sm:grid-cols-2">{visibleWorkTypes.map((item) => { const checked = selectedWorkTypeIds.includes(item.id); return <label key={item.id} className="flex items-center gap-2 text-sm text-slate-700"><input type="checkbox" data-testid={`laboratory-form-work-type-${item.id}`} checked={checked} disabled={!item.active && !checked} onChange={(e) => setWorkTypeOverride((current) => { const base = current ?? selectedWorkTypeIds; return e.target.checked ? [...new Set([...base, item.id])] : base.filter((id) => id !== item.id); })} />{item.name}{item.code ? ` (${item.code})` : ''}{!item.active ? ' · архив' : ''}</label>; })}{visibleWorkTypes.length === 0 && <span className="text-sm text-slate-400">Нет доступных видов работ.</span>}</div></fieldset>

          <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
            {[
              ['Отправлено в лабораторию', sentToLabAt, setSentToLabAt, 'sent'],
              ['Плановая готовность', plannedReadyAt, setPlannedReadyAt, 'ready'],
              ['Получено из лаборатории', receivedFromLabAt, setReceivedFromLabAt, 'received'],
              ['Примерка', tryInAt, setTryInAt, 'try-in'],
              ['Выдано пациенту', deliveredToPatientAt, setDeliveredToPatientAt, 'delivered'],
            ].map(([label, value, setter, id]) => <label key={id as string} className="text-sm font-medium text-slate-700">{label as string}<input type="datetime-local" data-testid={`laboratory-form-${id}`} value={value as string} onChange={(e) => (setter as (value: string) => void)(e.target.value)} className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2" /></label>)}
          </div>
          <label className="block text-sm font-medium text-slate-700">Комментарий<textarea data-testid="laboratory-form-comment" value={comment} onChange={(e) => setComment(e.target.value)} className="mt-1 min-h-24 w-full rounded-lg border border-slate-300 px-3 py-2" /></label>
          {formError && <div data-testid="laboratory-form-error" className="rounded-lg bg-red-50 p-3 text-sm font-medium text-red-700">{formError}</div>}
          <div className="flex justify-end gap-3 border-t border-slate-100 pt-4"><button type="button" onClick={onClose} className="rounded-lg border border-slate-300 px-4 py-2 text-sm font-medium">Отмена</button><button type="submit" data-testid="laboratory-form-submit" disabled={submitting || !options.ready} className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-semibold text-white disabled:opacity-50">{submitting ? 'Сохраняем…' : 'Сохранить'}</button></div>
        </form>
      </div>
    </div>
  );
}
