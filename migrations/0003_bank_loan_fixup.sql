-- Migration 0003: Fix missing columns from Group Bank Loan module
-- Adds: ifsc_code to group_bank_loans
--       created_by to group_bank_loans
--       type to bank_loan_ledger
-- These were missing from migration 0002 but are present in the schema.

--> statement-breakpoint
ALTER TABLE "group_bank_loans" ADD COLUMN IF NOT EXISTS "ifsc_code" varchar(20);
--> statement-breakpoint
ALTER TABLE "group_bank_loans" ADD COLUMN IF NOT EXISTS "created_by" varchar(36) NOT NULL DEFAULT '';
--> statement-breakpoint
ALTER TABLE "bank_loan_ledger" ADD COLUMN IF NOT EXISTS "type" varchar(20) NOT NULL DEFAULT 'repayment';
