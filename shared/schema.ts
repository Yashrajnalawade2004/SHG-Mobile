import { sql } from "drizzle-orm";
import {
  pgTable,
  text,
  varchar,
  integer,
  real,
  jsonb,
  timestamp,
  index,
  boolean,
} from "drizzle-orm/pg-core";

export const users = pgTable("users", {
  id: varchar("id", { length: 36 })
    .primaryKey()
    .default(sql`gen_random_uuid()`),
  name: text("name").notNull(),
  phone: varchar("phone", { length: 20 }).notNull().unique(),
  password: text("password").notNull(),
  village: text("village").notNull(),
  joinDate: timestamp("join_date").notNull(),
  exitDate: timestamp("exit_date"),
  role: varchar("role", { length: 20 }).notNull().default("member"),
  preferredLanguage: varchar("preferred_language", { length: 10 }),
  groupId: varchar("group_id", { length: 36 }).notNull(),
  status: varchar("status", { length: 20 }).notNull().default("active"),
  contributionStartMonth: varchar("contribution_start_month", { length: 7 }),
});

export const groups = pgTable("groups", {
  id: varchar("id", { length: 36 })
    .primaryKey()
    .default(sql`gen_random_uuid()`),
  groupId: varchar("group_id", { length: 100 }).notNull().unique(),
  uniqueGroupCode: varchar("unique_group_code", { length: 20 }).unique(),
  name: text("name").notNull(),
  village: text("village"),
  taluka: text("taluka"),
  district: text("district"),
  preferredLanguage: varchar("preferred_language", { length: 10 }).notNull().default("mr"),
  status: varchar("status", { length: 20 }).notNull().default("pending"),
  presidentId: varchar("president_id", { length: 36 }),
  treasurerId: varchar("treasurer_id", { length: 36 }),
  qrCode: text("qr_code"),
  createdBySuperAdmin: varchar("created_by_super_admin", { length: 36 }),
  activatedOn: timestamp("activated_on"),
  createdAt: timestamp("created_at").notNull().default(sql`now()`),
});

export const invitationCodes = pgTable("invitation_codes", {
  id: varchar("id", { length: 36 })
    .primaryKey()
    .default(sql`gen_random_uuid()`),
  code: varchar("code", { length: 10 }).notNull().unique(),
  groupId: varchar("group_id", { length: 36 }).notNull(),
  active: boolean("active").notNull().default(true),
  expiresAt: timestamp("expires_at"),
  maxUses: integer("max_uses").notNull().default(1),
  currentUses: integer("current_uses").notNull().default(0),
  createdBy: varchar("created_by", { length: 36 }).notNull(),
  createdAt: timestamp("created_at").notNull().default(sql`now()`),
});

export const invitationCodeUsage = pgTable("invitation_code_usage", {
  id: varchar("id", { length: 36 })
    .primaryKey()
    .default(sql`gen_random_uuid()`),
  invitationCodeId: varchar("invitation_code_id", { length: 36 }).notNull(),
  userId: varchar("user_id", { length: 36 }).notNull(),
  usedAt: timestamp("used_at").notNull().default(sql`now()`),
});

export const sessions = pgTable("sessions", {
  token: varchar("token", { length: 36 }).primaryKey(),
  userId: varchar("user_id", { length: 36 }).notNull(),
  createdAt: timestamp("created_at").notNull().default(sql`now()`),
});

export const meetings = pgTable("meetings", {
  id: varchar("id", { length: 36 })
    .primaryKey()
    .default(sql`gen_random_uuid()`),
  groupId: varchar("group_id", { length: 36 }).notNull(),
  scheduledDate: timestamp("scheduled_date").notNull(),
  agenda: text("agenda").notNull().default(""),
  notes: text("notes").notNull().default(""),
  attendance: jsonb("attendance").notNull().default(sql`'[]'::jsonb`),
  status: varchar("status", { length: 20 }).notNull().default("scheduled"),
  createdBy: varchar("created_by", { length: 36 }).notNull(),
  createdAt: timestamp("created_at").notNull().default(sql`now()`),
});

export const payments = pgTable("payments", {
  id: varchar("id", { length: 36 })
    .primaryKey()
    .default(sql`gen_random_uuid()`),
  groupId: varchar("group_id", { length: 36 }).notNull(),
  memberId: varchar("member_id", { length: 36 }).notNull(),
  memberName: text("member_name").notNull(),
  amount: integer("amount").notNull(),
  expectedAmount: integer("expected_amount").notNull().default(0),
  lateFee: integer("late_fee").notNull().default(0),
  month: varchar("month", { length: 7 }).default(""),
  dueDate: timestamp("due_date"),
  date: timestamp("date").notNull().default(sql`now()`),
  mode: varchar("mode", { length: 20 }).notNull().default("cash"),
  status: varchar("status", { length: 30 }).notNull().default("pending"),
  verifiedBy: varchar("verified_by", { length: 36 }),
  verifiedAt: timestamp("verified_at"),
  rejectionReason: text("rejection_reason"),
  rejectedBy: varchar("rejected_by", { length: 36 }),
  rejectedAt: timestamp("rejected_at"),
}, (t) => ({
  paymentGroupMemberMonthIdx: index("payment_group_member_month_idx").on(t.groupId, t.memberId, t.month),
}));

export const loans = pgTable("loans", {
  id: varchar("id", { length: 36 })
    .primaryKey()
    .default(sql`gen_random_uuid()`),
  groupId: varchar("group_id", { length: 36 }).notNull(),
  memberId: varchar("member_id", { length: 36 }).notNull(),
  memberName: text("member_name").notNull(),
  resolutionNo: text("resolution_no").notNull(),
  amount: integer("amount").notNull(),
  interest: real("interest").notNull(),
  duration: integer("duration").notNull(),
  remainingBalance: integer("remaining_balance").notNull(),
  status: varchar("status", { length: 30 }).notNull().default("pending_treasurer"),
  treasurerActionBy: varchar("treasurer_action_by", { length: 36 }),
  treasurerActionAt: timestamp("treasurer_action_at"),
  approvedBy: varchar("approved_by", { length: 36 }),
  approvedAt: timestamp("approved_at"),
  meetingId: varchar("meeting_id", { length: 36 }),
  createdAt: timestamp("created_at").notNull().default(sql`now()`),
  rejectionReason: text("rejection_reason"),
  rejectedBy: varchar("rejected_by", { length: 36 }),
  rejectedAt: timestamp("rejected_at"),
}, (t) => ({
  loanMemberIdx: index("loan_member_idx").on(t.memberId),
}));

export const loanRepayments = pgTable("loan_repayments", {
  id: varchar("id", { length: 36 })
    .primaryKey()
    .default(sql`gen_random_uuid()`),
  loanId: varchar("loan_id", { length: 36 }).notNull(),
  amount: integer("amount").notNull(),
  date: timestamp("date").notNull().default(sql`now()`),
  recordedBy: varchar("recorded_by", { length: 36 }).notNull(),
});

export const groupSettings = pgTable("group_settings", {
  groupId: varchar("group_id", { length: 36 }).primaryKey(),
  settings: jsonb("settings").notNull(),
});

export const groupRules = pgTable("group_rules", {
  groupId: varchar("group_id", { length: 36 }).primaryKey(),
  rules: text("rules").notNull().default(""),
});

export const cronLocks = pgTable("cron_locks", {
  jobName: varchar("job_name", { length: 50 }).primaryKey(),
  lockedAt: timestamp("locked_at").notNull().default(sql`now()`),
});

export type InvitationCode = typeof invitationCodes.$inferSelect;
export type InvitationCodeUsage = typeof invitationCodeUsage.$inferSelect;
