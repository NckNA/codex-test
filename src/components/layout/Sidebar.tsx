import { NavLink } from 'react-router-dom';
import { clsx } from 'clsx';
import {
  CalendarDays,
  BellRing,
  FlaskConical,
  Users,
  ClipboardList,
  FileText,
  UserSquare2,
  Stethoscope,
  HeartPulse,
  Banknote,
  ReceiptText,
  Package,
  BarChart3,
  PieChart,
  Gift,
  Mail,
  MessageSquare,
  Settings,
  ShieldCheck,
} from 'lucide-react';
import { useTenant } from '../../contexts/TenantContext';
import { canViewAdminAudit } from '../../data/hooks/useAuditActivityEvents';

const navItems = [
  { to: '/', icon: CalendarDays, label: 'Расписание' },
  { to: '/crm', icon: Users, label: 'CRM' },
  { to: '/appointments', icon: ClipboardList, label: 'Приёмы' },
  { to: '/documents', icon: FileText, label: 'Документы' },
  { to: '/patients', icon: UserSquare2, label: 'Пациенты' },
  { to: '/doctors', icon: Stethoscope, label: 'Врачи' },
  { to: '/medical', icon: HeartPulse, label: 'Клинические справочники' },
  { to: '/finance', icon: Banknote, label: 'Финансы' },
  { to: '/cashier/payments', icon: ReceiptText, label: 'Касса' },
  { to: '/warehouse', icon: Package, label: 'Склад' },
  { to: '/statistics', icon: BarChart3, label: 'Статистика' },
  { to: '/reports', icon: PieChart, label: 'Отчёты' },
  { to: '/bonus', icon: Gift, label: 'Бонусная система' },
  { to: '/mailing', icon: Mail, label: 'Рассылка' },
  { to: '/sms', icon: MessageSquare, label: 'СМС' },
  { to: '/settings', icon: Settings, label: 'Настройки' },
];

const adminNavItems = [
  { to: '/admin/audit', icon: ShieldCheck, label: 'Журнал действий' },
];

export function Sidebar() {
  const { activeTenant } = useTenant();
  const canUseReminderOperations = !activeTenant
    || ['clinic_owner', 'clinic_admin', 'registrar'].includes(activeTenant.role ?? '');
  const reminderItems = canUseReminderOperations
    ? [
        { to: '/reminders', icon: BellRing, label: 'Напоминания' },
        { to: '/communications', icon: FlaskConical, label: 'Коммуникации' },
        { to: '/communication-templates', icon: FileText, label: 'Шаблоны сообщений' },
      ]
    : [];
  const operationalItems = [navItems[0], ...reminderItems, ...navItems.slice(1)];
  const visibleItems = canViewAdminAudit(activeTenant?.role)
    ? [...operationalItems, ...adminNavItems]
    : operationalItems;

  return (
    <aside className="w-64 bg-slate-900 text-slate-300 flex flex-col h-full overflow-y-auto shrink-0 border-r border-slate-800">
      <div className="p-4 border-b border-slate-800/50 sticky top-0 bg-slate-900 z-10">
        <h1 className="text-xl font-bold text-white flex items-center gap-2">
          <div className="w-8 h-8 bg-blue-600 rounded-lg flex items-center justify-center">
            <span className="text-white font-bold text-lg">DF</span>
          </div>
          DentalFlow
        </h1>
      </div>
      <nav className="flex-1 py-4">
        <ul className="space-y-1 px-2">
          {visibleItems.map((item) => (
            <li key={item.to}>
              <NavLink
                to={item.to}
                className={({ isActive }) =>
                  clsx(
                    'flex items-center gap-3 px-3 py-2 rounded-md transition-colors text-sm font-medium',
                    isActive
                      ? 'bg-blue-600/10 text-blue-400'
                      : 'hover:bg-slate-800/50 hover:text-slate-100'
                  )
                }
              >
                <item.icon className="w-5 h-5 shrink-0" />
                <span>{item.label}</span>
              </NavLink>
            </li>
          ))}
        </ul>
      </nav>
    </aside>
  );
}
