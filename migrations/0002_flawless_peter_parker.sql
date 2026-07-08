CREATE TABLE "bank_loan_allocations" (
	"id" varchar(36) PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"bank_loan_id" varchar(36) NOT NULL,
	"member_id" varchar(36) NOT NULL,
	"allocated_principal" integer NOT NULL,
	"total_principal_paid" integer DEFAULT 0 NOT NULL,
	"total_interest_paid" integer DEFAULT 0 NOT NULL,
	"outstanding_balance" integer NOT NULL,
	"outstanding_interest" integer DEFAULT 0 NOT NULL,
	"status" varchar(30) DEFAULT 'active' NOT NULL
);
--> statement-breakpoint
CREATE TABLE "bank_loan_ledger" (
	"id" varchar(36) PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"allocation_id" varchar(36) NOT NULL,
	"receipt_no" varchar(50) NOT NULL,
	"date" timestamp DEFAULT now() NOT NULL,
	"opening_principal" integer NOT NULL,
	"interest_rate_applied" real NOT NULL,
	"interest_charged" integer NOT NULL,
	"interest_paid" integer NOT NULL,
	"principal_paid" integer NOT NULL,
	"payment_received" integer NOT NULL,
	"closing_principal" integer NOT NULL,
	"outstanding_interest" integer NOT NULL,
	"remarks" text,
	"recorded_by" varchar(36) NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "bank_loan_repayments" (
	"id" varchar(36) PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"allocation_id" varchar(36) NOT NULL,
	"receipt_no" varchar(50) NOT NULL,
	"amount" integer NOT NULL,
	"date" timestamp DEFAULT now() NOT NULL,
	"recorded_by" varchar(36) NOT NULL,
	"remarks" text
);
--> statement-breakpoint
CREATE TABLE "group_bank_loans" (
	"id" varchar(36) PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"group_id" varchar(36) NOT NULL,
	"bank_name" text NOT NULL,
	"branch" text,
	"account_number" varchar(50),
	"sanction_date" timestamp NOT NULL,
	"amount" integer NOT NULL,
	"annual_interest_rate" real NOT NULL,
	"duration_months" integer NOT NULL,
	"repayment_start_date" timestamp,
	"remarks" text,
	"status" varchar(30) DEFAULT 'active' NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "loan_ledger" (
	"id" varchar(36) PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"loan_id" varchar(36) NOT NULL,
	"receipt_no" varchar(50) NOT NULL,
	"date" timestamp DEFAULT now() NOT NULL,
	"opening_principal" integer NOT NULL,
	"interest_rate_applied" real NOT NULL,
	"interest_charged" integer NOT NULL,
	"interest_paid" integer NOT NULL,
	"principal_paid" integer NOT NULL,
	"payment_received" integer NOT NULL,
	"closing_principal" integer NOT NULL,
	"outstanding_interest" integer NOT NULL,
	"remarks" text,
	"recorded_by" varchar(36) NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "loans" ADD COLUMN "calculation_method" varchar(20) DEFAULT 'legacy' NOT NULL;--> statement-breakpoint
ALTER TABLE "loans" ADD COLUMN "total_principal_paid" integer DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE "loans" ADD COLUMN "total_interest_paid" integer DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE "loans" ADD COLUMN "outstanding_interest" integer DEFAULT 0 NOT NULL;--> statement-breakpoint
CREATE INDEX "allocation_bank_idx" ON "bank_loan_allocations" USING btree ("bank_loan_id");--> statement-breakpoint
CREATE INDEX "allocation_member_idx" ON "bank_loan_allocations" USING btree ("member_id");--> statement-breakpoint
CREATE INDEX "bank_ledger_alloc_idx" ON "bank_loan_ledger" USING btree ("allocation_id");--> statement-breakpoint
CREATE INDEX "ledger_loan_idx" ON "loan_ledger" USING btree ("loan_id");