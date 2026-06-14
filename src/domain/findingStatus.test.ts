import { describe, it, expect } from 'vitest';
import {
  normalizeFindingStatus,
  isActiveFindingStatus,
} from './findingStatus';

describe('findingStatus domain logic', () => {
  describe('normalizeFindingStatus', () => {
    it('accepts canonical statuses', () => {
      expect(normalizeFindingStatus('discovered')).toBe('discovered');
      expect(normalizeFindingStatus('planned')).toBe('planned');
      expect(normalizeFindingStatus('in_treatment')).toBe('in_treatment');
      expect(normalizeFindingStatus('completed')).toBe('completed');
      expect(normalizeFindingStatus('declined_by_patient')).toBe('declined_by_patient');
      expect(normalizeFindingStatus('monitoring')).toBe('monitoring');
      expect(normalizeFindingStatus('archived')).toBe('archived');
    });

    it('maps legacy statuses', () => {
      expect(normalizeFindingStatus('recommended')).toBe('discovered');
      expect(normalizeFindingStatus('included_in_plan')).toBe('planned');
      expect(normalizeFindingStatus('observing')).toBe('monitoring');
    });

    it('falls back safely for unknown statuses', () => {
      expect(normalizeFindingStatus('unknown')).toBe('discovered');
      expect(normalizeFindingStatus('')).toBe('discovered');
      expect(normalizeFindingStatus(null as unknown as string)).toBe('discovered');
      expect(normalizeFindingStatus(undefined)).toBe('discovered');
    });
  });

  describe('isActiveFindingStatus', () => {
    it('returns true for active statuses', () => {
      expect(isActiveFindingStatus('discovered')).toBe(true);
      expect(isActiveFindingStatus('planned')).toBe(true);
      expect(isActiveFindingStatus('in_treatment')).toBe(true);
      expect(isActiveFindingStatus('monitoring')).toBe(true);
    });

    it('returns false for inactive statuses', () => {
      expect(isActiveFindingStatus('completed')).toBe(false);
      expect(isActiveFindingStatus('declined_by_patient')).toBe(false);
      expect(isActiveFindingStatus('archived')).toBe(false);
    });

    it('handles legacy and unknown statuses', () => {
      expect(isActiveFindingStatus('recommended')).toBe(true); // normalizes to discovered
      expect(isActiveFindingStatus('observing')).toBe(true); // normalizes to monitoring
      expect(isActiveFindingStatus('unknown')).toBe(true); // normalizes to discovered
    });
  });
});
