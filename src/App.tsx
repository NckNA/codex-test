import { BrowserRouter, Routes, Route } from 'react-router-dom';
import { useAuth } from './contexts/AuthContext';
import { useTenant } from './contexts/TenantContext';
import { LoginPage } from './pages/LoginPage';
import { Layout } from './components/layout/Layout';
import { SchedulePage } from './pages/SchedulePage';
import { ReminderOperationsPage } from './pages/ReminderOperationsPage';
import { CommunicationDiagnosticsPage } from './pages/CommunicationDiagnosticsPage';
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

function AppContent() {
  const { authMode, isLoading: authLoading, user, signOut } = useAuth();
  const { activeTenant, availableTenants, isLoading: tenantLoading, error: tenantError } = useTenant();

  // B) Supabase active + loading
  if (authMode === 'supabase-active' && authLoading) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  // C) Supabase active + no user
  if (authMode === 'supabase-active' && !user) {
    return <LoginPage />;
  }

  // Tenant loading/error/blocked states for supabase-active authenticated users
  if (authMode === 'supabase-active' && user) {
    if (tenantLoading) {
      return (
        <div className="min-h-screen bg-slate-50 flex flex-col items-center justify-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mb-4"></div>
          <p className="text-slate-600 font-medium">Загрузка клиники...</p>
        </div>
      );
    }

    if (tenantError) {
      return (
        <div className="min-h-screen bg-slate-50 flex flex-col items-center justify-center p-4 text-center">
          <div className="bg-white p-8 rounded-xl shadow-sm max-w-md w-full border border-red-100">
            <h1 className="text-xl font-bold text-red-600 mb-2">Не удалось загрузить клинику</h1>
            <p className="text-slate-600 mb-4">
              Попробуйте выйти и войти снова. Если ошибка повторится, обратитесь к администратору.
            </p>
            <p className="text-xs text-slate-400 mb-6">{tenantError.message}</p>
            <button
              onClick={() => void signOut()}
              className="px-4 py-2 bg-slate-100 text-slate-700 rounded-lg hover:bg-slate-200 transition-colors w-full font-medium"
            >
              Выйти
            </button>
          </div>
        </div>
      );
    }

    if (!activeTenant && availableTenants.length === 0) {
      return (
        <div className="min-h-screen bg-slate-50 flex flex-col items-center justify-center p-4 text-center">
          <div className="bg-white p-8 rounded-xl shadow-sm max-w-md w-full border border-slate-100">
            <h1 className="text-xl font-bold text-slate-800 mb-2">Клиника не назначена</h1>
            <p className="text-slate-600 mb-6">
              Ваш пользователь авторизован, но не привязан ни к одной клинике. Обратитесь к администратору.
            </p>
            <button
              onClick={() => void signOut()}
              className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors w-full font-medium"
            >
              Выйти
            </button>
          </div>
        </div>
      );
    }
  }

  // A & D) Dev mode OR Supabase active + user exists + activeTenant exists
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<Layout />}>
          <Route index element={<SchedulePage />} />
          <Route path="reminders" element={<ReminderOperationsPage />} />
          <Route path="communications" element={<CommunicationDiagnosticsPage />} />
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
      </Routes>
    </BrowserRouter>
  );
}

export function App() {
  return (
    <ClinicalDictionariesProvider>
      <AppContent />
    </ClinicalDictionariesProvider>
  );
}
