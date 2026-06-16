import { describe, expect, it } from 'vitest';
import { getClinicRoleLabel, getPlatformRoleLabel, getRoleLabel } from './roleLabels';

describe('roleLabels', () => {
  it('maps clinic roles to Russian clinic labels', () => {
    expect(getClinicRoleLabel('clinic_owner')).toBe('Владелец клиники');
    expect(getClinicRoleLabel('clinic_admin')).toBe('Администратор клиники');
    expect(getClinicRoleLabel('doctor')).toBe('Врач');
    expect(getClinicRoleLabel('receptionist')).toBe('Регистратор');
    expect(getClinicRoleLabel('registrar')).toBe('Регистратор');
    expect(getClinicRoleLabel('cashier')).toBe('Кассир');
  });

  it('maps platform roles only through platform labels', () => {
    expect(getPlatformRoleLabel('platform_owner')).toBe('Владелец платформы');
    expect(getPlatformRoleLabel('platform_admin')).toBe('Администратор платформы');
    expect(getPlatformRoleLabel('platform_support')).toBe('Поддержка платформы');
    expect(getPlatformRoleLabel('support')).toBe('Поддержка платформы');
  });

  it('uses safe fallbacks for missing and unknown roles', () => {
    expect(getClinicRoleLabel(null)).toBe('Роль не назначена');
    expect(getClinicRoleLabel(undefined)).toBe('Роль не назначена');
    expect(getClinicRoleLabel('')).toBe('Роль не назначена');
    expect(getClinicRoleLabel('   ')).toBe('Роль не назначена');
    expect(getClinicRoleLabel('mystery_role')).toBe('Неизвестная роль');
  });

  it('never maps non-admin clinic users or no-tenant role to generic admin', () => {
    expect(getClinicRoleLabel('doctor')).not.toBe('Администратор');
    expect(getClinicRoleLabel('receptionist')).not.toBe('Администратор');
    expect(getClinicRoleLabel('registrar')).not.toBe('Администратор');
    expect(getClinicRoleLabel(null)).not.toBe('Администратор');
  });

  it('keeps clinic and platform contexts separate', () => {
    expect(getRoleLabel('clinic_admin', 'clinic')).toBe('Администратор клиники');
    expect(getRoleLabel('platform_admin', 'platform')).toBe('Администратор платформы');
    expect(getRoleLabel('platform_admin', 'clinic')).toBe('Неизвестная роль');
    expect(getRoleLabel('clinic_admin', 'platform')).toBe('Неизвестная роль');
  });
});
