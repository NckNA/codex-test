export type QaLoginShortcutEnv = Readonly<{
  DEV?: boolean;
  VITE_ENABLE_QA_LOGIN_SHORTCUT?: string;
  VITE_QA_USER_PASS?: string;
}>;

export type QaLoginShortcutUser = Readonly<{
  email: string;
  label: string;
  roleLabel: string;
}>;

export const QA_LOGIN_SHORTCUT_USERS: readonly QaLoginShortcutUser[] = [
  { email: 'qa.admin.a@example.local', label: 'Admin A', roleLabel: 'Demo Clinic A / Администратор клиники' },
  { email: 'qa.doctor.a@example.local', label: 'Doctor A', roleLabel: 'Demo Clinic A / Врач' },
  { email: 'qa.receptionist.a@example.local', label: 'Registrar A', roleLabel: 'Demo Clinic A / Регистратор' },
  { email: 'qa.cashier.a@example.local', label: 'Cashier A', roleLabel: 'Demo Clinic A / Кассир' },
  { email: 'qa.notenant@example.local', label: 'No-tenant', roleLabel: 'Без клиники' },
  { email: 'qa.multitenant@example.local', label: 'Multi-tenant', roleLabel: 'Clinic A админ + Clinic B врач' },
  { email: 'qa.admin.b@example.local', label: 'Admin B', roleLabel: 'Demo Clinic B / Администратор клиники' },
] as const;

export function isLocalDevHostname(hostname: string): boolean {
  return hostname === 'localhost' || hostname === '127.0.0.1';
}
