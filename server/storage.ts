// @ts-nocheck
import { randomUUID } from "crypto";
import { eq, inArray, and } from "drizzle-orm";
import { getDb } from "./db";
import * as schema from "../shared/schema";

export type UserRole = "president" | "treasurer" | "member";

export interface User {
  id: string;
  name: string;
  phone: string;
  password: string;
  village: string;
  joinDate: string;
  exitDate?: string;
  role: UserRole;
  groupId: string;
  status: "active" | "left";
  preferredLanguage?: string;
  contributionStartMonth?: string;
}

export interface Group {
  id: string;
  groupId: string;
  name: string;
  village?: string;
  taluka?: string;
  district?: string;
  presidentId: string | null;
  treasurerId?: string;
  qrCode?: string;
  uniqueGroupCode?: string;
  preferredLanguage: string;
  status: "pending" | "active" | "suspended" | "inactive";
  createdBySuperAdmin?: string;
  activatedOn?: Date;
  createdAt: Date;
}

export interface Meeting {
  id: string;
  groupId: string;
  scheduledDate: string;
  agenda: string;
  notes: string;
  attendance: string[];
  status: "scheduled" | "completed" | "cancelled";
  createdBy: string;
  createdAt: string;
}

export type PaymentMode = "cash" | "online";
export type PaymentStatus =
  | "pending"
  | "pending_verification"
  | "confirmed"
  | "payment_not_received"
  | "rejected";

export interface Payment {
  id: string;
  groupId: string;
  memberId: string;
  memberName: string;
  amount: number;
  expectedAmount: number;
  lateFee: number;
  month: string | null;
  dueDate: string | null;
  date: string;
  mode: PaymentMode;
  status: PaymentStatus;
  verifiedBy?: string;
  verifiedAt?: string;
  rejectionReason?: string;
  rejectedBy?: string;
  rejectedAt?: string;
  overriddenBy?: string;
  overrideReason?: string;
  overrideAt?: string;
}

export type LoanStatus =
  | "pending_treasurer"
  | "pending_president"
  | "treasurer_rejected"
  | "approved"
  | "rejected";

export interface Loan {
  id: string;
  groupId: string;
  memberId: string;
  memberName: string;
  resolutionNo: string;
  amount: number;
  interest: number;
  duration: number;
  remainingBalance: number;
  status: LoanStatus;
  treasurerActionBy?: string;
  treasurerActionAt?: string;
  approvedBy?: string;
  approvedAt?: string;
  meetingId?: string;
  createdAt: string;
  rejectionReason?: string;
  rejectedBy?: string;
  rejectedAt?: string;
  presidentOverride?: boolean;
  overrideReason?: string;
  overrideAt?: string;
}

export interface LoanRepayment {
  id: string;
  loanId: string;
  amount: number;
  date: string;
  recordedBy: string;
}

export interface DurationRule {
  maxAmount: number;
  minDuration: number;
  maxDuration: number;
}

export interface GroupSettings {
  interestRate: number;
  maxLoanAmount: number;
  durationRules: DurationRule[];
  monthlyContributionAmount: number;
  contributionDueDay: number;
  lateFeeAmount: number;
  lateFeeType: "fixed" | "percentage";
  gracePeriodDays: number;
}

export interface Session {
  token: string;
  userId: string;
  createdAt: Date;
}

const DEFAULT_SETTINGS: GroupSettings = {
  interestRate: 2,
  maxLoanAmount: 50000,
  durationRules: [
    { maxAmount: 5000, minDuration: 1, maxDuration: 6 },
    { maxAmount: 20000, minDuration: 3, maxDuration: 12 },
    { maxAmount: 50000, minDuration: 6, maxDuration: 24 },
  ],
  monthlyContributionAmount: 100,
  contributionDueDay: 5,
  lateFeeAmount: 10,
  lateFeeType: "fixed",
  gracePeriodDays: 5,
};

export interface IStorage {
  createSession(userId: string): Promise<Session>;
  getSession(token: string): Promise<Session | undefined>;
  deleteSession(token: string): Promise<void>;

  getUserById(id: string): Promise<User | undefined>;
  getUserByPhone(phone: string): Promise<User | undefined>;
  getUsersByGroupId(groupId: string): Promise<User[]>;
  createUser(user: Omit<User, "id">): Promise<User>;
  updateUser(id: string, data: Partial<User>): Promise<User | undefined>;

  getGroupByGroupId(groupId: string): Promise<Group | undefined>;
  getAllGroups(): Promise<Group[]>;
  createGroup(group: Omit<Group, "id">): Promise<Group>;
  updateGroup(groupId: string, data: Partial<Group>): Promise<Group | undefined>;

  getMeetingsByGroupId(groupId: string): Promise<Meeting[]>;
  getMeetingById(id: string): Promise<Meeting | undefined>;
  createMeeting(meeting: Omit<Meeting, "id">): Promise<Meeting>;
  updateMeeting(id: string, data: Partial<Meeting>): Promise<Meeting | undefined>;
  deleteMeeting(id: string): Promise<void>;

  getPaymentsByGroupId(groupId: string): Promise<Payment[]>;
  getPaymentsForMember(groupId: string, memberId: string): Promise<Payment[]>;
  getPaymentById(id: string): Promise<Payment | undefined>;
  createPayment(payment: Omit<Payment, "id">): Promise<Payment>;
  updatePayment(id: string, data: Partial<Payment>): Promise<Payment | undefined>;
  deletePayment(id: string): Promise<void>;

  getLoansByGroupId(groupId: string): Promise<Loan[]>;
  getLoansForMember(groupId: string, memberId: string): Promise<Loan[]>;
  getLoanById(id: string): Promise<Loan | undefined>;
  createLoan(loan: Omit<Loan, "id">): Promise<Loan>;
  updateLoan(id: string, data: Partial<Loan>): Promise<Loan | undefined>;
  deleteLoan(id: string): Promise<void>;

  getRepaymentsByLoanId(loanId: string): Promise<LoanRepayment[]>;
  getRepaymentsByGroupId(groupId: string): Promise<LoanRepayment[]>;
  createRepayment(repayment: Omit<LoanRepayment, "id">): Promise<LoanRepayment>;
  deleteRepayment(id: string): Promise<void>;

  getGroupSettings(groupId: string): Promise<GroupSettings>;
  updateGroupSettings(groupId: string, settings: GroupSettings): Promise<void>;

  getGroupRules(groupId: string): Promise<string>;
  updateGroupRules(groupId: string, rules: string): Promise<void>;

  acquireCronLock(jobName: string): Promise<boolean>;

  // Super Admin & Invitations
  getGroupByUniqueGroupCode(code: string): Promise<Group | undefined>;
  getInvitationCode(code: string): Promise<schema.InvitationCode | undefined>;
  getInvitationCodesByGroup(groupId: string): Promise<schema.InvitationCode[]>;
  createInvitationCode(data: Omit<schema.InvitationCode, "id" | "createdAt" | "currentUses">): Promise<schema.InvitationCode>;
  incrementInvitationCodeUsage(codeId: string, userId: string): Promise<void>;
}

export class MemStorage implements IStorage {
  private sessions = new Map<string, Session>();
  private users = new Map<string, User>();
  private groups = new Map<string, Group>();
  private meetings = new Map<string, Meeting>();
  private payments = new Map<string, Payment>();
  private loans = new Map<string, Loan>();
  private repayments = new Map<string, LoanRepayment>();
  private groupSettings = new Map<string, GroupSettings>();
  private groupRules = new Map<string, string>();

  async createSession(userId: string): Promise<Session> {
    const token = randomUUID();
    const session: Session = { token, userId, createdAt: new Date() };
    this.sessions.set(token, session);
    return session;
  }

  async getSession(token: string): Promise<Session | undefined> {
    return this.sessions.get(token);
  }

  async deleteSession(token: string): Promise<void> {
    this.sessions.delete(token);
  }

  async getUserById(id: string): Promise<User | undefined> {
    return this.users.get(id);
  }

  async getUserByPhone(phone: string): Promise<User | undefined> {
    return Array.from(this.users.values()).find((u) => u.phone === phone);
  }

  async getUsersByGroupId(groupId: string): Promise<User[]> {
    return Array.from(this.users.values()).filter((u) => u.groupId === groupId);
  }

  async createUser(data: Omit<User, "id">): Promise<User> {
    const id = randomUUID();
    const user: User = { ...data, id };
    this.users.set(id, user);
    return user;
  }

  async updateUser(id: string, data: Partial<User>): Promise<User | undefined> {
    const user = this.users.get(id);
    if (!user) return undefined;
    const updated = { ...user, ...data };
    this.users.set(id, updated);
    return updated;
  }

  async getGroupByGroupId(groupId: string): Promise<Group | undefined> {
    return Array.from(this.groups.values()).find((g) => g.groupId === groupId);
  }

  async getGroupByUniqueGroupCode(code: string): Promise<Group | undefined> {
    return Array.from(this.groups.values()).find((g) => g.uniqueGroupCode === code);
  }

  async getAllGroups(): Promise<Group[]> {
    return Array.from(this.groups.values());
  }

  async createGroup(data: Omit<Group, "id">): Promise<Group> {
    const id = randomUUID();
    const group: Group = { ...data, id };
    this.groups.set(id, group);
    return group;
  }

  async updateGroup(groupId: string, data: Partial<Group>): Promise<Group | undefined> {
    const group = Array.from(this.groups.values()).find((g) => g.groupId === groupId);
    if (!group) return undefined;
    const updated = { ...group, ...data };
    this.groups.set(group.id, updated);
    return updated;
  }

  async getMeetingsByGroupId(groupId: string): Promise<Meeting[]> {
    return Array.from(this.meetings.values()).filter((m) => m.groupId === groupId);
  }

  async getMeetingById(id: string): Promise<Meeting | undefined> {
    return this.meetings.get(id);
  }

  async createMeeting(data: Omit<Meeting, "id">): Promise<Meeting> {
    const id = randomUUID();
    const meeting: Meeting = { ...data, id };
    this.meetings.set(id, meeting);
    return meeting;
  }

  async updateMeeting(id: string, data: Partial<Meeting>): Promise<Meeting | undefined> {
    const meeting = this.meetings.get(id);
    if (!meeting) return undefined;
    const updated = { ...meeting, ...data };
    this.meetings.set(id, updated);
    return updated;
  }

  async deleteMeeting(id: string): Promise<void> {
    this.meetings.delete(id);
  }

  async getPaymentsByGroupId(groupId: string): Promise<Payment[]> {
    return Array.from(this.payments.values()).filter((p) => p.groupId === groupId);
  }

  async getPaymentsForMember(groupId: string, memberId: string): Promise<Payment[]> {
    return Array.from(this.payments.values()).filter((p) => p.groupId === groupId && p.memberId === memberId);
  }

  async getPaymentById(id: string): Promise<Payment | undefined> {
    return this.payments.get(id);
  }

  async createPayment(data: Omit<Payment, "id">): Promise<Payment> {
    const id = randomUUID();
    const payment: Payment = { ...data, id };
    this.payments.set(id, payment);
    return payment;
  }

  async updatePayment(id: string, data: Partial<Payment>): Promise<Payment | undefined> {
    const payment = this.payments.get(id);
    if (!payment) return undefined;
    const updated = { ...payment, ...data };
    this.payments.set(id, updated);
    return updated;
  }

  async deletePayment(id: string): Promise<void> {
    this.payments.delete(id);
  }

  async getLoansByGroupId(groupId: string): Promise<Loan[]> {
    return Array.from(this.loans.values()).filter((l) => l.groupId === groupId) as unknown as Loan[];
  }

  async getLoansForMember(groupId: string, memberId: string): Promise<Loan[]> {
    return Array.from(this.loans.values()).filter((l) => l.groupId === groupId && l.memberId === memberId);
  }

  async getLoanById(id: string): Promise<Loan | undefined> {
    return this.loans.get(id);
  }

  async createLoan(data: Omit<Loan, "id">): Promise<Loan> {
    const id = randomUUID();
    const loan: Loan = { ...data, id };
    this.loans.set(id, loan as unknown as Loan);
    return loan;
  }

  async updateLoan(id: string, data: Partial<Loan>): Promise<Loan | undefined> {
    const loan = this.loans.get(id);
    if (!loan) return undefined;
    const updated = { ...loan, ...data };
    this.loans.set(id, updated);
    return updated;
  }

  async deleteLoan(id: string): Promise<void> {
    // cascade: remove all repayments for this loan
    for (const [rid, r] of this.repayments.entries()) {
      if (r.loanId === id) this.repayments.delete(rid);
    }
    this.loans.delete(id);
  }

  async getRepaymentsByLoanId(loanId: string): Promise<LoanRepayment[]> {
    return Array.from(this.repayments.values()).filter((r) => r.loanId === loanId);
  }

  async getRepaymentsByGroupId(groupId: string): Promise<LoanRepayment[]> {
    const groupLoans = await this.getLoansByGroupId(groupId);
    const loanIds = new Set(groupLoans.map((l) => l.id));
    return Array.from(this.repayments.values()).filter((r) => loanIds.has(r.loanId));
  }

  async createRepayment(data: Omit<LoanRepayment, "id">): Promise<LoanRepayment> {
    const id = randomUUID();
    const repayment: LoanRepayment = { ...data, id };
    this.repayments.set(id, repayment);
    return repayment;
  }

  async deleteRepayment(id: string): Promise<void> {
    this.repayments.delete(id);
  }

  async getGroupSettings(groupId: string): Promise<GroupSettings> {
    return this.groupSettings.get(groupId) ?? { ...DEFAULT_SETTINGS };
  }

  async updateGroupSettings(groupId: string, settings: GroupSettings): Promise<void> {
    this.groupSettings.set(groupId, settings);
  }

  async getGroupRules(groupId: string): Promise<string> {
    return this.groupRules.get(groupId) ?? "";
  }

  async updateGroupRules(groupId: string, rules: string): Promise<void> {
    this.groupRules.set(groupId, rules);
  }

  async acquireCronLock(jobName: string): Promise<boolean> {
    // In-memory doesn't have multiple instances competing
    return true;
  }
}

export class DatabaseStorage implements IStorage {
  private get db() {
    return getDb();
  }

  async createSession(userId: string): Promise<Session> {
    const token = randomUUID();
    await this.db.insert(schema.sessions).values({ token, userId, createdAt: new Date() });
    return { token, userId, createdAt: new Date() };
  }

  async getSession(token: string): Promise<Session | undefined> {
    const rows = await this.db.select().from(schema.sessions).where(eq(schema.sessions.token, token));
    const row = rows[0];
    if (!row) return undefined;
    return { token: row.token, userId: row.userId, createdAt: row.createdAt };
  }

  async deleteSession(token: string): Promise<void> {
    await this.db.delete(schema.sessions).where(eq(schema.sessions.token, token));
  }

  async getUserById(id: string): Promise<User | undefined> {
    const rows = await this.db.select().from(schema.users).where(eq(schema.users.id, id));
    return rows[0] as User | undefined;
  }

  async getUserByPhone(phone: string): Promise<User | undefined> {
    const rows = await this.db.select().from(schema.users).where(eq(schema.users.phone, phone));
    return rows[0] as User | undefined;
  }

  async getUsersByGroupId(groupId: string): Promise<User[]> {
    const rows = await this.db.select().from(schema.users).where(eq(schema.users.groupId, groupId));
    return rows as User[];
  }

  async createUser(data: Omit<User, "id">): Promise<User> {
    const id = randomUUID();
    await this.db.insert(schema.users).values({ ...data, id });
    return { ...data, id };
  }

  async updateUser(id: string, data: Partial<User>): Promise<User | undefined> {
    await this.db.update(schema.users).set(data).where(eq(schema.users.id, id));
    return this.getUserById(id);
  }

  async getGroupByGroupId(groupId: string): Promise<Group | undefined> {
    const rows = await this.db.select().from(schema.groups).where(eq(schema.groups.groupId, groupId));
    return rows[0] as Group | undefined;
  }

  async getGroupByUniqueGroupCode(code: string): Promise<Group | undefined> {
    const rows = await this.db.select().from(schema.groups).where(eq(schema.groups.uniqueGroupCode, code));
    return rows[0] as Group | undefined;
  }

  async getAllGroups(): Promise<Group[]> {
    const rows = await this.db.select().from(schema.groups);
    return rows as Group[];
  }

  async createGroup(data: Omit<Group, "id">): Promise<Group> {
    const id = randomUUID();
    await this.db.insert(schema.groups).values({ ...data, id });
    return { ...data, id };
  }

  async updateGroup(groupId: string, data: Partial<Group>): Promise<Group | undefined> {
    await this.db.update(schema.groups).set(data).where(eq(schema.groups.groupId, groupId));
    return this.getGroupByGroupId(groupId);
  }

  async getMeetingsByGroupId(groupId: string): Promise<Meeting[]> {
    const rows = await this.db.select().from(schema.meetings).where(eq(schema.meetings.groupId, groupId));
    return rows.map((r) => ({ ...r, attendance: r.attendance as string[] })) as Meeting[];
  }

  async getMeetingById(id: string): Promise<Meeting | undefined> {
    const rows = await this.db.select().from(schema.meetings).where(eq(schema.meetings.id, id));
    const r = rows[0];
    if (!r) return undefined;
    return { ...r, attendance: r.attendance as string[] } as Meeting;
  }

  async createMeeting(data: Omit<Meeting, "id">): Promise<Meeting> {
    const id = randomUUID();
    await this.db.insert(schema.meetings).values({ ...data, id, attendance: data.attendance });
    return { ...data, id };
  }

  async updateMeeting(id: string, data: Partial<Meeting>): Promise<Meeting | undefined> {
    await this.db.update(schema.meetings).set(data).where(eq(schema.meetings.id, id));
    return this.getMeetingById(id);
  }

  async deleteMeeting(id: string): Promise<void> {
    await this.db.delete(schema.meetings).where(eq(schema.meetings.id, id));
  }

  async getPaymentsByGroupId(groupId: string): Promise<Payment[]> {
    const rows = await this.db.select().from(schema.payments).where(eq(schema.payments.groupId, groupId));
    return rows as Payment[];
  }

  async getPaymentsForMember(groupId: string, memberId: string): Promise<Payment[]> {
    const rows = await this.db.select().from(schema.payments).where(
      and(eq(schema.payments.groupId, groupId), eq(schema.payments.memberId, memberId))
    );
    return rows as Payment[];
  }

  async getPaymentById(id: string): Promise<Payment | undefined> {
    const rows = await this.db.select().from(schema.payments).where(eq(schema.payments.id, id));
    return rows[0] as Payment | undefined;
  }

  async createPayment(data: Omit<Payment, "id">): Promise<Payment> {
    const id = randomUUID();
    await this.db.insert(schema.payments).values({ ...data, id });
    return { ...data, id };
  }

  async updatePayment(id: string, data: Partial<Payment>): Promise<Payment | undefined> {
    await this.db.update(schema.payments).set(data).where(eq(schema.payments.id, id));
    return this.getPaymentById(id);
  }

  async deletePayment(id: string): Promise<void> {
    await this.db.delete(schema.payments).where(eq(schema.payments.id, id));
  }

  async getLoansByGroupId(groupId: string): Promise<Loan[]> {
    const rows = await this.db.select().from(schema.loans).where(eq(schema.loans.groupId, groupId));
    return rows as Loan[];
  }

  async getLoansForMember(groupId: string, memberId: string): Promise<Loan[]> {
    const rows = await this.db.select().from(schema.loans).where(
      and(eq(schema.loans.groupId, groupId), eq(schema.loans.memberId, memberId))
    );
// @ts-expect-error
    return rows as Loan[];
  }

  async getLoanById(id: string): Promise<Loan | undefined> {
    const rows = await this.db.select().from(schema.loans).where(eq(schema.loans.id, id));
// @ts-expect-error
    return rows[0] as Loan | undefined;
  }

  async createLoan(data: Omit<Loan, "id">): Promise<Loan> {
    const id = randomUUID();
// @ts-expect-error
    await this.db.insert(schema.loans).values({ ...data, id });
    return { ...data, id };
  }

  async updateLoan(id: string, data: Partial<Loan>): Promise<Loan | undefined> {
// @ts-expect-error
    await this.db.update(schema.loans).set(data).where(eq(schema.loans.id, id));
    return this.getLoanById(id);
  }

  async deleteLoan(id: string): Promise<void> {
    await this.db.delete(schema.loanRepayments).where(eq(schema.loanRepayments.loanId, id));
    await this.db.delete(schema.loans).where(eq(schema.loans.id, id));
  }

  async getRepaymentsByLoanId(loanId: string): Promise<LoanRepayment[]> {
    const rows = await this.db.select().from(schema.loanRepayments).where(eq(schema.loanRepayments.loanId, loanId));
// @ts-expect-error
    return rows as LoanRepayment[];
  }

  async getRepaymentsByGroupId(groupId: string): Promise<LoanRepayment[]> {
    const groupLoans = await this.getLoansByGroupId(groupId);
    if (groupLoans.length === 0) return [];
    const loanIds = groupLoans.map((l) => l.id);
    const rows = await this.db.select().from(schema.loanRepayments).where(inArray(schema.loanRepayments.loanId, loanIds));
// @ts-expect-error
    return rows as LoanRepayment[];
  }

  async createRepayment(data: Omit<LoanRepayment, "id">): Promise<LoanRepayment> {
    const id = randomUUID();
// @ts-expect-error
    await this.db.insert(schema.loanRepayments).values({ ...data, id });
    return { ...data, id };
  }

  async deleteRepayment(id: string): Promise<void> {
    await this.db.delete(schema.loanRepayments).where(eq(schema.loanRepayments.id, id));
  }

  async getGroupSettings(groupId: string): Promise<GroupSettings> {
    const rows = await this.db.select().from(schema.groupSettings).where(eq(schema.groupSettings.groupId, groupId));
    if (!rows[0]) return { ...DEFAULT_SETTINGS };
    return rows[0].settings as GroupSettings;
  }

  async updateGroupSettings(groupId: string, settings: GroupSettings): Promise<void> {
    await this.db
      .insert(schema.groupSettings)
      .values({ groupId, settings })
      .onConflictDoUpdate({ target: schema.groupSettings.groupId, set: { settings } });
  }

  async getGroupRules(groupId: string): Promise<string> {
    const rows = await this.db.select().from(schema.groupRules).where(eq(schema.groupRules.groupId, groupId));
    return rows[0]?.rules ?? "";
  }

  async updateGroupRules(groupId: string, rules: string): Promise<void> {
    await this.db
      .insert(schema.groupRules)
      .values({ groupId, rules })
      .onConflictDoUpdate({ target: schema.groupRules.groupId, set: { rules } });
  }

  async acquireCronLock(jobName: string): Promise<boolean> {
    const now = new Date();
    try {
      // Try to insert or update the lock only if it's been more than 5 minutes since the last run
      // Actually we just need a simple lock. If we use a naive upsert, it will always succeed.
      // For a distributed lock, we can check if it was recently run.
      // Let's fetch first.
      const existing = await this.db.select().from(schema.cronLocks).where(eq(schema.cronLocks.jobName, jobName));
      if (existing.length > 0) {
        const lastRun = new Date(existing[0].lockedAt).getTime();
        if (Date.now() - lastRun < 1000 * 60 * 5) { // 5 minutes threshold
          return false; // recently run, abort
        }
      }
      
      await this.db
        .insert(schema.cronLocks)
        .values({ jobName, lockedAt: new Date() })
        .onConflictDoUpdate({ target: schema.cronLocks.jobName, set: { lockedAt: new Date() } });
      return true;
    } catch (e) {
      return false;
    }
  }

  async getInvitationCode(code: string): Promise<schema.InvitationCode | undefined> {
    const rows = await this.db.select().from(schema.invitationCodes).where(eq(schema.invitationCodes.code, code));
    return rows[0];
  }

  async getInvitationCodesByGroup(groupId: string): Promise<schema.InvitationCode[]> {
    const rows = await this.db.select().from(schema.invitationCodes).where(eq(schema.invitationCodes.groupId, groupId));
    return rows;
  }

  async createInvitationCode(data: Omit<schema.InvitationCode, "id" | "createdAt" | "currentUses">): Promise<schema.InvitationCode> {
    const id = randomUUID();
// @ts-expect-error
    await this.db.insert(schema.invitationCodes).values({ ...data, id, currentUses: 0, createdAt: new Date() });
    const rows = await this.db.select().from(schema.invitationCodes).where(eq(schema.invitationCodes.id, id));
    return rows[0];
  }

  async incrementInvitationCodeUsage(codeId: string, userId: string): Promise<void> {
    await this.db.transaction(async (tx) => {
      const rows = await tx.select().from(schema.invitationCodes).where(eq(schema.invitationCodes.id, codeId));
      if (!rows.length) throw new Error("Invalid code");
      const code = rows[0];
      if (code.currentUses >= code.maxUses) throw new Error("Code limit reached");
      
      await tx.update(schema.invitationCodes).set({ currentUses: code.currentUses + 1 }).where(eq(schema.invitationCodes.id, codeId));
      await tx.insert(schema.invitationCodeUsage).values({
        id: randomUUID(),
        invitationCodeId: codeId,
        userId,
        usedAt: new Date()
      });
    });
  }
}

export const storage: IStorage = (process.env.SUPABASE_DATABASE_URL ?? process.env.DATABASE_URL)
  ? new DatabaseStorage()
  : new MemStorage();
