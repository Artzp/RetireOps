/**
 * LIRA Module Tests
 * @see docs/source-of-truth/02-account-types.md - LIRA Section
 */
import { describe, it, expect } from 'vitest';
import {
  canConvertLIRAToLIF,
  mustConvertLIRAToLIF,
  getMinimumConversionAge,
  convertLIRAToLIF,
  canUseOneTimeUnlock,
  calculateOneTimeUnlockAmount,
  canUseSmallBalanceUnlock,
  getSmallBalanceThreshold,
  allowsFinancialHardshipUnlock,
  allowsShortenedLifeUnlock,
  yearsUntilMandatoryConversion,
  shouldAutoConvertLIRA,
} from './lira.js';

describe('LIRA Module', () => {
  describe('canConvertLIRAToLIF', () => {
    /**
     * @see docs/source-of-truth/02-account-types.md - TC-LIRA-001
     */
    it('should allow conversion at age 55 for federal jurisdiction', () => {
      expect(canConvertLIRAToLIF(55, 'federal')).toBe(true);
      expect(canConvertLIRAToLIF(54, 'federal')).toBe(false);
    });

    it('should allow conversion at age 50 for Alberta', () => {
      expect(canConvertLIRAToLIF(50, 'AB')).toBe(true);
      expect(canConvertLIRAToLIF(49, 'AB')).toBe(false);
    });

    it('should allow conversion at age 55 for Ontario', () => {
      expect(canConvertLIRAToLIF(55, 'ON')).toBe(true);
      expect(canConvertLIRAToLIF(54, 'ON')).toBe(false);
    });

    it('should allow conversion at any age 55+ for most provinces', () => {
      const provinces = ['BC', 'MB', 'NB', 'NL', 'NS', 'PE', 'QC', 'SK'] as const;
      for (const province of provinces) {
        expect(canConvertLIRAToLIF(55, province)).toBe(true);
        expect(canConvertLIRAToLIF(54, province)).toBe(false);
      }
    });
  });

  describe('mustConvertLIRAToLIF', () => {
    /**
     * @see docs/source-of-truth/02-account-types.md - TC-LIRA-002
     */
    it('should require conversion at age 71', () => {
      expect(mustConvertLIRAToLIF(71)).toBe(true);
      expect(mustConvertLIRAToLIF(70)).toBe(false);
    });

    it('should require conversion after age 71', () => {
      expect(mustConvertLIRAToLIF(72)).toBe(true);
      expect(mustConvertLIRAToLIF(85)).toBe(true);
    });
  });

  describe('getMinimumConversionAge', () => {
    it('should return 55 for federal jurisdiction', () => {
      expect(getMinimumConversionAge('federal')).toBe(55);
    });

    it('should return 50 for Alberta', () => {
      expect(getMinimumConversionAge('AB')).toBe(50);
    });

    it('should return 55 for Ontario', () => {
      expect(getMinimumConversionAge('ON')).toBe(55);
    });
  });

  describe('convertLIRAToLIF', () => {
    it('should convert LIRA balance to LIF', () => {
      const result = convertLIRAToLIF(100000, 2024, 'federal');

      expect(result.lifBalance).toBe(100000);
      expect(result.unlockedAmount).toBe(0);
      expect(result.conversionYear).toBe(2024);
      expect(result.firstWithdrawalYear).toBe(2025);
      expect(result.jurisdiction).toBe('federal');
    });

    it('should apply one-time unlocking when requested in Ontario', () => {
      const result = convertLIRAToLIF(100000, 2024, 'ON', true);

      expect(result.unlockedAmount).toBe(50000); // 50% unlock
      expect(result.lifBalance).toBe(50000);
    });

    it('should not unlock for federal jurisdiction even when requested', () => {
      const result = convertLIRAToLIF(100000, 2024, 'federal', true);

      expect(result.unlockedAmount).toBe(0);
      expect(result.lifBalance).toBe(100000);
    });
  });

  describe('canUseOneTimeUnlock', () => {
    /**
     * @see docs/source-of-truth/02-account-types.md - TC-UNLOCK-001
     */
    it('should allow one-time unlock in Ontario', () => {
      expect(canUseOneTimeUnlock('ON', false)).toBe(true);
    });

    /**
     * @see docs/source-of-truth/02-account-types.md - TC-UNLOCK-002
     */
    it('should not allow one-time unlock for federal jurisdiction', () => {
      expect(canUseOneTimeUnlock('federal', false)).toBe(false);
    });

    it('should allow one-time unlock in Alberta', () => {
      expect(canUseOneTimeUnlock('AB', false)).toBe(true);
    });

    it('should allow one-time unlock in Saskatchewan', () => {
      expect(canUseOneTimeUnlock('SK', false)).toBe(true);
    });

    it('should not allow unlock in BC', () => {
      expect(canUseOneTimeUnlock('BC', false)).toBe(false);
    });

    it('should not allow unlock if already used', () => {
      expect(canUseOneTimeUnlock('ON', true)).toBe(false);
      expect(canUseOneTimeUnlock('AB', true)).toBe(false);
    });
  });

  describe('calculateOneTimeUnlockAmount', () => {
    it('should calculate 50% unlock for Ontario', () => {
      const result = calculateOneTimeUnlockAmount(100000, 'ON', false);

      expect(result.unlockedAmount).toBe(50000);
      expect(result.remainingBalance).toBe(50000);
      expect(result.percentageUnlocked).toBe(0.5);
    });

    it('should calculate 50% unlock for Alberta', () => {
      const result = calculateOneTimeUnlockAmount(200000, 'AB', false);

      expect(result.unlockedAmount).toBe(100000);
      expect(result.remainingBalance).toBe(100000);
      expect(result.percentageUnlocked).toBe(0.5);
    });

    it('should return zero for federal jurisdiction', () => {
      const result = calculateOneTimeUnlockAmount(100000, 'federal', false);

      expect(result.unlockedAmount).toBe(0);
      expect(result.remainingBalance).toBe(100000);
      expect(result.percentageUnlocked).toBe(0);
    });

    it('should return zero if already unlocked', () => {
      const result = calculateOneTimeUnlockAmount(100000, 'ON', true);

      expect(result.unlockedAmount).toBe(0);
      expect(result.remainingBalance).toBe(100000);
    });
  });

  describe('canUseSmallBalanceUnlock', () => {
    it('should allow small balance unlock in Ontario when below threshold', () => {
      expect(canUseSmallBalanceUnlock(20000, 'ON')).toBe(true);
      expect(canUseSmallBalanceUnlock(23480, 'ON')).toBe(true);
      expect(canUseSmallBalanceUnlock(30000, 'ON')).toBe(false);
    });

    it('should allow small balance unlock in Manitoba when below threshold', () => {
      expect(canUseSmallBalanceUnlock(20000, 'MB')).toBe(true);
      expect(canUseSmallBalanceUnlock(30000, 'MB')).toBe(false);
    });

    it('should not allow small balance unlock in BC (no threshold)', () => {
      expect(canUseSmallBalanceUnlock(10000, 'BC')).toBe(false);
    });

    it('should not allow small balance unlock for federal (no threshold)', () => {
      expect(canUseSmallBalanceUnlock(10000, 'federal')).toBe(false);
    });
  });

  describe('getSmallBalanceThreshold', () => {
    it('should return threshold for Ontario', () => {
      expect(getSmallBalanceThreshold('ON')).toBe(23480);
    });

    it('should return undefined for federal', () => {
      expect(getSmallBalanceThreshold('federal')).toBeUndefined();
    });

    it('should return undefined for BC', () => {
      expect(getSmallBalanceThreshold('BC')).toBeUndefined();
    });
  });

  describe('allowsFinancialHardshipUnlock', () => {
    it('should allow financial hardship unlock in all jurisdictions', () => {
      const jurisdictions = [
        'federal',
        'AB',
        'BC',
        'MB',
        'NB',
        'NL',
        'NS',
        'ON',
        'PE',
        'QC',
        'SK',
      ] as const;

      for (const jurisdiction of jurisdictions) {
        expect(allowsFinancialHardshipUnlock(jurisdiction)).toBe(true);
      }
    });
  });

  describe('allowsShortenedLifeUnlock', () => {
    it('should allow shortened life unlock in all jurisdictions', () => {
      const jurisdictions = [
        'federal',
        'AB',
        'BC',
        'MB',
        'NB',
        'NL',
        'NS',
        'ON',
        'PE',
        'QC',
        'SK',
      ] as const;

      for (const jurisdiction of jurisdictions) {
        expect(allowsShortenedLifeUnlock(jurisdiction)).toBe(true);
      }
    });
  });

  describe('yearsUntilMandatoryConversion', () => {
    it('should calculate years until mandatory conversion', () => {
      expect(yearsUntilMandatoryConversion(55)).toBe(16);
      expect(yearsUntilMandatoryConversion(65)).toBe(6);
      expect(yearsUntilMandatoryConversion(71)).toBe(0);
      expect(yearsUntilMandatoryConversion(75)).toBe(0);
    });
  });

  describe('shouldAutoConvertLIRA', () => {
    it('should auto-convert at age 71 with positive balance', () => {
      expect(shouldAutoConvertLIRA(71, 100000)).toBe(true);
    });

    it('should not auto-convert before age 71', () => {
      expect(shouldAutoConvertLIRA(70, 100000)).toBe(false);
    });

    it('should not auto-convert with zero balance', () => {
      expect(shouldAutoConvertLIRA(71, 0)).toBe(false);
    });

    it('should auto-convert after age 71', () => {
      expect(shouldAutoConvertLIRA(72, 50000)).toBe(true);
    });
  });
});
