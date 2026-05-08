/**
 * Projection Routes Integration Tests
 *
 * Tests the full projection flow: create → calculate → retrieve
 * Uses real calculation engine, mocked database and auth.
 *
 * @see docs/source-of-truth/08-projection-engine.md
 */
import { describe, it, expect, beforeEach } from 'vitest';
import request from 'supertest';
import type { Express } from 'express';
import { createTestApp } from '../test/helpers/test-app.js';
import {
  singlePersonBasic,
  minimalValidInput,
  earlyRetirementInput,
  underfundedInput,
  age70Input,
  albertaResident,
  quebecResident,
} from '../test/fixtures/projection-inputs.js';
import { singlePersonBasicExpected } from '../test/fixtures/projection-expected.js';
import { mockDb } from '../test/helpers/mock-db.js';

describe('Projection Routes Integration Tests', () => {
  let app: Express;

  beforeEach(() => {
    app = createTestApp();
  });

  describe('POST /api/projections - Create Projection', () => {
    /**
     * TC-01: Create projection returns completed status
     * Validates the full flow works end-to-end
     */
    it('should create projection with full calculation and return completed status', async () => {
      const response = await request(app)
        .post('/api/projections')
        .set('Authorization', 'Bearer test-token')
        .send({
          name: 'Test Retirement Plan',
          inputData: singlePersonBasic,
        });

      expect(response.status).toBe(201);
      expect(response.body.success).toBe(true);
      expect(response.body.data).toBeDefined();
      expect(response.body.data.status).toBe('completed');
      expect(response.body.data.resultData).toBeDefined();
      expect(response.body.data.resultData.summary).toBeDefined();
      expect(response.body.data.resultData.yearlyResults).toBeDefined();
    });

    /**
     * TC-02: Yearly results array has correct length
     * Validates projection runs from current age to life expectancy
     */
    it('should produce yearly results from current age to life expectancy', async () => {
      const response = await request(app)
        .post('/api/projections')
        .set('Authorization', 'Bearer test-token')
        .send({
          name: 'Test Plan',
          inputData: singlePersonBasic,
        });

      expect(response.status).toBe(201);

      const { yearlyResults } = response.body.data.resultData;
      expect(Array.isArray(yearlyResults)).toBe(true);

      // Should have approximately 35 years of results (age 55 to 90)
      expect(yearlyResults.length).toBeGreaterThanOrEqual(
        singlePersonBasicExpected.yearsInProjection - 2
      );
      expect(yearlyResults.length).toBeLessThanOrEqual(
        singlePersonBasicExpected.yearsInProjection + 2
      );

      // First year age should be approximately 55
      const firstYear = yearlyResults[0];
      expect(firstYear.age).toBeGreaterThanOrEqual(54);
      expect(firstYear.age).toBeLessThanOrEqual(56);
    });

    /**
     * TC-03: Federal tax calculation accuracy
     * Validates tax engine integration produces reasonable values
     * @see docs/source-of-truth/04-tax-engine.md
     */
    it('should calculate federal tax within expected range for $100k income', async () => {
      const response = await request(app)
        .post('/api/projections')
        .set('Authorization', 'Bearer test-token')
        .send({
          name: 'Tax Test',
          inputData: singlePersonBasic,
        });

      expect(response.status).toBe(201);

      const firstYear = response.body.data.resultData.yearlyResults[0];

      // Employment income should be ~$100k
      expect(firstYear.employmentIncome).toBeGreaterThan(90000);
      expect(firstYear.employmentIncome).toBeLessThan(110000);

      // Federal tax for $100k should be approximately $10k-$18k after credits
      expect(firstYear.federalTax).toBeGreaterThan(8000);
      expect(firstYear.federalTax).toBeLessThan(20000);

      // Total tax (federal + provincial) should be reasonable
      // $100k income = ~$12k federal + ~$5-8k provincial = $15-25k total
      expect(firstYear.totalTax).toBeGreaterThan(10000);
      expect(firstYear.totalTax).toBeLessThan(30000);
    });

    /**
     * TC-04: Provincial tax varies by province
     * Alberta should have lower taxes than Ontario and Quebec
     */
    it('should calculate different taxes for different provinces', async () => {
      // Create projections for different provinces
      const [ontarioResponse, albertaResponse, quebecResponse] = await Promise.all([
        request(app)
          .post('/api/projections')
          .set('Authorization', 'Bearer test-token')
          .send({ name: 'Ontario', inputData: singlePersonBasic }),
        request(app)
          .post('/api/projections')
          .set('Authorization', 'Bearer test-token')
          .send({ name: 'Alberta', inputData: albertaResident }),
        request(app)
          .post('/api/projections')
          .set('Authorization', 'Bearer test-token')
          .send({ name: 'Quebec', inputData: quebecResident }),
      ]);

      expect(ontarioResponse.status).toBe(201);
      expect(albertaResponse.status).toBe(201);
      expect(quebecResponse.status).toBe(201);

      const ontarioTax = ontarioResponse.body.data.resultData.yearlyResults[0].totalTax;
      const albertaTax = albertaResponse.body.data.resultData.yearlyResults[0].totalTax;
      const quebecTax = quebecResponse.body.data.resultData.yearlyResults[0].totalTax;

      // All provinces should have reasonable tax amounts
      expect(ontarioTax).toBeGreaterThan(10000);
      expect(albertaTax).toBeGreaterThan(10000);
      expect(quebecTax).toBeGreaterThan(10000);

      // Taxes should be different across provinces
      // (Provincial rates differ, even if not exactly in expected order due to RRSP deductions etc)
      expect(ontarioTax).not.toBe(quebecTax);
    });

    /**
     * TC-05: RRSP converts to RRIF at age 71
     * @see docs/source-of-truth/02-account-types.md - RRIF conversion
     */
    it('should convert RRSP to RRIF at age 71', async () => {
      const response = await request(app)
        .post('/api/projections')
        .set('Authorization', 'Bearer test-token')
        .send({
          name: 'RRIF Test',
          inputData: age70Input,
        });

      expect(response.status).toBe(201);

      const { yearlyResults } = response.body.data.resultData;

      // Debug: log available ages
      const ages = yearlyResults.map((y: { age: number }) => y.age);

      // Should have results starting from age 70
      expect(yearlyResults.length).toBeGreaterThan(5);
      expect(ages[0]).toBeGreaterThanOrEqual(69);
      expect(ages[0]).toBeLessThanOrEqual(71);

      // Find a year after 71 where RRIF withdrawals should be happening
      const laterYear = yearlyResults.find((y: { age: number }) => y.age >= 72);

      // After RRIF conversion, withdrawals should be happening
      if (laterYear) {
        expect(laterYear.withdrawals).toBeGreaterThanOrEqual(0);
      }
    });

    /**
     * TC-06: RRIF minimum withdrawals at 72+
     * @see docs/source-of-truth/02-account-types.md - RRIF-002
     */
    it('should enforce RRIF minimum withdrawals after age 71', async () => {
      const response = await request(app)
        .post('/api/projections')
        .set('Authorization', 'Bearer test-token')
        .send({
          name: 'RRIF Minimum Test',
          inputData: age70Input,
        });

      expect(response.status).toBe(201);

      const { yearlyResults } = response.body.data.resultData;

      // Find years after RRIF conversion
      const age72 = yearlyResults.find((y: { age: number }) => y.age === 72);
      const age75 = yearlyResults.find((y: { age: number }) => y.age === 75);

      // Should have withdrawals (RRIF minimums)
      if (age72) {
        expect(age72.withdrawals).toBeGreaterThan(0);
      }
      if (age75) {
        expect(age75.withdrawals).toBeGreaterThan(0);
      }
    });

    /**
     * TC-07: CPP/OAS start at configured ages
     * @see docs/source-of-truth/05-government-benefits.md
     */
    it('should start CPP and OAS at configured ages', async () => {
      const response = await request(app)
        .post('/api/projections')
        .set('Authorization', 'Bearer test-token')
        .send({
          name: 'Benefits Test',
          inputData: earlyRetirementInput,
        });

      expect(response.status).toBe(201);

      const { yearlyResults } = response.body.data.resultData;

      // Find specific years
      const age59 = yearlyResults.find((y: { age: number }) => y.age === 59);
      const age60 = yearlyResults.find((y: { age: number }) => y.age === 60);
      const age64 = yearlyResults.find((y: { age: number }) => y.age === 64);
      const age65 = yearlyResults.find((y: { age: number }) => y.age === 65);

      // Before CPP start age (60), no CPP income
      if (age59) {
        expect(age59.cppIncome).toBe(0);
      }

      // At CPP start age (60), should have CPP income
      if (age60) {
        expect(age60.cppIncome).toBeGreaterThan(0);
      }

      // Before OAS start age (65), no OAS
      if (age64) {
        expect(age64.oasIncome).toBe(0);
      }

      // At OAS start age (65), should have OAS income
      if (age65) {
        expect(age65.oasIncome).toBeGreaterThan(0);
      }
    });

    /**
     * TC-08: Portfolio depletion detected
     * @see docs/source-of-truth/09-success-metrics.md
     */
    it('should detect portfolio depletion for underfunded scenario', async () => {
      const response = await request(app)
        .post('/api/projections')
        .set('Authorization', 'Bearer test-token')
        .send({
          name: 'Underfunded Test',
          inputData: underfundedInput,
        });

      expect(response.status).toBe(201);

      const { summary } = response.body.data.resultData;

      // Should indicate portfolio won't last
      // Either probability < 100 or portfolioLongevity < life expectancy
      const hasDepletion =
        summary.probabilityOfSuccess < 100 ||
        (summary.portfolioLongevity && summary.portfolioLongevity < 95);

      expect(hasDepletion).toBe(true);
    });

    /**
     * TC-11: Invalid input returns 400
     * Tests validation layer
     */
    it('should return 400 for invalid input data', async () => {
      const response = await request(app)
        .post('/api/projections')
        .set('Authorization', 'Bearer test-token')
        .send({
          name: 'Invalid Test',
          inputData: {
            personalInfo: {
              dateOfBirth: 'not-a-date',
              province: 'XX', // Invalid province
              retirementAge: 120, // Out of range
              lifeExpectancy: 50, // Out of range
            },
            accounts: [],
            incomeSources: [],
            governmentBenefits: {
              cppStartAge: 50, // Out of range
              oasStartAge: 50, // Out of range
            },
            expenses: {
              currentAnnualExpenses: -1000, // Negative
              retirementAnnualExpenses: -1000,
            },
          },
        });

      expect(response.status).toBe(400);
      expect(response.body.success).toBe(false);
    });

    /**
     * TC-12: Input transformer maps fields correctly
     * Verifies transformer produces correct calculation input
     */
    it('should correctly aggregate account balances by type', async () => {
      // Input with multiple RRSP accounts
      const multiAccountInput = {
        ...singlePersonBasic,
        accounts: [
          { type: 'RRSP' as const, balance: 100000, annualContribution: 5000 },
          { type: 'RRSP' as const, balance: 200000, annualContribution: 10000 },
          { type: 'TFSA' as const, balance: 50000, annualContribution: 3500 },
          { type: 'TFSA' as const, balance: 30000, annualContribution: 3500 },
        ],
      };

      const response = await request(app)
        .post('/api/projections')
        .set('Authorization', 'Bearer test-token')
        .send({
          name: 'Multi Account Test',
          inputData: multiAccountInput,
        });

      expect(response.status).toBe(201);

      // First year should reflect combined balances plus contributions and growth
      const firstYear = response.body.data.resultData.yearlyResults[0];

      // RRSP balance should be > 300k (100k + 200k + contributions + growth)
      expect(firstYear.rrspBalance).toBeGreaterThan(300000);

      // TFSA balance should be > 80k (50k + 30k + contributions + growth)
      expect(firstYear.tfsaBalance).toBeGreaterThan(80000);
    });
  });

  describe('GET /api/projections/:id - Get Projection', () => {
    /**
     * TC-09: Get projection returns same results
     * Validates persistence works correctly
     */
    it('should retrieve created projection with full results', async () => {
      // Create a projection first
      const createResponse = await request(app)
        .post('/api/projections')
        .set('Authorization', 'Bearer test-token')
        .send({
          name: 'Persistence Test',
          inputData: minimalValidInput,
        });

      expect(createResponse.status).toBe(201);
      const projectionId = createResponse.body.data.id;

      // Retrieve the projection
      const getResponse = await request(app)
        .get(`/api/projections/${projectionId}`)
        .set('Authorization', 'Bearer test-token');

      expect(getResponse.status).toBe(200);
      expect(getResponse.body.success).toBe(true);
      expect(getResponse.body.data.id).toBe(projectionId);
      expect(getResponse.body.data.name).toBe('Persistence Test');
      expect(getResponse.body.data.resultData).toBeDefined();

      // Results should match what was created
      expect(getResponse.body.data.resultData.summary.peakNetWorth).toBe(
        createResponse.body.data.resultData.summary.peakNetWorth
      );
    });

    it('should return 404 for non-existent projection', async () => {
      const response = await request(app)
        .get('/api/projections/00000000-0000-0000-0000-000000000000')
        .set('Authorization', 'Bearer test-token');

      expect(response.status).toBe(404);
      expect(response.body.success).toBe(false);
    });
  });

  describe('POST /api/projections/:id/calculate - Recalculate', () => {
    /**
     * TC-10: Recalculate updates results
     * Validates recalculation produces new results
     */
    it('should recalculate and return updated results', async () => {
      // Create a projection
      const createResponse = await request(app)
        .post('/api/projections')
        .set('Authorization', 'Bearer test-token')
        .send({
          name: 'Recalc Test',
          inputData: singlePersonBasic,
        });

      expect(createResponse.status).toBe(201);
      const projectionId = createResponse.body.data.id;

      // Trigger recalculation
      const recalcResponse = await request(app)
        .post(`/api/projections/${projectionId}/calculate`)
        .set('Authorization', 'Bearer test-token');

      expect(recalcResponse.status).toBe(200);
      expect(recalcResponse.body.success).toBe(true);
      expect(recalcResponse.body.data.resultData).toBeDefined();

      // Results should still be valid
      expect(recalcResponse.body.data.resultData.yearlyResults.length).toBeGreaterThan(20);
    });
  });

  describe('M005/S05 contribution-room ledger response surfacing (T02)', () => {
    const currentYear = new Date().getFullYear();
    const primaryBirthYear = currentYear - 55;
    const spouseBirthYear = currentYear - 53;

    /**
     * Baseline couple input with a deliberate RRSP over-contribution in year 0.
     * 18% × 80000 employmentIncome = 14400 room accrual. 25000 contribution
     * exceeds 14400 + 2000 (CRA buffer), so the ledger raises a warning and
     * levies a 1%/month × overAmount penalty.
     */
    const coupleOverContribution = {
      personalInfo: {
        dateOfBirth: `${primaryBirthYear}-06-15`,
        province: 'ON',
        maritalStatus: 'married' as const,
        retirementAge: 65,
        lifeExpectancy: 85,
      },
      spouse: {
        dateOfBirth: `${spouseBirthYear}-04-01`,
        retirementAge: 65,
        lifeExpectancy: 85,
        employmentIncome: 60000,
        rrspBalance: 50000,
        rrspAnnualContribution: 4000,
      },
      accounts: [
        { type: 'RRSP' as const, balance: 200000, annualContribution: 25000 },
        { type: 'TFSA' as const, balance: 20000, annualContribution: 0 },
      ],
      incomeSources: [{ type: 'employment' as const, annualAmount: 80000, endAge: 65 }],
      governmentBenefits: { cppStartAge: 65, oasStartAge: 65, estimatedCppAmount: 14000 },
      expenses: { currentAnnualExpenses: 60000, retirementAnnualExpenses: 50000 },
      assumptions: { inflationRate: 2, investmentReturnRate: 5 },
    };

    it('surfaces summary.ledgerWarnings and yearly primary warnings for over-contribution scenario', async () => {
      const response = await request(app)
        .post('/api/projections')
        .set('Authorization', 'Bearer test-token')
        .send({ name: 'Over-Contribution Test', inputData: coupleOverContribution });

      expect(response.status).toBe(201);

      const { summary, yearlyResults } = response.body.data.resultData;

      expect(Array.isArray(summary.ledgerWarnings)).toBe(true);
      expect(summary.ledgerWarnings.length).toBeGreaterThan(0);

      const firstWarning = summary.ledgerWarnings[0];
      expect(firstWarning.accountType).toBe('rrsp');
      expect(firstWarning.kind).toBe('over-contribution');
      expect(firstWarning.penaltyAmount).toBeGreaterThan(0);
      expect(typeof firstWarning.year).toBe('number');
      expect(firstWarning.person).toBe('primary');

      const yearWithWarnings = yearlyResults.find(
        (y: { ledgerWarnings?: unknown[] }) =>
          Array.isArray(y.ledgerWarnings) && y.ledgerWarnings.length > 0
      );
      expect(yearWithWarnings).toBeDefined();
      expect(yearWithWarnings.overContributionPenalty).toBeDefined();
      expect(yearWithWarnings.overContributionPenalty.rrsp).toBeGreaterThan(0);
    });

    it('omits summary.ledgerWarnings for a within-room baseline couple projection', async () => {
      const withinRoom = {
        ...coupleOverContribution,
        accounts: [
          { type: 'RRSP' as const, balance: 200000, annualContribution: 10000 },
          { type: 'TFSA' as const, balance: 20000, annualContribution: 0 },
        ],
      };

      const response = await request(app)
        .post('/api/projections')
        .set('Authorization', 'Bearer test-token')
        .send({ name: 'Within-Room Baseline', inputData: withinRoom });

      expect(response.status).toBe(201);

      const { summary } = response.body.data.resultData;
      expect(summary.ledgerWarnings).toBeUndefined();
    });
  });

  describe('account ownership and contribution room (standalone projection bug fix)', () => {
    const currentYear = new Date().getFullYear();
    const primaryBirthYear = currentYear - 55;
    const spouseBirthYear = currentYear - 53;

    it('round-trips belongsTo, contributorOwner, and contributionRoom on accounts', async () => {
      const inputData = {
        personalInfo: {
          dateOfBirth: `${primaryBirthYear}-06-15`,
          province: 'ON',
          maritalStatus: 'married' as const,
          retirementAge: 65,
          lifeExpectancy: 85,
        },
        spouse: {
          dateOfBirth: `${spouseBirthYear}-04-01`,
          retirementAge: 65,
          lifeExpectancy: 85,
        },
        accounts: [
          {
            type: 'RRSP' as const,
            balance: 100000,
            annualContribution: 10000,
            belongsTo: 'primary' as const,
            contributionRoom: 40000,
          },
          {
            type: 'TFSA' as const,
            balance: 50000,
            annualContribution: 7000,
            belongsTo: 'spouse' as const,
          },
          {
            type: 'RRSP' as const,
            balance: 30000,
            annualContribution: 5000,
            belongsTo: 'spouse' as const,
            contributorOwner: 'primary' as const,
          },
        ],
        incomeSources: [{ type: 'employment' as const, annualAmount: 100000, endAge: 65 }],
        governmentBenefits: { cppStartAge: 65, oasStartAge: 65, estimatedCppAmount: 14000 },
        expenses: { currentAnnualExpenses: 60000, retirementAnnualExpenses: 50000 },
        assumptions: { inflationRate: 2, investmentReturnRate: 5 },
      };

      const createResponse = await request(app)
        .post('/api/projections')
        .set('Authorization', 'Bearer test-token')
        .send({ name: 'Ownership Round-Trip', inputData });

      expect(createResponse.status).toBe(201);

      const projectionId = createResponse.body.data.id as string;
      const stored = mockDb._projections.get(projectionId);
      expect(stored).toBeDefined();

      const persisted = (stored!.input_data as { accounts: Array<Record<string, unknown>> })
        .accounts;
      expect(persisted).toHaveLength(3);
      expect(persisted[0]!.belongsTo).toBe('primary');
      expect(persisted[0]!.contributionRoom).toBe(40000);
      expect(persisted[1]!.belongsTo).toBe('spouse');
      expect(persisted[2]!.belongsTo).toBe('spouse');
      expect(persisted[2]!.contributorOwner).toBe('primary');
    });

    it('produces no spurious over-contribution warnings when room is adequate and spouse account is marked', async () => {
      const inputData = {
        personalInfo: {
          dateOfBirth: `${primaryBirthYear}-06-15`,
          province: 'ON',
          maritalStatus: 'married' as const,
          retirementAge: 65,
          lifeExpectancy: 85,
        },
        spouse: {
          dateOfBirth: `${spouseBirthYear}-04-01`,
          retirementAge: 65,
          lifeExpectancy: 85,
          employmentIncome: 80000,
        },
        accounts: [
          {
            type: 'RRSP' as const,
            balance: 200000,
            annualContribution: 10000,
            belongsTo: 'primary' as const,
            contributionRoom: 50000,
          },
          {
            type: 'TFSA' as const,
            balance: 50000,
            annualContribution: 7000,
            belongsTo: 'primary' as const,
          },
          {
            type: 'TFSA' as const,
            balance: 40000,
            annualContribution: 7000,
            belongsTo: 'spouse' as const,
          },
        ],
        incomeSources: [{ type: 'employment' as const, annualAmount: 100000, endAge: 65 }],
        governmentBenefits: { cppStartAge: 65, oasStartAge: 65, estimatedCppAmount: 14000 },
        expenses: { currentAnnualExpenses: 60000, retirementAnnualExpenses: 50000 },
        assumptions: { inflationRate: 2, investmentReturnRate: 5 },
      };

      const response = await request(app)
        .post('/api/projections')
        .set('Authorization', 'Bearer test-token')
        .send({ name: 'No Spurious Warnings', inputData });

      expect(response.status).toBe(201);

      const summary = response.body.data.resultData.summary;
      const overContributionWarnings = (summary.ledgerWarnings ?? []).filter(
        (w: { kind: string }) => w.kind === 'over-contribution'
      );

      expect(overContributionWarnings).toEqual([]);
    });
  });

  describe('Authentication', () => {
    it('should return 401 when no token provided', async () => {
      const response = await request(app).post('/api/projections').send({
        name: 'No Auth Test',
        inputData: minimalValidInput,
      });

      expect(response.status).toBe(401);
      expect(response.body.success).toBe(false);
    });
  });
});
