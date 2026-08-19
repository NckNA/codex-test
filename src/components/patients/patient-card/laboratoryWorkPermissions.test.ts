import { describe, expect, it } from 'vitest';
import { getLaboratoryWorkRoleCapabilities } from './laboratoryWorkPermissions';

describe('getLaboratoryWorkRoleCapabilities', () => {
  it.each(['clinic_owner', 'clinic_admin'])('%s can create/edit/complete/reopen', (role) => {
    expect(getLaboratoryWorkRoleCapabilities(role)).toEqual({
      canView: true,
      canCreate: true,
      canEdit: true,
      canComplete: true,
      canReopen: true,
    });
  });

  it.each(['doctor', 'registrar'])('%s can mutate in-progress orders but cannot reopen', (role) => {
    expect(getLaboratoryWorkRoleCapabilities(role)).toEqual({
      canView: true,
      canCreate: true,
      canEdit: true,
      canComplete: true,
      canReopen: false,
    });
  });

  it.each(['cashier', 'marketer', 'support', undefined, null, 'unknown'])('%s has no laboratory work access', (role) => {
    expect(getLaboratoryWorkRoleCapabilities(role)).toEqual({
      canView: false,
      canCreate: false,
      canEdit: false,
      canComplete: false,
      canReopen: false,
    });
  });
});
