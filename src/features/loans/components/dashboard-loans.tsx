import type { LoanView } from "@/lib/loans";
import { DashboardLoansClient } from "./dashboard-loans-client";

interface DashboardLoansProps {
  loans: LoanView[];
}

/**
 * Server wrapper for the loans dashboard widget.
 * Receives pre-fetched loan data as props (no HTTP round-trip).
 * Delegates rendering and mutations to the client component.
 */
export function DashboardLoans({ loans }: DashboardLoansProps) {
  if (loans.length === 0) return null;
  return <DashboardLoansClient initialLoans={loans} />;
}
