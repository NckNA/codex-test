import { AmoCrmIntegrationSettings } from '../components/integrations/AmoCrmIntegrationSettings';

export function SettingsPage() {
  return (
    <main className="space-y-6 p-6">
      <header>
        <h1 className="text-2xl font-semibold text-slate-900">Настройки</h1>
        <p className="mt-1 text-sm text-slate-600">
          Настройки текущей клиники и внешних интеграций.
        </p>
      </header>

      <AmoCrmIntegrationSettings />
    </main>
  );
}
