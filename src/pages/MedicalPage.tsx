import { useState, useMemo } from 'react';
import { useDictionaries } from '../data/hooks/useDictionaries';
import type { ClinicalDiagnosis, ClinicalWork } from '../config/clinicalDictionaries';
import { STATUS_TO_ZONES_MAP } from '../config/clinicalDictionaries';
import type { ToothPresenceStatus, ClinicalZone } from '../types';
import { useAuth } from '../contexts/AuthContext';
import { useTenant } from '../contexts/TenantContext';

const PRESENCE_STATUS_LABELS: Record<ToothPresenceStatus, string> = {
  natural: 'Естественный зуб',
  deciduous: 'Молочный зуб',
  root_remnant: 'Остаток корня',
  implant: 'Имплант',
  missing: 'Отсутствует',
  impacted: 'Ретинированный',
};

const CLINICAL_ZONE_LABELS: Record<ClinicalZone, string> = {
  crown: 'Коронковая часть',
  endodontics: 'Каналы',
  root: 'Корень',
  periodontium: 'Десна',
  bone: 'Кость',
  orthopedics: 'Ортопедия',
  planning: 'Планирование',
};

function isRegistryTypeFilter(value: string): value is 'all' | 'diagnosis' | 'work' {
  return ['all', 'diagnosis', 'work'].includes(value);
}

function isActivityFilter(value: string): value is 'all' | 'active' | 'disabled' {
  return ['all', 'active', 'disabled'].includes(value);
}

function isClinicalZoneFilter(value: string): value is 'all' | ClinicalZone {
  return value === 'all' || value in CLINICAL_ZONE_LABELS;
}

function isPresenceStatusFilter(value: string): value is 'all' | ToothPresenceStatus {
  return value === 'all' || value in PRESENCE_STATUS_LABELS;
}

function hasIntersection<T>(a: T[] = [], b: T[] = []) {
  return a.some((item) => b.includes(item));
}

function isDiagnosisCompatibleWithWork(diagnosis: ClinicalDiagnosis, workStatuses: ToothPresenceStatus[], workZones: ClinicalZone[]) {
  return diagnosis.isActive !== false
    && hasIntersection(diagnosis.allowedPresenceStatuses, workStatuses)
    && hasIntersection(diagnosis.allowedZones, workZones);
}

function StatusZoneSelector({
  selectedStatuses,
  selectedZones,
  onChangeStatuses,
  onChangeZones,
}: {
  selectedStatuses: ToothPresenceStatus[];
  selectedZones: ClinicalZone[];
  onChangeStatuses: (statuses: ToothPresenceStatus[]) => void;
  onChangeZones: (zones: ClinicalZone[]) => void;
}) {
  const availableZones = Array.from(
    new Set(selectedStatuses.flatMap((status) => STATUS_TO_ZONES_MAP[status] || []))
  );

  const toggleStatus = (status: ToothPresenceStatus) => {
    const next = selectedStatuses.includes(status)
      ? selectedStatuses.filter((s) => s !== status)
      : [...selectedStatuses, status];
    onChangeStatuses(next);
    // Auto-remove invalid zones
    const nextAvailable = new Set(next.flatMap((s) => STATUS_TO_ZONES_MAP[s] || []));
    onChangeZones(selectedZones.filter((z) => nextAvailable.has(z)));
  };

  const toggleZone = (zone: ClinicalZone) => {
    const next = selectedZones.includes(zone)
      ? selectedZones.filter((z) => z !== zone)
      : [...selectedZones, zone];
    onChangeZones(next);
  };

  return (
    <div className="space-y-3">
      <div>
        <label className="block text-sm font-medium text-slate-700 mb-2">Статусы зуба</label>
        <div className="flex flex-wrap gap-2">
          {(Object.entries(PRESENCE_STATUS_LABELS) as [ToothPresenceStatus, string][]).map(([val, label]) => (
            <label key={val} className="flex items-center gap-1 text-sm bg-white border border-slate-200 px-2 py-1 rounded cursor-pointer hover:bg-slate-50">
              <input type="checkbox" checked={selectedStatuses.includes(val)} onChange={() => toggleStatus(val)} />
              {label}
            </label>
          ))}
        </div>
      </div>
      <div>
        <label className="block text-sm font-medium text-slate-700 mb-2">Клинические зоны (доступно по статусам)</label>
        {availableZones.length === 0 ? (
          <p className="text-sm text-slate-500">Сначала выберите статусы</p>
        ) : (
          <div className="flex flex-wrap gap-2">
            {availableZones.map((val) => (
              <label key={val} className="flex items-center gap-1 text-sm bg-white border border-slate-200 px-2 py-1 rounded cursor-pointer hover:bg-slate-50">
                <input type="checkbox" checked={selectedZones.includes(val)} onChange={() => toggleZone(val)} />
                {CLINICAL_ZONE_LABELS[val]}
              </label>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

export function MedicalPage() {
  const { diagnoses, works, loading, saveDiagnosis, saveWork, refresh } = useDictionaries();
  const { authMode } = useAuth();
  const { activeTenant } = useTenant();

  const canManage = useMemo(() => {
    if (authMode === 'dev') {
      return true;
    }
    if (authMode === 'supabase-active') {
      const role = activeTenant?.role;
      return role === 'clinic_admin' || role === 'clinic_owner';
    }
    return false;
  }, [authMode, activeTenant]);
  
  const [searchQuery, setSearchQuery] = useState('');
  const [filterType, setFilterType] = useState<'all' | 'diagnosis' | 'work'>('all');
  const [filterActivity, setFilterActivity] = useState<'all' | 'active' | 'disabled'>('all');
  const [filterZone, setFilterZone] = useState<'all' | ClinicalZone>('all');
  const [filterStatus, setFilterStatus] = useState<'all' | ToothPresenceStatus>('all');
  
  const [newItemType, setNewItemType] = useState<'diagnosis' | 'work' | null>(null);
  const [newWorkId, setNewWorkId] = useState<string | null>(null);

  // Works currently require `setEditingId` to ensure only one is edited at a time in the old design,
  // but DiagnosisEditorRow used local state. To avoid rewriting their internal logic unnecessarily,
  // we will continue using local state for Diagnosis, and maybe lift state for Works if we want, or just let them be.
  // The user requested: "если текущий локальный editing state работает безопасно, не надо насильно выносить его наружу".
  // So we'll let WorkEditorRow keep its own `isEditing` prop, which we can manage at the page level like before.
  const [editingWorkId, setEditingWorkId] = useState<string | null>(null);

  const filteredItems = useMemo(() => {
    const allItems = [...diagnoses, ...works];
    
    return allItems.filter(item => {
      // Type
      if (filterType !== 'all' && item.type !== filterType) return false;
      
      // Activity
      if (filterActivity === 'active' && item.isActive === false) return false;
      if (filterActivity === 'disabled' && item.isActive !== false) return false;
      
      // Zone
      if (filterZone !== 'all' && !item.allowedZones.includes(filterZone)) return false;
      
      // Status
      if (filterStatus !== 'all' && !item.allowedPresenceStatuses.includes(filterStatus)) return false;
      
      // Search
      if (searchQuery) {
        const q = searchQuery.toLowerCase();
        const matchName = item.name.toLowerCase().includes(q);
        const matchId = item.id.toLowerCase().includes(q);
        const matchZone = item.allowedZones.some(z => CLINICAL_ZONE_LABELS[z]?.toLowerCase().includes(q));
        const matchStatus = item.allowedPresenceStatuses.some(s => PRESENCE_STATUS_LABELS[s]?.toLowerCase().includes(q));
        
        if (!matchName && !matchId && !matchZone && !matchStatus) return false;
      }
      
      return true;
    });
  }, [diagnoses, works, searchQuery, filterType, filterActivity, filterZone, filterStatus]);

  if (loading) return <div className="p-8 text-slate-500">Загрузка справочников...</div>;

  return (
    <div className="mx-auto max-w-5xl space-y-6 p-4 md:p-8">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Клинические справочники</h1>
          <p className="mt-1 text-slate-500">Настройка диагнозов, работ, цен и связей для зубной карты</p>
        </div>
        <div className="flex items-center gap-2">
          {canManage && (
            <>
              <button
                onClick={() => setNewItemType('diagnosis')}
                className="rounded bg-emerald-600 px-4 py-2 text-sm font-medium text-white shadow-sm hover:bg-emerald-700"
              >
                + Диагноз
              </button>
              <button
                onClick={() => { setNewItemType('work'); setNewWorkId(`work_${Date.now()}`); }}
                className="rounded bg-blue-600 px-4 py-2 text-sm font-medium text-white shadow-sm hover:bg-blue-700"
              >
                + Работа
              </button>
            </>
          )}
          <button
            onClick={refresh}
            className="rounded border border-slate-300 bg-white px-4 py-2 text-sm font-medium text-slate-700 shadow-sm hover:bg-slate-50"
          >
            Обновить
          </button>
        </div>
      </div>

      {!canManage && (
        <div className="rounded-lg border border-blue-100 bg-blue-50/50 p-3 text-sm text-blue-700">
          Справочники доступны только для просмотра. Редактирование доступно администратору клиники.
        </div>
      )}

      <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm space-y-4">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-3">
          <div className="lg:col-span-1">
            <label className="block text-xs font-medium text-slate-700 mb-1">Поиск</label>
            <input
              type="text"
              placeholder="Название, ID, зона..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full rounded-md border-slate-300 px-3 py-1.5 text-sm shadow-sm focus:border-blue-500 focus:ring-blue-500 border bg-white"
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-slate-700 mb-1">Тип</label>
            <select
              value={filterType}
              onChange={(e) => {
                if (isRegistryTypeFilter(e.target.value)) {
                  setFilterType(e.target.value);
                }
              }}
              className="w-full rounded-md border-slate-300 px-3 py-1.5 text-sm shadow-sm focus:border-blue-500 focus:ring-blue-500 border bg-white"
            >
              <option value="all">Все типы</option>
              <option value="diagnosis">Диагнозы</option>
              <option value="work">Работы</option>
            </select>
          </div>
          <div>
            <label className="block text-xs font-medium text-slate-700 mb-1">Активность</label>
            <select
              value={filterActivity}
              onChange={(e) => {
                if (isActivityFilter(e.target.value)) {
                  setFilterActivity(e.target.value);
                }
              }}
              className="w-full rounded-md border-slate-300 px-3 py-1.5 text-sm shadow-sm focus:border-blue-500 focus:ring-blue-500 border bg-white"
            >
              <option value="all">Все</option>
              <option value="active">Активные</option>
              <option value="disabled">Отключённые</option>
            </select>
          </div>
          <div>
            <label className="block text-xs font-medium text-slate-700 mb-1">Клиническая зона</label>
            <select
              value={filterZone}
              onChange={(e) => {
                if (isClinicalZoneFilter(e.target.value)) {
                  setFilterZone(e.target.value);
                }
              }}
              className="w-full rounded-md border-slate-300 px-3 py-1.5 text-sm shadow-sm focus:border-blue-500 focus:ring-blue-500 border bg-white"
            >
              <option value="all">Все зоны</option>
              {(Object.entries(CLINICAL_ZONE_LABELS) as [ClinicalZone, string][]).map(([val, label]) => (
                <option key={val} value={val}>{label}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-xs font-medium text-slate-700 mb-1">Статус зуба</label>
            <select
              value={filterStatus}
              onChange={(e) => {
                if (isPresenceStatusFilter(e.target.value)) {
                  setFilterStatus(e.target.value);
                }
              }}
              className="w-full rounded-md border-slate-300 px-3 py-1.5 text-sm shadow-sm focus:border-blue-500 focus:ring-blue-500 border bg-white"
            >
              <option value="all">Все статусы</option>
              {(Object.entries(PRESENCE_STATUS_LABELS) as [ToothPresenceStatus, string][]).map(([val, label]) => (
                <option key={val} value={val}>{label}</option>
              ))}
            </select>
          </div>
        </div>

        <div className="space-y-3 pt-4 border-t border-slate-100">
          {canManage && newItemType === 'diagnosis' && (
            <NewDiagnosisForm 
              onSave={(d) => { saveDiagnosis(d); setNewItemType(null); }} 
              onCancel={() => setNewItemType(null)} 
            />
          )}

          {canManage && newItemType === 'work' && newWorkId && (
            <WorkEditorRow 
              work={{
                id: newWorkId,
                type: 'work',
                name: '',
                price: 0,
                allowedPresenceStatuses: ['natural', 'deciduous'],
                allowedZones: ['crown'],
                allowedDiagnosisIds: [],
                workAccessType: 'requires_diagnosis',
                isActive: true,
              }}
              diagnoses={diagnoses}
              onSave={(newWork) => { saveWork(newWork); setNewItemType(null); }}
              isEditing={true}
              setEditing={() => setNewItemType(null)}
              isNew={true}
              canManage={canManage}
            />
          )}

          {filteredItems.length === 0 && !newItemType && (
            <div className="py-12 text-center">
              <p className="text-slate-500">Ничего не найдено. Измените поиск или фильтры.</p>
            </div>
          )}

          {filteredItems.map(item => {
            if (item.type === 'diagnosis') {
              return (
                <DiagnosisEditorRow 
                  key={item.id}
                  diagnosis={item as ClinicalDiagnosis}
                  onSave={saveDiagnosis}
                  canManage={canManage}
                />
              );
            } else {
              return (
                <WorkEditorRow 
                  key={item.id} 
                  work={item as ClinicalWork} 
                  diagnoses={diagnoses} 
                  onSave={saveWork} 
                  isEditing={editingWorkId === item.id}
                  setEditing={() => setEditingWorkId(editingWorkId === item.id ? null : item.id)}
                  canManage={canManage}
                />
              );
            }
          })}
        </div>
      </div>
    </div>
  );
}

function NewDiagnosisForm({ onSave, onCancel }: { onSave: (d: ClinicalDiagnosis) => void, onCancel: () => void }) {
  const [newName, setNewName] = useState('');
  const [newStatuses, setNewStatuses] = useState<ToothPresenceStatus[]>(['natural', 'deciduous']);
  const [newZones, setNewZones] = useState<ClinicalZone[]>(['crown']);

  const handleAdd = () => {
    if (!newName.trim() || newStatuses.length === 0 || newZones.length === 0) return;
    const newDiagnosis: ClinicalDiagnosis = {
      id: `dx_${Date.now()}`,
      type: 'diagnosis',
      name: newName.trim(),
      allowedPresenceStatuses: newStatuses,
      allowedZones: newZones,
      isActive: true,
    };
    onSave(newDiagnosis);
  };

  return (
    <div className="rounded-lg border-2 border-emerald-200 bg-emerald-50/30 p-4 mb-4">
      <h3 className="font-medium text-slate-900 mb-4">Новый диагноз / состояние</h3>
      <div className="mb-4">
        <label className="block text-sm font-medium text-slate-700 mb-1">Название</label>
        <input 
          type="text" 
          value={newName}
          onChange={(e) => setNewName(e.target.value)}
          className="w-full max-w-md rounded-md border-slate-300 shadow-sm focus:border-emerald-500 focus:ring-emerald-500 sm:text-sm px-3 py-2 border mb-4 bg-white"
          placeholder="Например: Поверхностный кариес"
        />
        <StatusZoneSelector 
          selectedStatuses={newStatuses} 
          selectedZones={newZones} 
          onChangeStatuses={setNewStatuses} 
          onChangeZones={setNewZones} 
        />
      </div>
      <div className="flex justify-end gap-2 mt-4">
        <button onClick={onCancel} className="px-4 py-2 text-sm text-slate-600 hover:text-slate-800">Отмена</button>
        <button onClick={handleAdd} className="rounded bg-emerald-600 px-4 py-2 text-sm font-medium text-white shadow-sm hover:bg-emerald-700">Добавить</button>
      </div>
    </div>
  );
}

function DiagnosisEditorRow({ 
  diagnosis, 
  onSave,
  canManage = true
}: { 
  diagnosis: ClinicalDiagnosis, 
  onSave: (d: ClinicalDiagnosis) => void,
  canManage?: boolean
}) {
  const [isEditing, setIsEditing] = useState(false);
  const [name, setName] = useState(diagnosis.name);
  const [statuses, setStatuses] = useState<ToothPresenceStatus[]>(diagnosis.allowedPresenceStatuses);
  const [zones, setZones] = useState<ClinicalZone[]>(diagnosis.allowedZones);

  const handleSave = () => {
    if (!name.trim() || statuses.length === 0 || zones.length === 0) return;
    onSave({ ...diagnosis, name: name.trim(), allowedPresenceStatuses: statuses, allowedZones: zones });
    setIsEditing(false);
  };

  if (isEditing && canManage) {
    return (
      <div className="rounded-lg border-2 border-blue-200 bg-blue-50/30 p-4">
        <div className="flex justify-between items-start mb-4">
          <h3 className="font-medium text-slate-900">Редактирование диагноза</h3>
          <button onClick={() => setIsEditing(false)} className="text-slate-400 hover:text-slate-600">✕</button>
        </div>
        <div className="mb-4">
          <label className="block text-sm font-medium text-slate-700 mb-1">Название</label>
          <input 
            type="text" 
            value={name}
            onChange={(e) => setName(e.target.value)}
            className="w-full max-w-md rounded-md border-slate-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 sm:text-sm px-3 py-2 border mb-4 bg-white"
          />
          <StatusZoneSelector 
            selectedStatuses={statuses} 
            selectedZones={zones} 
            onChangeStatuses={setStatuses} 
            onChangeZones={setZones} 
          />
        </div>
        <div className="flex justify-end gap-2 mt-4">
          <button onClick={handleSave} disabled={!name.trim()} className="rounded bg-blue-600 px-4 py-2 text-sm font-medium text-white shadow-sm hover:bg-blue-700 disabled:opacity-50">
            Сохранить
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className={`flex flex-col sm:flex-row sm:items-center justify-between rounded-lg border p-3 gap-3 ${diagnosis.isActive === false ? 'bg-slate-50 opacity-60' : 'bg-white'}`}>
      <div>
        <div className="flex items-center gap-2 mb-1">
          <span className="inline-block rounded bg-emerald-100 px-2 py-0.5 text-[10px] font-semibold text-emerald-700 uppercase tracking-wider">Диагноз</span>
          <h3 className="font-medium text-slate-900">{diagnosis.name}</h3>
        </div>
        <p className="text-xs text-slate-500">ID: {diagnosis.id} • Зон: {diagnosis.allowedZones.length} • Статусов: {diagnosis.allowedPresenceStatuses.length}</p>
      </div>
      {canManage && (
        <div className="flex gap-2 shrink-0">
          <button
            onClick={() => { setName(diagnosis.name); setIsEditing(true); }}
            className="rounded border border-slate-200 bg-white px-3 py-1.5 text-xs font-medium text-slate-700 shadow-sm hover:bg-slate-50"
          >
            Редактировать
          </button>
          <button
            onClick={() => onSave({ ...diagnosis, isActive: diagnosis.isActive === false ? true : false })}
            className={`rounded px-3 py-1.5 text-xs font-medium shadow-sm ${diagnosis.isActive === false ? 'bg-emerald-100 text-emerald-700 hover:bg-emerald-200' : 'bg-red-50 text-red-600 border border-red-100 hover:bg-red-100'}`}
          >
            {diagnosis.isActive === false ? 'Восстановить' : 'Отключить'}
          </button>
        </div>
      )}
    </div>
  );
}

function WorkEditorRow({ 
  work, 
  diagnoses, 
  onSave, 
  isEditing, 
  setEditing,
  isNew = false,
  canManage = true
}: { 
  work: ClinicalWork, 
  diagnoses: ClinicalDiagnosis[], 
  onSave: (w: ClinicalWork) => void,
  isEditing: boolean,
  setEditing: () => void,
  isNew?: boolean,
  canManage?: boolean
}) {
  const [name, setName] = useState(work.name);
  const [price, setPrice] = useState(work.price || 0);
  const [allowedDiagnosisIds, setAllowedDiagnosisIds] = useState<string[]>(work.allowedDiagnosisIds || []);
  const [workAccessType, setWorkAccessType] = useState<ClinicalWork['workAccessType']>(work.workAccessType);
  const [statuses, setStatuses] = useState<ToothPresenceStatus[]>(work.allowedPresenceStatuses);
  const [zones, setZones] = useState<ClinicalZone[]>(work.allowedZones);

  const handleSave = () => {
    if (!name.trim() || statuses.length === 0 || zones.length === 0) return;
    
    let finalDiagnosisIds: string[];
    if (workAccessType === 'base_available') {
      finalDiagnosisIds = [];
    } else {
      finalDiagnosisIds = allowedDiagnosisIds.filter(id => {
        const d = diagnoses.find(d => d.id === id);
        return d ? isDiagnosisCompatibleWithWork(d, statuses, zones) : false;
      });
    }

    onSave({ ...work, name, price, allowedDiagnosisIds: finalDiagnosisIds, workAccessType, allowedPresenceStatuses: statuses, allowedZones: zones });
    if (!isNew) setEditing();
  };

  const compatibleDiagnoses = useMemo(() => {
    return diagnoses.filter(d => isDiagnosisCompatibleWithWork(d, statuses, zones));
  }, [diagnoses, statuses, zones]);

  const handleWorkAccessTypeChange = (type: ClinicalWork['workAccessType']) => {
    setWorkAccessType(type);
    if (type === 'base_available') {
      setAllowedDiagnosisIds([]);
    }
  };

  const handleStatusesChange = (newStatuses: ToothPresenceStatus[]) => {
    setStatuses(newStatuses);
    setAllowedDiagnosisIds(prev => prev.filter(id => {
      const d = diagnoses.find(d => d.id === id);
      return d ? isDiagnosisCompatibleWithWork(d, newStatuses, zones) : false;
    }));
  };

  const handleZonesChange = (newZones: ClinicalZone[]) => {
    setZones(newZones);
    setAllowedDiagnosisIds(prev => prev.filter(id => {
      const d = diagnoses.find(d => d.id === id);
      return d ? isDiagnosisCompatibleWithWork(d, statuses, newZones) : false;
    }));
  };

  const toggleDiagnosis = (id: string) => {
    setAllowedDiagnosisIds(prev => 
      prev.includes(id) ? prev.filter(d => d !== id) : [...prev, id]
    );
  };

  if (!isEditing || !canManage) {
    return (
      <div className={`flex flex-col sm:flex-row sm:items-center justify-between rounded-lg border p-3 gap-3 ${work.isActive === false ? 'bg-slate-50 opacity-60' : 'bg-white'}`}>
        <div>
          <div className="flex items-center gap-2 mb-1">
            <span className="inline-block rounded bg-blue-100 px-2 py-0.5 text-[10px] font-semibold text-blue-700 uppercase tracking-wider">Работа</span>
            <h3 className="font-medium text-slate-900">{work.name}</h3>
          </div>
          <p className="text-xs text-slate-500">
            Цена: {work.price ? `${work.price} тг` : 'не указана'} • ID: {work.id} • Связанных диагнозов: {work.allowedDiagnosisIds?.length || 0}
          </p>
        </div>
        {canManage && (
          <div className="flex gap-2 shrink-0">
            <button
              onClick={setEditing}
              className="rounded border border-slate-200 bg-white px-3 py-1.5 text-xs font-medium text-slate-700 shadow-sm hover:bg-slate-50"
            >
              Редактировать
            </button>
            <button
              onClick={() => onSave({ ...work, isActive: work.isActive === false ? true : false })}
              className={`rounded px-3 py-1.5 text-xs font-medium shadow-sm ${work.isActive === false ? 'bg-emerald-100 text-emerald-700 hover:bg-emerald-200' : 'bg-red-50 text-red-600 border border-red-100 hover:bg-red-100'}`}
            >
              {work.isActive === false ? 'Восстановить' : 'Отключить'}
            </button>
          </div>
        )}
      </div>
    );
  }

  return (
    <div className="rounded-lg border-2 border-blue-200 bg-blue-50/30 p-4 mb-4">
      <div className="flex justify-between items-start mb-4">
        <h3 className="font-medium text-slate-900">{isNew ? 'Новая работа' : 'Редактирование работы'}</h3>
        <button onClick={setEditing} className="text-slate-400 hover:text-slate-600">✕</button>
      </div>

      <div className="mb-4">
        <label className="block text-sm font-medium text-slate-700 mb-1">Название работы</label>
        <input 
          type="text" 
          value={name}
          onChange={(e) => setName(e.target.value)}
          className="w-full max-w-md rounded-md border-slate-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 sm:text-sm px-3 py-2 border bg-white"
          placeholder="Название работы"
        />
      </div>

      <div className="mb-4">
        <label className="block text-sm font-medium text-slate-700 mb-1">Тип доступа работы</label>
        <select
          value={workAccessType}
          onChange={(e) => handleWorkAccessTypeChange(e.target.value as ClinicalWork['workAccessType'])}
          className="w-full max-w-xs rounded-md border-slate-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 sm:text-sm px-3 py-2 border bg-white"
        >
          <option value="base_available">Базовая (доступна всегда)</option>
          <option value="requires_diagnosis">Лечебная (по диагнозу)</option>
        </select>
      </div>

      <div className="mb-4">
        <label className="block text-sm font-medium text-slate-700 mb-1">Цена (тг)</label>
        <input 
          type="number" 
          value={price}
          onChange={(e) => setPrice(Number(e.target.value))}
          className="w-full max-w-xs rounded-md border-slate-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 sm:text-sm px-3 py-2 border bg-white"
        />
      </div>

      <div className="mb-4">
        <StatusZoneSelector 
          selectedStatuses={statuses} 
          selectedZones={zones} 
          onChangeStatuses={handleStatusesChange} 
          onChangeZones={handleZonesChange} 
        />
      </div>

      {workAccessType === 'requires_diagnosis' && (
        <div className="mb-4">
          <label className="block text-sm font-medium text-slate-700 mb-2">Связанные диагнозы</label>
          {compatibleDiagnoses.length === 0 ? (
            <p className="text-sm text-slate-500 italic">Нет совместимых диагнозов для выбранных статусов и зон.</p>
          ) : (
            <div className="grid grid-cols-1 gap-2 sm:grid-cols-2 lg:grid-cols-3 max-h-60 overflow-y-auto p-2 border rounded-md bg-white">
              {compatibleDiagnoses.map(diagnosis => (
                <label key={diagnosis.id} className="flex items-center space-x-2 text-sm cursor-pointer">
                  <input
                    type="checkbox"
                    checked={allowedDiagnosisIds.includes(diagnosis.id)}
                    onChange={() => toggleDiagnosis(diagnosis.id)}
                    className="rounded border-slate-300 text-blue-600 focus:ring-blue-500"
                  />
                  <span className="text-slate-700">{diagnosis.name}</span>
                </label>
              ))}
            </div>
          )}
        </div>
      )}

      <div className="flex justify-end mt-4">
        <button
          onClick={handleSave}
          disabled={!name.trim()}
          className="rounded bg-blue-600 px-4 py-2 text-sm font-medium text-white shadow-sm hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {isNew ? 'Добавить' : 'Сохранить изменения'}
        </button>
      </div>
    </div>
  );
}
