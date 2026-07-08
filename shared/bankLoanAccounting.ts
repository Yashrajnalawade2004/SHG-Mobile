/**
 * Group Bank Loan — Independent Accounting Engine
 * Single source of truth for all bank loan calculations.
 * No database imports. Pure TypeScript functions only.
 * Do NOT import or call SHG internal loan accounting from here.
 */

export interface BankLoanRecommendation {
  recommendedPayment: number;   // totalPayment = principalPortion + interestPortion + outstandingInterest
  principalPortion: number;
  interestPortion: number;
  outstandingInterest: number;
  remainingMonths: number;
  monthlyRate: number;          // annualRate / 12 (for display)
}

export interface BankLoanLedgerResult {
  openingPrincipal: number;
  interestCharged: number;
  interestPaid: number;
  principalPaid: number;
  paymentReceived: number;
  closingPrincipal: number;
  outstandingInterest: number;
}

/**
 * Calculate the standard EMI (Equated Monthly Installment) for a reducing-balance loan.
 * Formula: EMI = P * r * (1 + r)^n / ((1 + r)^n - 1)
 * where r = monthly interest rate, n = duration in months
 * Returns integer rupees (rounded).
 */
export function calculateBankLoanEMI(
  principal: number,
  annualInterestRate: number,
  durationMonths: number
): number {
  if (principal <= 0 || durationMonths <= 0) return 0;
  if (annualInterestRate === 0) return Math.round(principal / durationMonths);
  const r = annualInterestRate / 100 / 12;
  const n = durationMonths;
  const emi = (principal * r * Math.pow(1 + r, n)) / (Math.pow(1 + r, n) - 1);
  return Math.round(emi);
}

/**
 * Generate a professional sequential receipt number.
 * Format: BLR-YYYY-NNNNNN
 * e.g. BLR-2027-000001
 */
export function generateBankLoanReceiptNo(year: number, sequenceNumber: number): string {
  const paddedSeq = String(sequenceNumber).padStart(6, "0");
  return `BLR-${year}-${paddedSeq}`;
}

/**
 * Get the recommended monthly payment for a member's bank loan allocation.
 * Uses reducing-balance interest calculation.
 * Interest is always calculated on the current remaining principal.
 */
export function getBankLoanRecommendation(
  outstandingBalance: number,
  outstandingInterest: number,
  annualInterestRate: number,
  originalPrincipal: number,
  originalDurationMonths: number
): BankLoanRecommendation {
  if (outstandingBalance <= 0) {
    return {
      recommendedPayment: Math.max(0, outstandingInterest),
      principalPortion: 0,
      interestPortion: 0,
      outstandingInterest,
      remainingMonths: 0,
      monthlyRate: annualInterestRate / 12,
    };
  }

  const monthlyRate = annualInterestRate / 100 / 12;
  const interestThisMonth = Math.round(outstandingBalance * monthlyRate);

  // Estimate remaining months based on EMI
  const emi = calculateBankLoanEMI(originalPrincipal, annualInterestRate, originalDurationMonths);
  let remainingMonths = 0;
  if (annualInterestRate === 0) {
    remainingMonths = emi > 0 ? Math.ceil(outstandingBalance / emi) : 0;
  } else if (emi > interestThisMonth) {
    const ratio = emi / (emi - interestThisMonth);
    const exactN = Math.log(ratio) / Math.log(1 + monthlyRate);
    remainingMonths = Math.round(exactN);
  } else {
    remainingMonths = 0;
  }

  // Principal portion = EMI - interest this month
  const principalPortion = Math.max(0, emi - interestThisMonth);

  return {
    recommendedPayment: principalPortion + interestThisMonth + outstandingInterest,
    principalPortion,
    interestPortion: interestThisMonth,
    outstandingInterest,
    remainingMonths: Math.max(0, remainingMonths),
    monthlyRate: annualInterestRate / 12,
  };
}

/**
 * Apply a bank loan repayment and return the immutable ledger row values.
 * Follows strict accounting: interest first, then principal.
 * Supports partial payments, underpayments, overpayments, early settlement.
 * 
 * Returns the computed ledger row data (caller must insert to DB atomically).
 */
export function applyBankLoanRepayment(
  openingPrincipal: number,
  outstandingInterest: number,
  annualInterestRate: number,
  paymentReceived: number
): BankLoanLedgerResult {
  const monthlyRate = annualInterestRate / 100 / 12;
  const interestCharged = Math.round(openingPrincipal * monthlyRate);

  // Total interest due = current month interest + any outstanding (carried-over) interest
  const totalInterestDue = interestCharged + outstandingInterest;

  let interestPaid: number;
  let principalPaid: number;
  let newOutstandingInterest: number;

  if (paymentReceived >= totalInterestDue) {
    // Payment covers all interest + some principal
    interestPaid = totalInterestDue;
    principalPaid = Math.min(paymentReceived - totalInterestDue, openingPrincipal);
    newOutstandingInterest = 0;
  } else {
    // Partial payment — interest first, no principal reduction
    interestPaid = paymentReceived;
    principalPaid = 0;
    newOutstandingInterest = totalInterestDue - paymentReceived;
  }

  const closingPrincipal = Math.max(0, openingPrincipal - principalPaid);

  return {
    openingPrincipal,
    interestCharged,
    interestPaid,
    principalPaid,
    paymentReceived,
    closingPrincipal,
    outstandingInterest: newOutstandingInterest,
  };
}

/**
 * Validate an allocation total against the sanctioned amount.
 * Returns null if valid, or an error message key if invalid.
 */
export function validateAllocations(
  allocations: { allocatedPrincipal: number }[],
  sanctionedAmount: number
): "bank_loan.error_exceeds_sanction" | "bank_loan.error_not_fully_allocated" | null {
  const total = allocations.reduce((sum, a) => sum + a.allocatedPrincipal, 0);
  if (total > sanctionedAmount) return "bank_loan.error_exceeds_sanction";
  if (total < sanctionedAmount) return "bank_loan.error_not_fully_allocated";
  return null;
}

/**
 * Auto-calculate equal distribution across members.
 * Remainder (due to rounding) is added to the first member's allocation.
 */
export function calculateEqualDistribution(
  memberIds: string[],
  sanctionedAmount: number
): { memberId: string; allocatedPrincipal: number }[] {
  if (memberIds.length === 0) return [];
  const perMember = Math.floor(sanctionedAmount / memberIds.length);
  const remainder = sanctionedAmount - perMember * memberIds.length;
  return memberIds.map((id, i) => ({
    memberId: id,
    allocatedPrincipal: perMember + (i === 0 ? remainder : 0),
  }));
}
