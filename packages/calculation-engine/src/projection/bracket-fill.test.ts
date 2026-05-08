/**
 * Bracket-Fill Withdrawal (TAX-05) — Phase 63
 * @see .planning/phases/63-bracket-fill-engine-surplus-sweep/63-CONTEXT.md
 * @see docs/source-of-truth/07-withdrawal-strategies.md
 */
import { describe, expect, it } from 'vitest';
import { calculateYear } from './yearly-calculator.js';
import type { YearInput } from './yearly-calculator.js';

/**
 * Factory for a retired person in 2026, age 68, with $300k RRSP.
 * Defaults: zero government benefits (CPP not started, OAS not started),
 * zero investment return (deterministic), zero spending (no income gap),
 * $7k TFSA room. Override per-test as needed.
 */
function makeYearInput(overrides?: Partial<YearInput>): YearInput {
  return {
    year: 2026,
    birthdate: new Date(1958, 0, 1), // age 68 in 2026 — retired, pre-RRIF (< 72)
    province: 'ON',
    // Account balances
    rrspBalance: 300000,
    rrifBalance: 0,
    tfsaBalance: 10000,
    nonRegBalance: 20000,
    nonRegACB: 0,
    // Contributions (pre-retirement only; zero here since retired)
    rrspContribution: 0,
    tfsaContribution: 0,
    availableTfsaContributionRoom: 7000,
    // Income sources — zeroed so guaranteedIncome is controlled per-test
    employmentIncome: 0,
    pensionIncome: 0,
    otherIncome: 0,
    // Government benefits — disabled so CPP/OAS don't add to guaranteedIncome
    expectedCPPAt65: 0,
    cppStartAge: 65,
    oasStartAge: 99, // far future → OAS not paid at age 68
    yearsOfResidence: 40,
    // Spending — zero so incomeGap = 0 (no step-8 withdrawals interfere with assertions)
    retirementSpending: 0,
    // Assumptions — deterministic (no growth noise)
    investmentReturn: 0,
    inflationRate: 0,
    retirementAge: 60, // age 68 > retirementAge 60 → isRetired = true
    yearsFromProjectionStart: 0,
    ...overrides,
  };
}

describe('Bracket Fill (TAX-05) — Phase 63', () => {
  /** @see TEST-01 — exact bracket-space fill with guaranteed income below ceiling */
  it('TEST-01: bracketFillWithdrawal equals bracketCeiling − guaranteedIncome', () => {
    // With guaranteed income = 0 and no OAS clawback risk (57375 < 95323 threshold),
    // the engine fills from $0 to the 2026 bottom bracket ceiling of $57375 (rate 14%).
    // RRSP has $300k — enough to cover the full fill.
    const input = makeYearInput({
      bracketFill: { enabled: true },
    });
    const result = calculateYear(input);

    // 2026 bracket[0]: { min: 0, max: 57375, rate: 0.14 }
    // guaranteedIncome = 0, bracketSpace = 57375, no clawback risk → fills fully
    expect(result.bracketFillWithdrawal).toBeCloseTo(57375, 2);
  });

  /** @see TEST-02 — MLT-03 OAS clawback gate skips fill when clawbackCost > taxSavings */
  it('TEST-02: MLT-03 gate — bracketFillWithdrawal is 0 when clawback cost exceeds tax savings', () => {
    // guaranteedIncome = pensionIncome = 101000 (in bracket[1]: 57375-114750 at 20.5%)
    // bracketSpace = 114750 - 101000 = 13750
    // OAS threshold 2026 = 95323
    // clawbackCost = 0.15 × (101000 + 13750 − 95323) = 0.15 × 19427 = 2914.05
    // taxSavings  = 13750 × 0.205 = 2818.75
    // 2914.05 > 2818.75 → MLT-03 gate fires → bracketFillWithdrawal = 0
    const input = makeYearInput({
      bracketFill: { enabled: true },
      pensionIncome: 101000,
    });
    const result = calculateYear(input);
    expect(result.bracketFillWithdrawal ?? 0).toBe(0);
  });

  /** @see TEST-03 — surplus sweep routing to TFSA (up to room) then non-reg */
  it('TEST-03: surplus sweep routes correctly between TFSA and non-registered', () => {
    // With retirementSpending=0, incomeGap=0, surplusFromBracketFill = bracketFillWithdrawal (57375).
    // No step-8 withdrawals since gap=0 → TFSA/non-reg changes are purely from sweep.

    // Sub-scenario (a): surplus < TFSA room — all surplus goes to TFSA
    // bracketFillWithdrawal = 57375; TFSA room = 7000 → 7000 to TFSA, 50375 to non-reg
    const inputA = makeYearInput({
      bracketFill: { enabled: true },
      availableTfsaContributionRoom: 7000,
    });
    const resultA = calculateYear(inputA);
    expect(resultA.tfsaBalance).toBe(10000 + 7000); // full room used
    expect(resultA.nonRegBalance).toBe(20000 + (57375 - 7000)); // remainder to non-reg

    // Sub-scenario (b): surplus > TFSA room — room to TFSA, rest to non-reg
    // TFSA room = 1000 → 1000 to TFSA, 56375 to non-reg
    const inputB = makeYearInput({
      bracketFill: { enabled: true },
      availableTfsaContributionRoom: 1000,
    });
    const resultB = calculateYear(inputB);
    expect(resultB.tfsaBalance).toBe(10000 + 1000); // capped at room
    expect(resultB.nonRegBalance).toBe(20000 + (57375 - 1000)); // full remainder
  });

  /** @see TEST-04 — guard conditions: working year and post-RRIF-conversion */
  it('TEST-04: bracketFillWithdrawal is 0 when !isRetired or currentRRSP === 0', () => {
    // Guard 1: still working (age 55 < retirementAge 65 → isRetired = false)
    const workingYear = makeYearInput({
      bracketFill: { enabled: true },
      birthdate: new Date(1971, 0, 1), // age 55 in 2026
      retirementAge: 65,
    });
    expect(calculateYear(workingYear).bracketFillWithdrawal ?? 0).toBe(0);

    // Guard 2: RRSP depleted (no balance to draw from)
    const noRrsp = makeYearInput({
      bracketFill: { enabled: true },
      rrspBalance: 0,
    });
    expect(calculateYear(noRrsp).bracketFillWithdrawal ?? 0).toBe(0);
  });

  /** @see TEST-05 — annualCap clamps withdrawal when bracket space exceeds cap */
  it('TEST-05: annualCap clamps bracketFillWithdrawal at cap value', () => {
    // bracketSpace = 57375 (bottom bracket, guaranteedIncome = 0)
    // annualCap = 5000 << 57375 → withdrawal clamped to $5000
    const input = makeYearInput({
      bracketFill: { enabled: true, annualCap: 5000 },
    });
    const result = calculateYear(input);
    expect(result.bracketFillWithdrawal).toBe(5000);
  });
});
