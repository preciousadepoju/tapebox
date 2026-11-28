/**
 * The test-report schema is the shared cross-package contract (@tapebox/shared): the CLI's
 * `tapebox test --json` emits exactly this, and the Reports page reads and validates it here.
 */
export {
  REPORT_SCHEMA_VERSION,
  validateReport,
  type Bits,
  type CaseKind,
  type CaseStatus,
  type Report,
  type ReportCase,
  type ReportSuite,
  type ValidateResult,
} from '@tapebox/shared';
