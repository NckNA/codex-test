import { describe, it, expect } from 'vitest';
import { createChiefComplaintRepository, LocalStorageChiefComplaintRepository } from './ChiefComplaintRepository';

describe('ChiefComplaintRepository Factory', () => {
  it('returns LocalStorageChiefComplaintRepository by default', () => {
    const repo = createChiefComplaintRepository();
    expect(repo).toBe(LocalStorageChiefComplaintRepository);
  });

  it('returns LocalStorageChiefComplaintRepository even when tenantId is provided', () => {
    // This locks current localStorage-only fallback until a future explicit Supabase task.
    // Passing a tenantId must not change backend behavior yet.
    const repo = createChiefComplaintRepository('11111111-1111-1111-1111-111111111111');
    expect(repo).toBe(LocalStorageChiefComplaintRepository);
  });
});
