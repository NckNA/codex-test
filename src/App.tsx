import { BrowserRouter, Navigate, Route, Routes, useLocation } from 'react-router-dom';
import { useAuth } from './contexts/AuthContext';
import { useTenant } from './contexts/TenantContext';
import { LoginPage } from './pages/LoginPage';
import { Layout } from './components/layout/Layout';
import { PlatformLayout } from './components/platform/PlatformLayout';
import { SchedulePage } from './pages/SchedulePage';
import { ReminderOperationsPage } from './pages/ReminderOperationsPage';
import { CommunicationDiagnosticsPage } from './pages/CommunicationDiagnosticsPage';
import { CommunicationTemplatesPage } from './pages/CommunicationTemplatesPage';
import { CrmPage } from './pages/CrmPage';
import { AppointmentsPage } from './pages/AppointmentsPage';
import { DocumentsPage } from './pages/DocumentsPage';
import { PatientsPage } from './pages/PatientsPage';
import { DoctorsPage } from './pages/DoctorsPage';
import { MedicalPage } from './pages/MedicalPage';
import { FinancePage } from './pages/FinancePage';
import { CashierPaymentPage } from './pages/CashierPaymentPage';
import { WarehousePage } from './pages/WarehousePage';
import { StatisticsPage } from './pages/StatisticsPage';
import { ReportsPage } from './pages/ReportsPage';
import { BonusPage } from './pages/BonusPage';
import { MailingPage } from './pages/MailingPage';
import { SmsPage } from './pages/SmsPage';
import { SettingsPage } from './pages/SettingsPage';
import { AdminAuditPage } from './pages/AdminAuditPage';
import { PatientCardPage } from './pages/PatientCardPage';
import { ClinicalDictionariesProvider } from './data/hooks/useDictionaries';
import { PlatformTenantsPage } from './pages/platform/PlatformTenantsPage';
import { PlatformTenantDetailsPage } from './pages/platform/PlatformTenantDetailsPage';
import { TenantAccessBlockedPage } from './pages/TenantAccessBlockedPage';

function LoadingPage() {
  return <div className="min-h-screen bg-slate-50 flex items-center justify-center"><div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600" /></div>;
}

function AccessErrorPage({ message, signOut }: { message: string; signOut: () => Promise<void> }) {
  return <div className="min-h-screen bg-slate-50 flex items-center justify-center p-4 text-center"><div className="bg-white p-8 rounded-xl shadow-sm max-w-md w-full border border-red-100"><h1 className="text-xl font-bold text-red-600 mb-2">Доступ недоступен</h1><p className="text-slate-600 mb-6">{message}</p><button onClick={() => void signOut()} className="px-4 py-2 bg-slate-100 text-slate-700 rounded-lg w-full font-medium">Выйти</button></div></div>;
}

function ClinicLayoutRoute() {
  return <ClinicalDictionariesProvider><Layout /></ClinicalDictionariesProvider>;
}

function AppContent() {
  const location = useLocation();
  const { authMode, isLoading: authLoading, user, signOut } = useAuth();
  const { activeTenant, availableTenants, isPlatformSuperadmin, isLoading: tenantLoading, error: tenantError } = useTenant();
  const platformPath = location.pathname.startsWith('/platform');

  if (authMode === 'supabase-active' && authLoading) return <LoadingPage />;
  if (authMode === 'supabase-active' && !user) return <LoginPage />;

  if (authMode === 'supabase-active' && user) {
    if (tenantLoading) return <LoadingPage />;
    if (tenantError) return <AccessErrorPage message="Не удалось проверить доступ к клиникам и платформе." signOut={signOut} />;
    if (platformPath && !isPlatformSuperadmin) return <AccessErrorPage message="Недостаточно прав для управления платформой." signOut={signOut} />;
    if (!platformPath && !activeTenant && isPlatformSuperadmin) return <Navigate to="/platform/tenants" replace />;
    if (!platformPath && !activeTenant && availableTenants.length === 0) return <AccessErrorPage message="Для пользователя не назначена клиника." signOut={signOut} />;
    if (!platformPath && activeTenant && activeTenant.operationalAccessAllowed === false) return <TenantAccessBlockedPage />;
  }

  return <Routes>
    <Route path="/platform" element={isPlatformSuperadmin ? <PlatformLayout /> : <Navigate to="/" replace />}>
      <Route index element={<Navigate to="tenants" replace />} />
      <Route path="tenants" element={<PlatformTenantsPage />} />
      <Route path="tenants/:tenantId" element={<PlatformTenantDetailsPage />} />
    </Route>
    <Route path="/" element={<ClinicLayoutRoute />}>
      <Route index element={<SchedulePage />} />
      <Route path="reminders" element={<ReminderOperationsPage />} />
      <Route path="communications" element={<CommunicationDiagnosticsPage />} />
      <Route path="communication-templates" element={<CommunicationTemplatesPage />} />
      <Route path="crm" element={<CrmPage />} />
      <Route path="appointments" element={<AppointmentsPage />} />
      <Route path="documents" element={<DocumentsPage />} />
      <Route path="patients" element={<PatientsPage />} />
      <Route path="patients/:patientId" element={<PatientCardPage />} />
      <Route path="doctors" element={<DoctorsPage />} />
      <Route path="medical" element={<MedicalPage />} />
      <Route path="finance" element={<FinancePage />} />
      <Route path="cashier/payments" element={<CashierPaymentPage />} />
      <Route path="warehouse" element={<WarehousePage />} />
      <Route path="statistics" element={<StatisticsPage />} />
      <Route path="reports" element={<ReportsPage />} />
      <Route path="bonus" element={<BonusPage />} />
      <Route path="mailing" element={<MailingPage />} />
      <Route path="sms" element={<SmsPage />} />
      <Route path="settings" element={<SettingsPage />} />
      <Route path="admin/audit" element={<AdminAuditPage />} />
    </Route>
    <Route path="*" element={<Navigate to={isPlatformSuperadmin ? '/platform/tenants' : '/'} replace />} />
  </Routes>;
}

export function App() {
  return <BrowserRouter><AppContent /></BrowserRouter>;
}
