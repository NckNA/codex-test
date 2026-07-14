import { AlertTriangle, CheckCircle2, Link2, RefreshCw, Unplug } from 'lucide-react';
import { useAmoCrmIntegration, type UseAmoCrmIntegrationResult } from '../../data/hooks/useAmoCrmIntegration';

const STATUS_LABELS: Record<string, string> = {
  disconnected: 'Не подключено',
  authorization_pending: 'Ожидается завершение подключения',
  connected: 'Подключено',
  refresh_required: 'Требуется переподключение',
  degraded: 'Временная ошибка проверки',
  account_mismatch: 'Аккаунт не совпадает',
  revoked: 'Доступ отозван',
  disabled: 'Интеграция отключена',
};

function formatDate(value?: string): string {
  if (!value) return 'Нет данных';
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? 'Нет данных' : date.toLocaleString('ru-RU');
}

interface AmoCrmIntegrationSettingsViewProps {
  model: UseAmoCrmIntegrationResult;
}

export function AmoCrmIntegrationSettingsView({ model }: AmoCrmIntegrationSettingsViewProps) {
  const {
    health,
    loading,
    connecting,
    disconnecting,
    reconnecting,
    checking,
    error,
    role,
    connect,
    disconnect,
    reconnect,
    check,
  } = model;

  const canView = role === 'clinic_owner' || role === 'clinic_admin' || role === 'registrar';
  const canManage = role === 'clinic_owner' || role === 'clinic_admin';
  if (!canView) return null;

  const connected = Boolean(health?.connected);
  const busy = connecting || disconnecting || reconnecting || checking;

  return (
    <section className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm" aria-labelledby="amocrm-heading">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <Link2 className="h-5 w-5 text-slate-700" aria-hidden="true" />
            <h2 id="amocrm-heading" className="text-lg font-semibold text-slate-900">amoCRM</h2>
          </div>
          <p className="mt-1 text-sm text-slate-600">
            Безопасное подключение аккаунта продаж к текущей клинике.
          </p>
        </div>
        <div className={`inline-flex items-center gap-2 rounded-full px-3 py-1 text-sm font-medium ${
          connected ? 'bg-emerald-50 text-emerald-700' : 'bg-slate-100 text-slate-700'
        }`}>
          {connected
            ? <CheckCircle2 className="h-4 w-4" aria-hidden="true" />
            : <AlertTriangle className="h-4 w-4" aria-hidden="true" />}
          {loading ? 'Проверка…' : STATUS_LABELS[health?.status ?? 'disconnected']}
        </div>
      </div>

      {error && (
        <div role="alert" className="mt-4 rounded-lg border border-amber-200 bg-amber-50 p-3 text-sm text-amber-900">
          {error.message}
        </div>
      )}

      <dl className="mt-5 grid gap-4 text-sm sm:grid-cols-2 lg:grid-cols-3">
        <div>
          <dt className="text-slate-500">Аккаунт</dt>
          <dd className="mt-1 font-medium text-slate-900">{health?.displayName ?? 'Не указан'}</dd>
        </div>
        <div>
          <dt className="text-slate-500">ID аккаунта</dt>
          <dd className="mt-1 font-medium text-slate-900">{health?.externalAccountId ?? 'Не указан'}</dd>
        </div>
        <div>
          <dt className="text-slate-500">Домен</dt>
          <dd className="mt-1 font-medium text-slate-900">{health?.externalAccountDomain ?? 'Не указан'}</dd>
        </div>
        <div>
          <dt className="text-slate-500">Последняя проверка</dt>
          <dd className="mt-1 font-medium text-slate-900">{formatDate(health?.lastVerifiedAt)}</dd>
        </div>
        <div>
          <dt className="text-slate-500">Срок действия доступа</dt>
          <dd className="mt-1 font-medium text-slate-900">{formatDate(health?.tokenExpiresAt)}</dd>
        </div>
        <div>
          <dt className="text-slate-500">Требуемое действие</dt>
          <dd className="mt-1 font-medium text-slate-900">
            {health?.actionRequired === 'none' ? 'Не требуется' : STATUS_LABELS[health?.status ?? 'disconnected']}
          </dd>
        </div>
      </dl>

      {canManage && (
        <div className="mt-6 flex flex-wrap gap-3">
          {!connected && health?.status !== 'authorization_pending' && (
            <button
              type="button"
              onClick={() => void connect()}
              disabled={busy}
              className="rounded-lg bg-slate-900 px-4 py-2 text-sm font-medium text-white disabled:opacity-50"
            >
              {connecting ? 'Подключение…' : 'Подключить amoCRM'}
            </button>
          )}
          {health?.integrationAccountId && (
            <button
              type="button"
              onClick={() => void reconnect()}
              disabled={busy}
              className="rounded-lg border border-slate-300 px-4 py-2 text-sm font-medium text-slate-800 disabled:opacity-50"
            >
              {reconnecting ? 'Переподключение…' : 'Переподключить'}
            </button>
          )}
          <button
            type="button"
            onClick={() => void check()}
            disabled={busy}
            className="inline-flex items-center gap-2 rounded-lg border border-slate-300 px-4 py-2 text-sm font-medium text-slate-800 disabled:opacity-50"
          >
            <RefreshCw className="h-4 w-4" aria-hidden="true" />
            {checking ? 'Проверка…' : 'Проверить состояние'}
          </button>
          {health?.canDisconnect && (
            <button
              type="button"
              onClick={() => void disconnect()}
              disabled={busy}
              className="inline-flex items-center gap-2 rounded-lg border border-red-200 px-4 py-2 text-sm font-medium text-red-700 disabled:opacity-50"
            >
              <Unplug className="h-4 w-4" aria-hidden="true" />
              {disconnecting ? 'Отключение…' : 'Отключить'}
            </button>
          )}
        </div>
      )}

      <div className="mt-6 space-y-2 rounded-lg bg-slate-50 p-4 text-sm text-slate-700">
        <p>Подключение действует только для текущей клиники.</p>
        <p>DentalFlow не отправляет сообщения и не синхронизирует данные в рамках этой версии.</p>
        <p>Никогда не вводите токены amoCRM вручную в интерфейс DentalFlow.</p>
      </div>
    </section>
  );
}

export function AmoCrmIntegrationSettings() {
  const model = useAmoCrmIntegration();
  return <AmoCrmIntegrationSettingsView model={model} />;
}
