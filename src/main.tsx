import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { BrowserRouter, Routes, Route } from 'react-router-dom';
import './index.css';

import { Layout } from './components/layout/Layout';
// We will import pages in the next step, using placeholders for now
import { SchedulePage } from './pages/SchedulePage';
import { PlaceholderPage } from './pages/PlaceholderPage';

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<Layout />}>
          <Route index element={<SchedulePage />} />
          <Route path="crm" element={<PlaceholderPage title="CRM" />} />
          <Route path="appointments" element={<PlaceholderPage title="Приёмы" />} />
          <Route path="documents" element={<PlaceholderPage title="Документы" />} />
          <Route path="patients" element={<PlaceholderPage title="Пациенты" />} />
          <Route path="doctors" element={<PlaceholderPage title="Врачи" />} />
          <Route path="medical" element={<PlaceholderPage title="Врачебная часть" />} />
          <Route path="finance" element={<PlaceholderPage title="Финансы" />} />
          <Route path="warehouse" element={<PlaceholderPage title="Склад" />} />
          <Route path="statistics" element={<PlaceholderPage title="Статистика" />} />
          <Route path="reports" element={<PlaceholderPage title="Отчёты" />} />
          <Route path="bonus" element={<PlaceholderPage title="Бонусная система" />} />
          <Route path="mailing" element={<PlaceholderPage title="Рассылка" />} />
          <Route path="sms" element={<PlaceholderPage title="СМС" />} />
          <Route path="settings" element={<PlaceholderPage title="Настройки" />} />
        </Route>
      </Routes>
    </BrowserRouter>
  </StrictMode>
);
