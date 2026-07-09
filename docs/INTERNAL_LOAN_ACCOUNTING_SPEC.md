# Internal Loan Accounting Specification
**Status**: 🔒 FROZEN

This document outlines the official accounting engine and architectural specifications for the Internal Loan module. No changes should be made to this financial infrastructure without a comprehensive regression audit.

## 1. Business Rules

The internal loan system operates on a **Reducing Balance Method** (monthly resting) by default, structured around the following invariant rules:
1. **Interest Calculation**: Interest is charged on the exact `closing_principal` of the previous ledger entry at the time of repayment.
2. **Repayment Allocation Priority**: Any payment amount received must first be allocated entirely towards paying off the generated interest. Only the remaining excess reduces the principal balance.
3. **Over/Under Payments**: The system naturally supports arbitrary partial or excess payments.
    - If a payment is less than the interest due, the entire payment applies to interest, leaving the remaining interest as `outstanding_interest`, and the principal balance remains unchanged.
    - If a payment exceeds the required monthly installment, the remaining amount immediately reduces the principal balance, consequently reducing the interest burden for all subsequent months.
4. **Zero-Floor Balance**: A loan's principal balance can never become negative. Excess payments that push the balance below zero are capped.

## 2. Accounting Formulas

Located entirely within `shared/accounting.ts`, the `calculateNextLedgerEntry` function strictly enforces standard accounting formulas:

- `OpeningPrincipal` = `PreviousLedger.closingPrincipal`
- `InterestCharged` = `OpeningPrincipal` × `(MonthlyInterestRate / 100)`
- `TotalInterestDue` = `InterestCharged` + `PreviousLedger.outstandingInterest`

**Allocation:**
- `InterestPaid` = `min(PaymentReceived, TotalInterestDue)`
- `PrincipalPaid` = `PaymentReceived - InterestPaid`
- `PrincipalPaid` = `min(PrincipalPaid, OpeningPrincipal)` *(prevents negative balances)*

**Closing:**
- `OutstandingInterest` = `TotalInterestDue - InterestPaid`
- `ClosingPrincipal` = `OpeningPrincipal - PrincipalPaid`

## 3. Immutable Ledger Architecture

The `loan_ledger` table serves as the definitive Single Source of Truth for all financial states. The `loans` table (the snapshot) only reflects derivative totals cached for rapid UI rendering.

**Properties of `loan_ledger`:**
- Insert-only architecture for core financial records.
- Sequential and chronological enforcement.
- Every payment stores an exact timestamp, receipt string, and before/after mathematical snapshot of the loan.

## 4. Transaction Flow & Synchronization

To eliminate Read-Modify-Write race conditions and concurrent double-submission bugs, repayments MUST be executed via an atomic database transaction using Row-Level locking.

**The Strict Transaction Flow (`recordLoanRepayment`):**
1. **Lock**: `SELECT * FROM loans WHERE id = $1 FOR UPDATE`
2. **Lock Ledger**: `SELECT * FROM loan_ledger WHERE loan_id = $1 ORDER BY date DESC LIMIT 1 FOR UPDATE`
3. **Calculate**: Run pure calculation engine `calculateNextLedgerEntry` using the freshly locked latest ledger entry.
4. **Insert Ledger**: Save the new mathematical entry into `loan_ledger`.
5. **Insert Receipt**: Save into `loanRepayments`.
6. **Derive Snapshot**: Sum the values from the newly calculated entry against the existing `loans` snapshot memory.
7. **Update Snapshot**: `UPDATE loans SET remaining_balance = $1, ...`
8. **Commit**: Transaction automatically commits and releases all locks.

## 5. Worked Mathematical Examples

**Scenario:** 
- Disbursed: ₹30,000
- Interest Rate: 2% per month
- Installment: Fixed ₹5,000 principal/mo + interest

**Transaction 1: Standard Payment (₹5,600)**
- Opening Principal: ₹30,000
- Outstanding Interest: ₹0
- Interest Charged: ₹30,000 × 2% = ₹600
- Payment Received: ₹5,600
- *Allocation*: Interest Paid = ₹600 | Principal Paid = ₹5,000
- Closing Principal: ₹25,000
- Outstanding Interest: ₹0

**Transaction 2: Partial/Under Payment (₹3,000)**
- Opening Principal: ₹25,000
- Outstanding Interest: ₹0
- Interest Charged: ₹25,000 × 2% = ₹500
- Payment Received: ₹3,000
- *Allocation*: Interest Paid = ₹500 | Principal Paid = ₹2,500
- Closing Principal: ₹22,500
- Outstanding Interest: ₹0

**Transaction 3: Overpayment (₹7,000)**
- Opening Principal: ₹22,500
- Outstanding Interest: ₹0
- Interest Charged: ₹22,500 × 2% = ₹450
- Payment Received: ₹7,000
- *Allocation*: Interest Paid = ₹450 | Principal Paid = ₹6,550
- Closing Principal: ₹15,950
- Outstanding Interest: ₹0

## 6. Freeze Directives

The following files and processes represent the frozen financial infrastructure of the Internal Loan module:
1. `shared/accounting.ts`
2. `recordLoanRepayment` method inside `server/storage.ts`
3. The `loan_ledger` table schema.
4. Internal Loan passbook calculation routines mapped in `app/loan/[id].tsx` and PDF generators.

**DO NOT MODIFY** unless addressing an explicitly verified, reproducible defect in math calculation or security vulnerability. Feature developments (e.g., UI reskinning, notification handling) must strictly wrap or observe these processes without altering the internal atomic transaction sequence.
