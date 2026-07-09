# Frozen Infrastructure: Internal Loan Module

The following components comprise the core financial infrastructure of the Internal Loan module and are strictly **FROZEN**:
- `shared/accounting.ts`
- `recordLoanRepayment` transaction in `server/storage.ts`
- The `loan_ledger` table schema and logic
- Snapshot synchronization routines
- Internal Loan passbook calculation logic in `app/loan/[id].tsx`

**AI Agent Directives:**
1. Do not modify the accounting logic, allocation rules, or atomic database transactions related to the Internal Loan module under any circumstances when developing new features.
2. Modifications to these areas are *only* permitted for:
   - Critical math or state bugs
   - Security vulnerabilities
   - Performance optimizations
3. Any permitted modification must pass the full regression audit defined in `docs/INTERNAL_LOAN_ACCOUNTING_SPEC.md` and the `verifyLoanIntegrity.ts` utility.
4. Always consult `docs/INTERNAL_LOAN_ACCOUNTING_SPEC.md` for the official architectural reference regarding ledger updates and snapshot derivation.
