import { AlertTriangle, ShieldCheck } from 'lucide-react';
import { AdminAuditViewer } from '../components/admin/AdminAuditViewer';
import { useAuth } from '../contexts/AuthContext';
import { useTenant } from '../contexts/TenantContext';
import { isSupabaseConfigured } from '../lib/supabaseClient';
import { canViewAdminAudit } from '../data/hooks/useAuditActivityEvents';

export function AdminAuditPage() {
  const { authMode } = useAuth();
  const { activeTenant } = useTenant();
  const tenantId = activeTenant?.tenantId;
  const role = activeTenant?.role;

  if (!tenantId) {
    return (
      <div className="mx-auto max-w-4xl p-4 md:p-8">
        <div className="rounded-xl border border-amber-200 bg-amber-50 p-6 text-amber-800">
          <div className="flex items-start gap-3">
            <AlertTriangle className="mt-0.5 h-5 w-5 shrink-0" />
            <div>
              <h1 className="font-semibold">Клиника не назначена</h1>
              <p className="mt-1 text-sm">Журнал действий доступен только пользователям активной клиники.</p>
            </div>
          </div>
        </div>
      </div>
    );
  }

  if (!canViewAdminAudit(role)) {
    return (
      <div className="mx-auto max-w-4xl p-4 md:p-8">
        <div className="rounded-xl border border-red-200 bg-red-50 p-6 text-red-700">
          <div className="flex items-start gap-3">
            <ShieldCheck className="mt-0.5 h-5 w-5 shrink-0" />
            <div>
              <h1 className="font-semibold">Доступ запрещён</h1>
              <p className="mt-1 text-sm">Журнал аудита доступен только владельцу или администратору клиники.</p>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-7xl p-4 md:p-8">
      <AdminAuditViewer
        tenantId={tenantId}
        role={role ?? ''}
        backendAvailable={authMode === 'supabase-active' && isSupabaseConfigured}
      />
    </div>
  );
}
