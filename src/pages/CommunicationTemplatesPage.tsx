import { FileText } from 'lucide-react';
import { CommunicationTemplateManager } from '../components/communications/CommunicationTemplateManager';

export function CommunicationTemplatesPage() {
  return (
    <div className="mx-auto max-w-[1600px] p-6">
      <header className="mb-6 rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
        <div className="flex items-center gap-2 text-indigo-700">
          <FileText className="h-5 w-5" />
          <span className="text-sm font-semibold uppercase tracking-wide">Versioned plain-text foundation</span>
        </div>
        <h1 className="mt-1 text-2xl font-bold text-slate-900">Шаблоны коммуникаций</h1>
        <p className="mt-2 max-w-3xl text-sm text-slate-600">
          Управление точными версиями шаблонов для напоминаний. Шаблон и предпросмотр не являются отправкой сообщения.
        </p>
      </header>
      <CommunicationTemplateManager />
    </div>
  );
}
