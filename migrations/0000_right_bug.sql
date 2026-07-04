CREATE TABLE "cron_locks" (
	"job_name" varchar(50) PRIMARY KEY NOT NULL,
	"locked_at" text NOT NULL
);
--> statement-breakpoint
CREATE TABLE "group_rules" (
	"group_id" varchar(36) PRIMARY KEY NOT NULL,
	"rules" text DEFAULT '' NOT NULL
);
--> statement-breakpoint
CREATE TABLE "group_settings" (
	"group_id" varchar(36) PRIMARY KEY NOT NULL,
	"settings" jsonb NOT NULL
);
--> statement-breakpoint
CREATE TABLE "groups" (
	"id" varchar(36) PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"group_id" varchar(100) NOT NULL,
	"unique_group_code" varchar(20),
	"name" text NOT NULL,
	"preferred_language" varchar(10) DEFAULT 'mr' NOT NULL,
	"status" varchar(20) DEFAULT 'pending' NOT NULL,
	"president_id" varchar(36),
	"treasurer_id" varchar(36),
	"qr_code" text,
	"created_by_super_admin" varchar(36),
	"activated_on" timestamp,
	"created_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "groups_group_id_unique" UNIQUE("group_id"),
	CONSTRAINT "groups_unique_group_code_unique" UNIQUE("unique_group_code")
);
--> statement-breakpoint
CREATE TABLE "invitation_code_usage" (
	"id" varchar(36) PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"invitation_code_id" varchar(36) NOT NULL,
	"user_id" varchar(36) NOT NULL,
	"used_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "invitation_codes" (
	"id" varchar(36) PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"code" varchar(10) NOT NULL,
	"group_id" varchar(36) NOT NULL,
	"active" boolean DEFAULT true NOT NULL,
	"expires_at" timestamp,
	"max_uses" integer DEFAULT 1 NOT NULL,
	"current_uses" integer DEFAULT 0 NOT NULL,
	"created_by" varchar(36) NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "invitation_codes_code_unique" UNIQUE("code")
);
--> statement-breakpoint
CREATE TABLE "loan_repayments" (
	"id" varchar(36) PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"loan_id" varchar(36) NOT NULL,
	"amount" integer NOT NULL,
	"date" text NOT NULL,
	"recorded_by" varchar(36) NOT NULL
);
--> statement-breakpoint
CREATE TABLE "loans" (
	"id" varchar(36) PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"group_id" varchar(36) NOT NULL,
	"member_id" varchar(36) NOT NULL,
	"member_name" text NOT NULL,
	"resolution_no" text NOT NULL,
	"amount" integer NOT NULL,
	"interest" real NOT NULL,
	"duration" integer NOT NULL,
	"remaining_balance" integer NOT NULL,
	"status" varchar(30) DEFAULT 'pending_treasurer' NOT NULL,
	"treasurer_action_by" varchar(36),
	"treasurer_action_at" text,
	"approved_by" varchar(36),
	"approved_at" text,
	"meeting_id" varchar(36),
	"created_at" text NOT NULL
);
--> statement-breakpoint
CREATE TABLE "meetings" (
	"id" varchar(36) PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"group_id" varchar(36) NOT NULL,
	"scheduled_date" text NOT NULL,
	"agenda" text DEFAULT '' NOT NULL,
	"notes" text DEFAULT '' NOT NULL,
	"attendance" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"status" varchar(20) DEFAULT 'scheduled' NOT NULL,
	"created_by" varchar(36) NOT NULL,
	"created_at" text NOT NULL
);
--> statement-breakpoint
CREATE TABLE "payments" (
	"id" varchar(36) PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"group_id" varchar(36) NOT NULL,
	"member_id" varchar(36) NOT NULL,
	"member_name" text NOT NULL,
	"amount" integer NOT NULL,
	"expected_amount" integer DEFAULT 0 NOT NULL,
	"late_fee" integer DEFAULT 0 NOT NULL,
	"month" varchar(7) DEFAULT '',
	"due_date" text,
	"date" text NOT NULL,
	"mode" varchar(20) DEFAULT 'cash' NOT NULL,
	"status" varchar(30) DEFAULT 'pending' NOT NULL,
	"verified_by" varchar(36),
	"verified_at" text
);
--> statement-breakpoint
CREATE TABLE "sessions" (
	"token" varchar(36) PRIMARY KEY NOT NULL,
	"user_id" varchar(36) NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "users" (
	"id" varchar(36) PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name" text NOT NULL,
	"phone" varchar(20) NOT NULL,
	"password" text NOT NULL,
	"village" text NOT NULL,
	"join_date" text NOT NULL,
	"exit_date" text,
	"role" varchar(20) DEFAULT 'member' NOT NULL,
	"preferred_language" varchar(10),
	"group_id" varchar(36) NOT NULL,
	"status" varchar(20) DEFAULT 'active' NOT NULL,
	CONSTRAINT "users_phone_unique" UNIQUE("phone")
);
--> statement-breakpoint
CREATE INDEX "loan_member_idx" ON "loans" USING btree ("member_id");--> statement-breakpoint
CREATE INDEX "payment_group_member_month_idx" ON "payments" USING btree ("group_id","member_id","month");