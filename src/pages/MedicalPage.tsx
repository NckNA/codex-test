import { useState } from 'react';
import { useDictionaries } from '../data/hooks/useDictionaries';
import type { ClinicalDiagnosis, ClinicalWork } from '../config/clinicalDictionaries';

export function MedicalPage() {
  const { diagnoses, works, loading, saveDiagnosis, saveWork, refresh } = useDictionaries();
  const [activeTab, setActiveTab] = useState<'diagnoses' | 'works'>('diagnoses');
  
  if (loading) return <div className="p-8 text-slate-500">Загрузка справочников...</div>;

  return (
    <div className="mx-auto max-w-5xl space-y-6 p-4 md:p-8">
      <div>
        <h1 className="text-2xl font-bold text-slate-900">Врачебная часть</h1>
        <p className="mt-1 text-slate-500">Редактор клинических справочников</p>
      </div>

      <div className="flex space-x-2 border-b border-slate-200">
        <button
          className={`px-4 py-2 text-sm font-medium ${activeTab === 'diagnoses' ? 'border-b-2 border-blue-500 text-blue-600' : 'text-slate-500 hover:text-slate-700'}`}
          onClick={() => setActiveTab('diagnoses')}
        >
          Диагнозы
        </button>
        <button
          className={`px-4 py-2 text-sm font-medium ${activeTab === 'works' ? 'border-b-2 border-blue-500 text-blue-600' : 'text-slate-500 hover:text-slate-700'}`}
          onClick={() => setActiveTab('works')}
        >
          Работы и Цены
        </button>
        <div className="flex-1" />
        <button
          onClick={refresh}
          className="text-sm text-slate-500 hover:text-slate-700"
        >
          Обновить
        </button>
      </div>

      <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
        {activeTab === 'diagnoses' ? (
          <DiagnosesEditor diagnoses={diagnoses} onSave={saveDiagnosis} />
        ) : (
          <WorksEditor works={works} diagnoses={diagnoses} onSave={saveWork} />
        )}
      </div>
    </div>
  );
}

function DiagnosesEditor({ diagnoses, onSave }: { diagnoses: ClinicalDiagnosis[], onSave: (d: ClinicalDiagnosis) => void }) {
  return (
    <div className="space-y-4">
      {diagnoses.map(diagnosis => (
        <div key={diagnosis.id} className={`flex items-center justify-between rounded-lg border p-3 ${diagnosis.isActive === false ? 'bg-slate-50 opacity-60' : 'bg-white'}`}>
          <div>
            <h3 className="font-medium text-slate-900">{diagnosis.name}</h3>
            <p className="text-xs text-slate-500">ID: {diagnosis.id}</p>
          </div>
          <div>
            <button
              onClick={() => onSave({ ...diagnosis, isActive: diagnosis.isActive === false ? true : false })}
              className={`rounded px-3 py-1 text-xs font-medium ${diagnosis.isActive === false ? 'bg-emerald-100 text-emerald-700' : 'bg-red-100 text-red-700'}`}
            >
              {diagnosis.isActive === false ? 'Восстановить' : 'Отключить'}
            </button>
          </div>
        </div>
      ))}
      <div className="text-sm text-slate-500 italic mt-4">
        Добавление новых диагнозов в MVP ограничено.
      </div>
    </div>
  );
}

function WorksEditor({ works, diagnoses, onSave }: { works: ClinicalWork[], diagnoses: ClinicalDiagnosis[], onSave: (w: ClinicalWork) => void }) {
  const [editingId, setEditingId] = useState<string | null>(null);

  return (
    <div className="space-y-4">
      {works.map(work => (
        <WorkEditorRow 
          key={work.id} 
          work={work} 
          diagnoses={diagnoses} 
          onSave={onSave} 
          isEditing={editingId === work.id}
          setEditing={() => setEditingId(editingId === work.id ? null : work.id)}
        />
      ))}
      <div className="text-sm text-slate-500 italic mt-4">
        Добавление новых работ в MVP ограничено.
      </div>
    </div>
  );
}

function WorkEditorRow({ 
  work, 
  diagnoses, 
  onSave, 
  isEditing, 
  setEditing 
}: { 
  work: ClinicalWork, 
  diagnoses: ClinicalDiagnosis[], 
  onSave: (w: ClinicalWork) => void,
  isEditing: boolean,
  setEditing: () => void
}) {
  const [price, setPrice] = useState(work.price || 0);
  const [allowedDiagnosisIds, setAllowedDiagnosisIds] = useState<string[]>(work.allowedDiagnosisIds);

  const handleSave = () => {
    onSave({ ...work, price, allowedDiagnosisIds });
    setEditing();
  };

  const toggleDiagnosis = (id: string) => {
    setAllowedDiagnosisIds(prev => 
      prev.includes(id) ? prev.filter(d => d !== id) : [...prev, id]
    );
  };

  if (!isEditing) {
    return (
      <div className={`rounded-lg border p-3 ${work.isActive === false ? 'bg-slate-50 opacity-60' : 'bg-white'}`}>
        <div className="flex items-center justify-between">
          <div>
            <h3 className="font-medium text-slate-900">{work.name}</h3>
            <p className="text-xs text-slate-500">
              Цена: {work.price ? `${work.price} ₽` : 'не указана'} • Связанных диагнозов: {work.allowedDiagnosisIds.length}
            </p>
          </div>
          <div className="flex gap-2">
            <button
              onClick={setEditing}
              className="rounded bg-blue-50 px-3 py-1 text-xs font-medium text-blue-700"
            >
              Редактировать
            </button>
            <button
              onClick={() => onSave({ ...work, isActive: work.isActive === false ? true : false })}
              className={`rounded px-3 py-1 text-xs font-medium ${work.isActive === false ? 'bg-emerald-100 text-emerald-700' : 'bg-red-100 text-red-700'}`}
            >
              {work.isActive === false ? 'Восстановить' : 'Отключить'}
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="rounded-lg border-2 border-blue-200 bg-blue-50/30 p-4">
      <div className="flex justify-between items-start mb-4">
        <h3 className="font-medium text-slate-900">{work.name}</h3>
        <button onClick={setEditing} className="text-slate-400 hover:text-slate-600">✕</button>
      </div>

      <div className="mb-4">
        <label className="block text-sm font-medium text-slate-700 mb-1">Цена (₽)</label>
        <input 
          type="number" 
          value={price}
          onChange={(e) => setPrice(Number(e.target.value))}
          className="w-full max-w-xs rounded-md border-slate-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 sm:text-sm px-3 py-2 border"
        />
      </div>

      {work.workAccessType === 'requires_diagnosis' && (
        <div className="mb-4">
          <label className="block text-sm font-medium text-slate-700 mb-2">Связанные диагнозы</label>
          <div className="grid grid-cols-1 gap-2 sm:grid-cols-2 lg:grid-cols-3 max-h-60 overflow-y-auto p-2 border rounded-md bg-white">
            {diagnoses.filter(d => d.isActive !== false).map(diagnosis => (
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
        </div>
      )}

      <div className="flex justify-end mt-4">
        <button
          onClick={handleSave}
          className="rounded bg-blue-600 px-4 py-2 text-sm font-medium text-white shadow-sm hover:bg-blue-700"
        >
          Сохранить изменения
        </button>
      </div>
    </div>
  );
}
