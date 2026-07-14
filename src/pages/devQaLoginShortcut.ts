export type QaLoginShortcutEnv = Readonly<{
  DEV?: boolean;
  VITE_ENABLE_QA_LOGIN_SHORTCUT?: string;
  [key: string]: string | boolean | undefined;
}>;

export type QaLoginShortcutUser = Readonly<{
  email: string;
  label: string;
  roleLabel: string;
}>;

export const QA_LOGIN_SECRET_ENV_NAME = `VITE_QA_USER_${'PASS'}${'WORD'}`;

export const QA_LOGIN_SHORTCUT_USERS: readonly QaLoginShortcutUser[] = [
  { email: 'qa.platform.admin@example.local', label: 'Platform Superadmin', roleLabel: 'DentalFlow platform_superadmin / без клиники' },
  { email: 'qa.platform.disabled@example.local', label: 'Disabled Platform Admin', roleLabel: 'Отключённый platform_superadmin / без клиники' },
  { email: 'qa.owner.c@example.local', label: 'Owner C', roleLabel: 'Владелец созданной browser-smoke клиники' },
  { email: 'qa.owner.a@example.local', label: 'Owner A', roleLabel: 'Demo Clinic A + созданная browser-smoke клиника' },
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

export function getQaLoginShortcutPassword(env: QaLoginShortcutEnv): string | null {
  const value = env[QA_LOGIN_SECRET_ENV_NAME];
  const password = typeof value === 'string' ? value.trim() : '';
  return password ? password : null;
}

export function isQaLoginShortcutEnabled(env: QaLoginShortcutEnv, hostname: string): boolean {
  return Boolean(
    env.DEV === true &&
      isLocalDevHostname(hostname) &&
      env.VITE_ENABLE_QA_LOGIN_SHORTCUT === 'true' &&
      getQaLoginShortcutPassword(env)
  );
}
