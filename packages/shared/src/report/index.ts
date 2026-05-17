/**
 * @retireops/shared/report — public surface of the long-form report data module (Phase 18).
 *
 * Exports the pure adapter `buildLongReportData` plus the named DTO types. Internal
 * helpers (buildProfileSection, collectLedgerWarningsSingle, etc.) are intentionally
 * NOT exported — they are implementation detail of build-long-report-data.ts.
 *
 * Consumers:
 *   import { buildLongReportData } from '@retireops/shared/report';
 *   import type { LongReportData, ReportProfileSection } from '@retireops/shared/report';
 *
 * Or root-level:
 *   import { buildLongReportData, type LongReportData } from '@retireops/shared';
 *
 * @see .planning/phases/18-report-data-foundation/18-CONTEXT.md
 */

// --- Value exports ---
export { buildLongReportData } from './build-long-report-data.js';

// --- Type exports ---
export type {
  LongReportData,
  ReportProfileSection,
  ReportGoalsSection,
  ReportAssumptionsSection,
  ReportCashFlowSection,
  ReportAccountsSection,
  ReportEstateSection,
  ReportRiskSection,
  ReportRecommendationsSection,
  ReportOptionalModules,
  CoupleProjectionOutputLike,
  StressTestResultLike,
  ScenarioComparisonLike,
} from './types.js';
