import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { BrowserRouter, Routes, Route } from 'react-router-dom';
import './index.css';

import { Layout } from './components/layout/Layout';
import { SchedulePage } from './pages/SchedulePage';
import { CrmPage } from './pages/CrmPage';
import { AppointmentsPage } from './pages/AppointmentsPage';
import { DocumentsPage } from './pages/DocumentsPage';
import { PatientsPage } from './pages/PatientsPage';
import { DoctorsPage } from './pages/DoctorsPage';
import { MedicalPage } from './pages/MedicalPage';
import { FinancePage } from './pages/FinancePage';
import { WarehousePage } from './pages/WarehousePage';
import { StatisticsPage } from './pages/StatisticsPage';
import { ReportsPage } from './pages/ReportsPage';
import { BonusPage } from './pages/BonusPage';
import { MailingPage } from './pages/MailingPage';
import { SmsPage } from './pages/SmsPage';
import { SettingsPage } from './pages/SettingsPage';
import { storage } from './utils/storage';

// Initialize localStorage seed data if not present
storage.init();

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<Layout />}>
          <Route index element={<SchedulePage />} />
          <Route path="crm" element={<CrmPage />} />
          <Route path="appointments" element={<AppointmentsPage />} />
          <Route path="documents" element={<DocumentsPage />} />
          <Route path="patients" element={<PatientsPage />} />
          <Route path="doctors" element={<DoctorsPage />} />
          <Route path="medical" element={<MedicalPage />} />
          <Route path="finance" element={<FinancePage />} />
          <Route path="warehouse" element={<WarehousePage />} />
          <Route path="statistics" element={<StatisticsPage />} />
          <Route path="reports" element={<ReportsPage />} />
          <Route path="bonus" element={<BonusPage />} />
          <Route path="mailing" element={<MailingPage />} />
          <Route path="sms" element={<SmsPage />} />
          <Route path="settings" element={<SettingsPage />} />
        </Route>
      </Routes>
    </BrowserRouter>
  </StrictMode>
);
