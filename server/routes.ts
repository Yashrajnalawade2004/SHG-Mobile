// @ts-nocheck
import type { Express, Request, Response, NextFunction } from "express";
import { createServer, type Server } from "node:http";
import { storage } from "./storage";
import { registerSuperAdminRoutes } from "./super-admin-routes";
import { registerInvitationRoutes } from "./invitation-routes";
import { resolveRepaymentAmounts, calculateNextLedgerEntry } from "../shared/accounting";
import Groq from "groq-sdk";
import { getDb } from "./db";
import * as schema from "../shared/schema";

export interface AuthRequest extends Request {
  currentUser?: Awaited<ReturnType<typeof storage.getUserById>>;
  currentSession?: { token: string; userId: string };
}

export async function requireAuth(
  req: AuthRequest,
  res: Response,
  next: NextFunction,
) {
  const auth = req.headers.authorization;
  if (!auth || !auth.startsWith("Bearer ")) {
    console.log("requireAuth 401: Missing or invalid auth header", auth);
    return res.status(401).json({ error: "Unauthorized" });
  }
  const token = auth.slice(7);
  const session = await storage.getSession(token);
  if (!session) {
    console.log("requireAuth 401: Session not found for token", token);
    return res.status(401).json({ error: "Invalid or expired session" });
  }
  const user = await storage.getUserById(session.userId);
  if (!user) {
    console.log("requireAuth 401: User not found for session", session.userId);
    return res.status(401).json({ error: "User not found" });
  }
  req.currentUser = user;
  req.currentSession = session;
  next();
}

export function requirePresident(req: AuthRequest, res: Response, next: NextFunction) {
  if (req.currentUser?.role !== "president") {
    return res.status(403).json({ error: "President access required" });
  }
  next();
}

export function requirePresidentOrTreasurer(req: AuthRequest, res: Response, next: NextFunction) {
  if (req.currentUser?.role !== "president" && req.currentUser?.role !== "treasurer") {
    return res.status(403).json({ error: "President or Treasurer access required" });
  }
  next();
}

export function requireSameGroup(
  groupId: string,
  req: AuthRequest,
  res: Response,
  next: NextFunction,
) {
  if (req.currentUser?.groupId !== groupId) {
    return res.status(403).json({ error: "Access denied: different group" });
  }
  next();
}

export async function registerRoutes(app: Express): Promise<Server> {
  // ─── SUPER ADMIN & INVITATIONS ──────────────────────────────────────────────
  registerSuperAdminRoutes(app);
  registerInvitationRoutes(app);

  // ─── AUTH ───────────────────────────────────────────────────────────────────

  app.post("/api/auth/register/president", async (req, res) => {
    try {
      const {
        name,
        phone,
        password,
        village,
        joinDate,
        exitDate,
        uniqueGroupCode,
      } = req.body;
      if (!name || !phone || !password || !village || !uniqueGroupCode) {
        return res.status(400).json({ error: "Missing required fields" });
      }

      const existingGroup = await storage.getGroupByUniqueGroupCode(uniqueGroupCode);
      if (!existingGroup) {
        return res.status(404).json({ error: "groupNotFound" });
      }
      
      if (existingGroup.presidentId || existingGroup.status !== "pending") {
        return res.status(409).json({ error: "Group already claimed" });
      }

      const existingPhone = await storage.getUserByPhone(phone);
      if (existingPhone) {
        return res.status(409).json({ error: "Phone number already registered" });
      }

      const user = await storage.createUser({
        name,
        phone,
        password,
        village,
        joinDate: joinDate ? new Date(joinDate) : new Date(),
        exitDate: exitDate ? new Date(exitDate) : undefined,
        role: "president",
        groupId: existingGroup.groupId,
        status: "active",
        preferredLanguage: existingGroup.preferredLanguage,
      });

      await storage.updateGroup(existingGroup.groupId, {
        presidentId: user.id,
        status: "active",
        activatedOn: new Date(),
      });

      const session = await storage.createSession(user.id);
      const group = await storage.getGroupByGroupId(existingGroup.groupId);
      const { password: _p, ...safeUser } = user;
      return res
        .status(201)
        .json({ token: session.token, user: safeUser, group });
    } catch (e) {
      console.error(e);
      return res.status(500).json({ error: "Internal server error" });
    }
  });

  app.post("/api/auth/register/member", async (req, res) => {
    try {
      const { name, phone, password, village, joinDate, exitDate, uniqueGroupCode } = req.body;
      if (!name || !phone || !password || !village || !uniqueGroupCode) {
        return res.status(400).json({ error: "Missing required fields" });
      }

      const group = await storage.getGroupByUniqueGroupCode(uniqueGroupCode);
      if (!group) {
        return res.status(404).json({ error: "invalidOrExpiredCode" });
      }
      if (group.status === "pending") {
        return res.status(404).json({ error: "groupNotFound" });
      }
      const existingPhone = await storage.getUserByPhone(phone);
      if (existingPhone) {
        return res.status(409).json({ error: "Phone number already registered" });
      }

      const user = await storage.createUser({
        name,
        phone,
        password,
        village,
        joinDate: joinDate ? new Date(joinDate) : new Date(),
        exitDate: exitDate ? new Date(exitDate) : undefined,
        role: "member",
        groupId: group.groupId,
        status: "active",
        preferredLanguage: group.preferredLanguage,
      });

      const session = await storage.createSession(user.id);
      const { password: _p, ...safeUser } = user;
      return res
        .status(201)
        .json({ token: session.token, user: safeUser, group });
    } catch (e) {
      console.error(e);
      return res.status(500).json({ error: "Internal server error" });
    }
  });

  app.post("/api/auth/login", async (req, res) => {
    try {
      const { phone, password } = req.body;
      if (!phone || !password) {
        return res.status(400).json({ error: "Phone and password required" });
      }

      const user = await storage.getUserByPhone(phone);
      if (!user || user.password !== password) {
        return res.status(401).json({ error: "invalidCredentials" });
      }

      const session = await storage.createSession(user.id);
      const group = await storage.getGroupByGroupId(user.groupId);
      const { password: _p, ...safeUser } = user;
      return res.json({ token: session.token, user: safeUser, group });
    } catch (e) {
      console.error(e);
      return res.status(500).json({ error: "Internal server error" });
    }
  });

  app.post(
    "/api/auth/logout",
    requireAuth as any,
    async (req: AuthRequest, res) => {
      if (req.currentSession) {
        await storage.deleteSession(req.currentSession.token);
      }
      return res.json({ ok: true });
    },
  );

  app.get(
    "/api/auth/session",
    requireAuth as any,
    async (req: AuthRequest, res) => {
      const user = req.currentUser!;
      const group = await storage.getGroupByGroupId(user.groupId);
      const { password: _p, ...safeUser } = user;
      return res.json({ user: safeUser, group });
    },
  );

  app.patch(
    "/api/groups/:groupId",
    requireAuth as any,
    requireSameGroup as any,
    requirePresidentOrTreasurer as any,
    async (req: AuthRequest, res) => {
      const { groupId } = req.params;
      const data = req.body;
      const updatedGroup = await storage.updateGroup(groupId, data);
      if (!updatedGroup) {
        return res.status(404).json({ error: "Group not found" });
      }
      return res.json(updatedGroup);
    },
  );

  app.get(
    "/api/groups/:groupId/summary",
    requireAuth as any,
    requireSameGroup as any,
    async (req: AuthRequest, res) => {
      try {
        const { groupId } = req.params;
        const payments = await storage.getPaymentsByGroupId(groupId);
        const loans = await storage.getLoansByGroupId(groupId);
        const repayments = await storage.getRepaymentsByGroupId(groupId);
        const members = await storage.getUsersByGroupId(groupId);
        
        const activeMembers = members.filter(m => m.status === "active").length;
        const totalSavings = payments.filter(p => p.status === "confirmed" && p.amount > 0).reduce((sum, p) => sum + p.amount, 0);
        const totalPenalties = payments.filter(p => p.status === "confirmed" && p.lateFee > 0).reduce((sum, p) => sum + p.lateFee, 0);
        
        const approvedLoans = loans.filter(l => l.status === "approved");
        const totalLoanDisbursed = approvedLoans.reduce((sum, l) => sum + l.amount, 0);
        const totalOutstanding = approvedLoans.reduce((sum, l) => sum + l.remainingBalance, 0);
        const totalBankOutstanding = approvedLoans.reduce((sum, l) => sum + (l.hasBankLoan ? (l.bankRemainingBalance || 0) : 0), 0);
        const totalRepayments = repayments.reduce((sum, r) => sum + resolveRepaymentAmounts(r).shgAmount, 0);
        const totalBankRepayments = repayments.reduce((sum, r) => sum + resolveRepaymentAmounts(r).bankAmount, 0);
        
        const currentBalance = totalSavings + totalPenalties + totalRepayments - totalLoanDisbursed;
        
        const now = new Date();
        const currentMonth = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;
        const currentMonthPayments = payments.filter(p => p.month === currentMonth);
        const expectedCollection = currentMonthPayments.reduce((sum, p) => sum + p.expectedAmount, 0);
        const actualCollection = currentMonthPayments.filter(p => p.status === "confirmed").reduce((sum, p) => sum + p.amount, 0);

        return res.json({
          totalSavings,
          totalLoanDisbursed,
          totalOutstanding,
          totalBankOutstanding,
          totalRepayments,
          totalBankRepayments,
          totalPenalties,
          currentBalance,
          activeMembers,
          monthlyExpected: expectedCollection,
          monthlyCollected: actualCollection
        });
      } catch (e) {
        console.error(e);
        return res.status(500).json({ error: "Failed to load summary" });
      }
    }
  );

  app.post(
    "/api/auth/verify-password",
    requireAuth as any,
    async (req: AuthRequest, res) => {
      const { password } = req.body;
      const isValid = req.currentUser!.password === password;
      return res.json({ valid: isValid });
    },
  );

  // ─── TREASURER MANAGEMENT ───────────────────────────────────────────────────

  app.patch(
    "/api/groups/:groupId/treasurer",
    requireAuth as any,
    requirePresident as any,
    async (req: AuthRequest, res) => {
      const { groupId } = req.params;
      if (req.currentUser!.groupId !== groupId)
        return res.status(403).json({ error: "Access denied" });
      const { userId } = req.body;

      if (userId === null || userId === undefined) {
        const currentGroup = await storage.getGroupByGroupId(groupId);
        if (currentGroup?.treasurerId) {
          await storage.updateUser(currentGroup.treasurerId, {
            role: "member",
          });
        }
        const updated = await storage.updateGroup(groupId, {
          treasurerId: undefined,
        });
        return res.json(updated);
      }

      const target = await storage.getUserById(userId);
      if (!target || target.groupId !== groupId) {
        return res.status(404).json({ error: "User not found in this group" });
      }
      if (target.role === "president") {
        return res
          .status(400)
          .json({ error: "Cannot assign president as treasurer" });
      }

      const currentGroup = await storage.getGroupByGroupId(groupId);
      if (currentGroup?.treasurerId && currentGroup.treasurerId !== userId) {
        await storage.updateUser(currentGroup.treasurerId, { role: "member" });
      }

      await storage.updateUser(userId, { role: "treasurer" });
      const updated = await storage.updateGroup(groupId, {
        treasurerId: userId,
      });
      return res.json(updated);
    },
  );

  // ─── MEMBERS ────────────────────────────────────────────────────────────────

  app.get(
    "/api/groups/:groupId/members",
    requireAuth as any,
    async (req: AuthRequest, res) => {
      const { groupId } = req.params;
      if (req.currentUser!.groupId !== groupId) {
        return res.status(403).json({ error: "Access denied" });
      }
      const members = await storage.getUsersByGroupId(groupId);
      const safe = members.map(({ password: _p, ...u }) => u);
      return res.json(safe);
    },
  );

  app.patch(
    "/api/members/:memberId",
    requireAuth as any,
    requirePresident as any,
    async (req: AuthRequest, res) => {
      const { memberId } = req.params;
      const { status, contributionStartMonth } = req.body;
      
      const target = await storage.getUserById(memberId);
      if (!target || target.groupId !== req.currentUser!.groupId) {
        return res.status(404).json({ error: "Member not found" });
      }
      
      const updates: any = {};
      if (status !== undefined) {
        if (!["active", "left"].includes(status)) {
          return res.status(400).json({ error: "Invalid status" });
        }
        updates.status = status;
      }
      
      if (contributionStartMonth !== undefined) {
        updates.contributionStartMonth = contributionStartMonth;
      }
      
      const updated = await storage.updateUser(memberId, updates);
      const { password: _p, ...safe } = updated!;
      return res.json(safe);
    },
  );

  // ─── MEETINGS ───────────────────────────────────────────────────────────────

  app.get(
    "/api/groups/:groupId/meetings",
    requireAuth as any,
    async (req: AuthRequest, res) => {
      const { groupId } = req.params;
      if (req.currentUser!.groupId !== groupId)
        return res.status(403).json({ error: "Access denied" });
      const meetings = await storage.getMeetingsByGroupId(groupId);
      return res.json(meetings);
    },
  );

  app.post(
    "/api/meetings",
    requireAuth as any,
    requirePresidentOrTreasurer as any,
    async (req: AuthRequest, res) => {
      const { scheduledDate, agenda, groupId } = req.body;
      if (req.currentUser!.groupId !== groupId)
        return res.status(403).json({ error: "Access denied" });
      const meeting = await storage.createMeeting({
        groupId,
        scheduledDate: new Date(scheduledDate),
        agenda,
        createdBy: req.currentUser!.id,
        notes: "",
        status: "scheduled",
        createdAt: new Date(),
      });
      return res.status(201).json(meeting);
    },
  );

  app.delete(
    "/api/meetings/:meetingId",
    requireAuth as any,
    requirePresident as any,
    async (req: AuthRequest, res) => {
      const { meetingId } = req.params;
      const meeting = await storage.getMeetingById(meetingId);
      if (!meeting || meeting.groupId !== req.currentUser!.groupId) {
        return res.status(404).json({ error: "Meeting not found" });
      }
      await storage.deleteMeeting(meetingId);
      return res.json({ ok: true });
    },
  );

  app.patch(
    "/api/meetings/:meetingId",
    requireAuth as any,
    requirePresidentOrTreasurer as any,
    async (req: AuthRequest, res) => {
      const { meetingId } = req.params;
      const meeting = await storage.getMeetingById(meetingId);
      if (!meeting || meeting.groupId !== req.currentUser!.groupId) {
        return res.status(404).json({ error: "Meeting not found" });
      }
      const allowed = [
        "scheduledDate",
        "agenda",
        "notes",
        "attendance",
        "status",
      ];
      const updates: any = {};
      for (const key of allowed) {
        if (req.body[key] !== undefined) {
          // Treasurer cannot edit core meeting details
          if (req.currentUser!.role === "treasurer" && ["scheduledDate", "agenda", "status"].includes(key)) {
             return res.status(403).json({ error: "Treasurer cannot edit meeting details" });
          }
          updates[key] = req.body[key];
        }
      }
      const updated = await storage.updateMeeting(meetingId, updates);
      return res.json(updated);
    },
  );

  // ─── PAYMENTS ───────────────────────────────────────────────────────────────

  app.get(
    "/api/groups/:groupId/payments",
    requireAuth as any,
    async (req: AuthRequest, res) => {
      const { groupId } = req.params;
      if (req.currentUser!.groupId !== groupId)
        return res.status(403).json({ error: "Access denied" });
        
      const user = req.currentUser!;
      const payments = user.role === "member" 
        ? await storage.getPaymentsForMember(groupId, user.id)
        : await storage.getPaymentsByGroupId(groupId);
        
      return res.json(payments);
    },
  );

  app.post(
    "/api/groups/:groupId/payments",
    requireAuth as any,
    async (req: AuthRequest, res) => {
      const { groupId } = req.params;
      if (req.currentUser!.groupId !== groupId)
        return res.status(403).json({ error: "Access denied" });
      const { amount, mode } = req.body;
      if (!amount || amount <= 0)
        return res.status(400).json({ error: "Valid amount required" });
      const paymentMode = mode === "online" ? "online" : "cash";
      const user = req.currentUser!;
      const payment = await storage.createPayment({
        groupId,
        memberId: user.id,
        memberName: user.name,
        amount: Number(amount),
        expectedAmount: 0,
        lateFee: 0,
        month: "",
        date: new Date(),
        mode: paymentMode,
        status: paymentMode === "online" ? "pending_verification" : "pending",
      });
      return res.status(201).json(payment);
    },
  );

  app.patch(
    "/api/payments/:paymentId",
    requireAuth as any,
    async (req: AuthRequest, res) => {
      const { paymentId } = req.params;
      const { status, reason } = req.body;
      const user = req.currentUser!;
      const payment = await storage.getPaymentById(paymentId);
      if (!payment) return res.status(404).json({ error: "Payment not found" });
      if (payment.groupId !== user.groupId)
        return res.status(403).json({ error: "Access denied" });

      const isOverride = payment.status === "confirmed" || payment.status === "rejected" || payment.status === "payment_not_received";

      if (isOverride) {
        // Only President can override an already finalized payment
        if (user.role !== "president") {
          return res.status(403).json({ error: "Only President can override a verified payment" });
        }
      } else {
        // Normal verification flow (Treasurer or President)
        if (payment.mode === "online") {
          if (user.role !== "treasurer" && user.role !== "president") {
            return res.status(403).json({ error: "Treasurer or President access required" });
          }
          if (!["confirmed", "payment_not_received"].includes(status)) {
            return res.status(400).json({ error: "Invalid status for online payment" });
          }
        } else {
          if (user.role !== "president" && user.role !== "treasurer") {
            return res.status(403).json({ error: "President or Treasurer access required" });
          }
          if (!["confirmed", "rejected"].includes(status)) {
            return res.status(400).json({ error: "Invalid status for cash payment" });
          }
        }
      }

      const updateData: any = {
        status,
      };

      if (isOverride) {
        updateData.overriddenBy = user.id;
        updateData.overrideAt = new Date();
        if (reason) updateData.overrideReason = reason;
      } else {
        updateData.verifiedBy = user.id;
        updateData.verifiedAt = new Date();
        
        if (status === "rejected" || status === "payment_not_received") {
          if (reason) updateData.rejectionReason = reason;
          updateData.rejectedBy = user.id;
          updateData.rejectedAt = new Date();
        }
      }

      if (status === "confirmed") {
        updateData.verifiedBy = user.id;
        updateData.verifiedAt = new Date();
      }

      // If verifying, ensure amount is set correctly (expected + late fee)
      if (status === "confirmed" && payment.amount === 0) {
        updateData.amount = (payment.expectedAmount || 0) + (payment.lateFee || 0);
      }

      const updated = await storage.updatePayment(paymentId, updateData);
      return res.json(updated);
    },
  );

  app.patch(
    "/api/payments/:paymentId/reopen",
    requireAuth as any,
    requirePresident as any,
    async (req: AuthRequest, res) => {
      const { paymentId } = req.params;
      const user = req.currentUser!;
      const payment = await storage.getPaymentById(paymentId);
      if (!payment) return res.status(404).json({ error: "Payment not found" });
      if (payment.groupId !== user.groupId)
        return res.status(403).json({ error: "Access denied" });

      if (payment.status !== "rejected" && payment.status !== "payment_not_received") {
        return res.status(400).json({ error: "Only rejected payments can be reopened" });
      }

      const updated = await storage.updatePayment(paymentId, {
        status: "pending",
        verifiedBy: null,
        verifiedAt: null,
        rejectedBy: null,
        rejectedAt: null,
        rejectionReason: null,
        overriddenBy: user.id,
        overrideAt: new Date(),
        overrideReason: "Payment reopened by President",
      });
      return res.json(updated);
    },
  );

  app.delete(
    "/api/payments/:paymentId",
    requireAuth as any,
    requirePresident as any,
    async (req: AuthRequest, res) => {
      const { paymentId } = req.params;
      const payment = await storage.getPaymentById(paymentId);
      if (!payment) return res.status(404).json({ error: "Payment not found" });
      if (payment.groupId !== req.currentUser!.groupId)
        return res.status(403).json({ error: "Access denied" });
      await storage.deletePayment(paymentId);
      return res.json({ ok: true });
    },
  );

  app.put(
    "/api/groups/:groupId/qr-code",
    requireAuth as any,
    async (req: AuthRequest, res) => {
      const { groupId } = req.params;
      const user = req.currentUser!;
      if (user.groupId !== groupId)
        return res.status(403).json({ error: "Access denied" });
      if (user.role !== "treasurer" && user.role !== "president") {
        return res
          .status(403)
          .json({ error: "Treasurer or President access required" });
      }
      const { qrCode } = req.body;
      const updated = await storage.updateGroup(groupId, {
        qrCode: qrCode || undefined,
      });
      if (!updated) return res.status(404).json({ error: "Group not found" });
      return res.json({ ok: true });
    },
  );

  app.get(
    "/api/groups/:groupId/qr-code",
    requireAuth as any,
    async (req: AuthRequest, res) => {
      const { groupId } = req.params;
      if (req.currentUser!.groupId !== groupId)
        return res.status(403).json({ error: "Access denied" });
      const group = await storage.getGroupByGroupId(groupId);
      if (!group) return res.status(404).json({ error: "Group not found" });
      return res.json({ qrCode: group.qrCode || null });
    },
  );

  // ─── AFFILIATED BANKS ─────────────────────────────────────────────────────

  app.get(
    "/api/groups/:groupId/banks",
    requireAuth as any,
    async (req: AuthRequest, res) => {
      const { groupId } = req.params;
      if (req.currentUser!.groupId !== groupId)
        return res.status(403).json({ error: "Access denied" });
      const banks = await storage.getBanksByGroupId(groupId);
      return res.json(banks);
    },
  );

  app.post(
    "/api/groups/:groupId/banks",
    requireAuth as any,
    requirePresident as any,
    async (req: AuthRequest, res) => {
      const { groupId } = req.params;
      if (req.currentUser!.groupId !== groupId)
        return res.status(403).json({ error: "Access denied" });
      const { name, branch, ifscCode, contactPerson, contactNumber, notes } = req.body;
      if (!name || !name.trim())
        return res.status(400).json({ error: "Bank name is required" });
      const bank = await storage.createBank({
        groupId,
        name: name.trim(),
        branch: branch?.trim() || undefined,
        ifscCode: ifscCode?.trim() || undefined,
        contactPerson: contactPerson?.trim() || undefined,
        contactNumber: contactNumber?.trim() || undefined,
        notes: notes?.trim() || undefined,
        isActive: true,
        createdBy: req.currentUser!.id,
        createdAt: new Date().toISOString(),
      });
      return res.status(201).json(bank);
    },
  );

  app.patch(
    "/api/banks/:bankId",
    requireAuth as any,
    requirePresident as any,
    async (req: AuthRequest, res) => {
      const { bankId } = req.params;
      const bank = await storage.getBankById(bankId);
      if (!bank || bank.groupId !== req.currentUser!.groupId)
        return res.status(404).json({ error: "Bank not found" });
      const { name, branch, ifscCode, contactPerson, contactNumber, notes, isActive } = req.body;
      const updates: any = {};
      if (name !== undefined) updates.name = name.trim();
      if (branch !== undefined) updates.branch = branch.trim() || null;
      if (ifscCode !== undefined) updates.ifscCode = ifscCode.trim() || null;
      if (contactPerson !== undefined) updates.contactPerson = contactPerson.trim() || null;
      if (contactNumber !== undefined) updates.contactNumber = contactNumber.trim() || null;
      if (notes !== undefined) updates.notes = notes.trim() || null;
      if (isActive !== undefined) updates.isActive = isActive;
      const updated = await storage.updateBank(bankId, updates);
      return res.json(updated);
    },
  );

  app.delete(
    "/api/banks/:bankId",
    requireAuth as any,
    requirePresident as any,
    async (req: AuthRequest, res) => {
      const { bankId } = req.params;
      const bank = await storage.getBankById(bankId);
      if (!bank || bank.groupId !== req.currentUser!.groupId)
        return res.status(404).json({ error: "Bank not found" });
      // Soft delete: set isActive = false
      await storage.updateBank(bankId, { isActive: false });
      return res.json({ ok: true });
    },
  );

  // ─── LOANS ──────────────────────────────────────────────────────────────────

  app.get(
    "/api/groups/:groupId/loans",
    requireAuth as any,
    async (req: AuthRequest, res) => {
      const { groupId } = req.params;
      if (req.currentUser!.groupId !== groupId)
        return res.status(403).json({ error: "Access denied" });
        
      const user = req.currentUser!;
      const loans = user.role === "member"
        ? await storage.getLoansForMember(groupId, user.id)
        : await storage.getLoansByGroupId(groupId);
        
      return res.json(loans);
    },
  );

  app.post(
    "/api/groups/:groupId/loans",
    requireAuth as any,
    async (req: AuthRequest, res) => {
      const { groupId } = req.params;
      if (req.currentUser!.groupId !== groupId)
        return res.status(403).json({ error: "Access denied" });
      const { amount, duration } = req.body;
      if (!amount || !duration)
        return res.status(400).json({ error: "Amount and duration required" });

      const settings = await storage.getGroupSettings(groupId);

      // Validate SHG amount
      if (amount <= 0) return res.status(400).json({ error: "invalidAmount" });
      if (amount > settings.maxLoanAmount)
        return res.status(400).json({ error: "exceedsMaxLoan" });

      // Validate SHG duration
      const sorted = [...settings.durationRules].sort(
        (a, b) => a.maxAmount - b.maxAmount,
      );
      const rule =
        sorted.find((r) => amount <= r.maxAmount) || sorted[sorted.length - 1];
      if (duration < rule.minDuration)
        return res.status(400).json({ error: "durationTooShort" });
      if (duration > rule.maxDuration)
        return res.status(400).json({ error: "durationTooLong" });


      const user = req.currentUser!;
      const group = await storage.getGroupByGroupId(groupId);
      const initialStatus = group?.treasurerId
        ? "pending_treasurer"
        : "pending_president";

      const principal = Number(amount);
      const rate = settings.interestRate;
      const dur = Number(duration);
      const totalInterest = Math.round(principal * (rate / 100) * dur);
      const totalRepayable = principal + totalInterest;


      const loan = await storage.createLoan({
        groupId,
        memberId: user.id,
        memberName: user.name,
        resolutionNo: "",
        amount: principal,
        interest: rate,
        duration: dur,
        remainingBalance: totalRepayable,
        status: initialStatus,
        createdAt: new Date(),
        hasBankLoan: false,
        bankId: undefined,
        bankName: undefined,
        bankLoanAmount: undefined,
        bankInterestRate: undefined,
        bankDuration: undefined,
        bankRemainingBalance: undefined,
        bankLoanRemarks: undefined,
        calculationMethod: "reducing_balance", // Default new loans to reducing balance
        totalPrincipalPaid: 0,
        totalInterestPaid: 0,
        outstandingInterest: 0,
      } as any);
      return res.status(201).json(loan);
    },
  );

  app.patch(
    "/api/loans/:loanId/treasurer-approve",
    requireAuth as any,
    async (req: AuthRequest, res) => {
      const user = req.currentUser!;
      if (user.role !== "treasurer")
        return res.status(403).json({ error: "Treasurer access required" });
      const { loanId } = req.params;
      const loan = await storage.getLoanById(loanId);
      if (!loan || loan.groupId !== user.groupId)
        return res.status(404).json({ error: "Loan not found" });
      if (loan.status !== "pending_treasurer")
        return res
          .status(400)
          .json({ error: "Loan is not awaiting treasurer approval" });
      const updateData: any = {
        status: "pending_president",
        treasurerActionBy: user.id,
        treasurerActionAt: new Date(),
      };
      
      if (req.body.hasBankLoan) {
        updateData.hasBankLoan = true;
        updateData.bankName = req.body.bankName;
        updateData.bankLoanAmount = Number(req.body.bankAmount);
        updateData.bankInterestRate = Number(req.body.bankInterestRate) || 0;
        updateData.bankDuration = Number(req.body.bankDuration);
        updateData.bankLoanRemarks = req.body.bankRemarks;
        
        const bRate = updateData.bankInterestRate;
        const bPrincipal = updateData.bankLoanAmount;
        const bDur = updateData.bankDuration;
        const bInterest = Math.round(bPrincipal * (bRate / 100) * bDur);
        updateData.bankRemainingBalance = bPrincipal + bInterest;
      } else if (req.body.hasBankLoan === false) {
        updateData.hasBankLoan = false;
        updateData.bankName = null;
        updateData.bankLoanAmount = null;
        updateData.bankInterestRate = null;
        updateData.bankDuration = null;
        updateData.bankLoanRemarks = null;
        updateData.bankRemainingBalance = null;
      }

      const updated = await storage.updateLoan(loanId, updateData);
      return res.json(updated);
    },
  );

  app.patch(
    "/api/loans/:loanId/treasurer-reject",
    requireAuth as any,
    async (req: AuthRequest, res) => {
      const user = req.currentUser!;
      if (user.role !== "treasurer")
        return res.status(403).json({ error: "Treasurer access required" });
      const { loanId } = req.params;
      const { reason } = req.body;
      const loan = await storage.getLoanById(loanId);
      if (!loan || loan.groupId !== user.groupId)
        return res.status(404).json({ error: "Loan not found" });
      if (loan.status !== "pending_treasurer")
        return res
          .status(400)
          .json({ error: "Loan is not awaiting treasurer approval" });
      const updateData: any = {
        status: "treasurer_rejected",
        treasurerActionBy: user.id,
        treasurerActionAt: new Date(),
      };
      if (reason) updateData.rejectionReason = reason;
      updateData.rejectedBy = user.id;
      updateData.rejectedAt = new Date();

      const updated = await storage.updateLoan(loanId, updateData);
      return res.json(updated);
    },
  );

  app.patch(
    "/api/loans/:loanId/approve",
    requireAuth as any,
    requirePresident as any,
    async (req: AuthRequest, res) => {
      const { loanId } = req.params;
      const { resolutionNo, meetingId } = req.body;
      const loan = await storage.getLoanById(loanId);
      if (!loan || loan.groupId !== req.currentUser!.groupId) {
        return res.status(404).json({ error: "Loan not found" });
      }
      if (loan.status !== "pending_president" && loan.status !== "pending_treasurer") {
        return res
          .status(400)
          .json({ error: "Loan is not awaiting approval" });
      }

      const isOverride = loan.status === "pending_treasurer";

      const updateData: any = {
        status: "approved",
        resolutionNo: resolutionNo || "",
        meetingId,
        approvedBy: req.currentUser!.id,
        approvedAt: new Date(),
      };

      if (isOverride) {
        updateData.presidentOverride = true;
        updateData.overrideAt = new Date();
        updateData.overrideReason = "Approved directly by President";
      }

      if (req.body.hasBankLoan) {
        updateData.hasBankLoan = true;
        updateData.bankName = req.body.bankName;
        updateData.bankLoanAmount = Number(req.body.bankAmount);
        updateData.bankInterestRate = Number(req.body.bankInterestRate) || 0;
        updateData.bankDuration = Number(req.body.bankDuration);
        updateData.bankLoanRemarks = req.body.bankRemarks;
        
        const bRate = updateData.bankInterestRate;
        const bPrincipal = updateData.bankLoanAmount;
        const bDur = updateData.bankDuration;
        const bInterest = Math.round(bPrincipal * (bRate / 100) * bDur);
        updateData.bankRemainingBalance = bPrincipal + bInterest;
      } else if (req.body.hasBankLoan === false) {
        updateData.hasBankLoan = false;
        updateData.bankName = null;
        updateData.bankLoanAmount = null;
        updateData.bankInterestRate = null;
        updateData.bankDuration = null;
        updateData.bankLoanRemarks = null;
        updateData.bankRemainingBalance = null;
      }

      const updated = await storage.updateLoan(loanId, updateData);

      // Create Day 0 ledger entry for reducing balance loans upon approval
      if (updated.calculationMethod === 'reducing_balance') {
        const db = getDb();
        const ledgerId = crypto.randomUUID();
        const receiptNo = `DISB-${loanId.substring(0, 8).toUpperCase()}`;
        
        await db.insert(schema.loanLedger).values({
          id: ledgerId,
          loanId: loanId,
          receiptNo: receiptNo,
          openingPrincipal: 0,
          interestRateApplied: updated.interest,
          interestCharged: 0,
          interestPaid: 0,
          principalPaid: 0,
          paymentReceived: 0,
          closingPrincipal: updated.amount,
          outstandingInterest: 0,
          date: new Date(),
          type: "disbursement",
          recordedBy: req.currentUser!.id
        });
      }

      return res.json(updated);
    },
  );

  app.patch(
    "/api/loans/:loanId/reject",
    requireAuth as any,
    requirePresident as any,
    async (req: AuthRequest, res) => {
      const { loanId } = req.params;
      const { reason } = req.body;
      const loan = await storage.getLoanById(loanId);
      if (!loan || loan.groupId !== req.currentUser!.groupId) {
        return res.status(404).json({ error: "Loan not found" });
      }
      if (loan.status !== "pending_president" && loan.status !== "pending_treasurer") {
        return res
          .status(400)
          .json({ error: "Loan is not awaiting approval" });
      }

      const isOverride = loan.status === "pending_treasurer";

      const updateData: any = {
        status: "rejected",
        approvedBy: req.currentUser!.id,
        approvedAt: new Date(),
        rejectedBy: req.currentUser!.id,
        rejectedAt: new Date(),
      };
      if (reason) updateData.rejectionReason = reason;

      if (isOverride) {
        updateData.presidentOverride = true;
        updateData.overrideAt = new Date();
        updateData.overrideReason = "Rejected directly by President";
      }

      const updated = await storage.updateLoan(loanId, updateData);
      return res.json(updated);
    },
  );

  app.delete(
    "/api/loans/:loanId",
    requireAuth as any,
    requirePresident as any,
    async (req: AuthRequest, res) => {
      const { loanId } = req.params;
      const loan = await storage.getLoanById(loanId);
      if (!loan || loan.groupId !== req.currentUser!.groupId) {
        return res.status(404).json({ error: "Loan not found" });
      }
      await storage.deleteLoan(loanId);
      return res.json({ ok: true });
    },
  );

  app.get(
    "/api/loans/:loanId/repayments",
    requireAuth as any,
    async (req: AuthRequest, res) => {
      const { loanId } = req.params;
      const loan = await storage.getLoanById(loanId);
      if (!loan || loan.groupId !== req.currentUser!.groupId) {
        return res.status(404).json({ error: "Loan not found" });
      }
      const repayments = await storage.getRepaymentsByLoanId(loanId);
      return res.json(repayments);
    },
  );

  app.get(
    "/api/loans/:loanId/ledger",
    requireAuth as any,
    async (req: AuthRequest, res) => {
      const { loanId } = req.params;
      const loan = await storage.getLoanById(loanId);
      if (!loan || loan.groupId !== req.currentUser!.groupId) {
        return res.status(404).json({ error: "Loan not found" });
      }
      const ledger = await storage.getLoanLedger(loanId);
      return res.json(ledger);
    },
  );

  app.get(
    "/api/groups/:groupId/loan-ledger",
    requireAuth as any,
    async (req: AuthRequest, res) => {
      const { groupId } = req.params;
      if (req.currentUser!.groupId !== groupId) {
        return res.status(403).json({ error: "Access denied" });
      }
      const ledger = await storage.getLoanLedgerByGroupId(groupId);
      return res.json(ledger);
    },
  );

  app.post(
    "/api/loans/:loanId/repayments",
    requireAuth as any,
    requirePresident as any,
    async (req: AuthRequest, res) => {
      const { loanId } = req.params;
      const { amount, shgAmount, bankAmount, remarks } = req.body;
      const loan = await storage.getLoanById(loanId);
      if (!loan || loan.groupId !== req.currentUser!.groupId) {
        return res.status(404).json({ error: "Loan not found" });
      }

      // Calculate split amounts
      const shg = Number(shgAmount) || 0;
      const bank = Number(bankAmount) || 0;
      const total = Number(amount) || (shg + bank);

      if (total <= 0)
        return res.status(400).json({ error: "Valid amount required" });
      if (shg < 0 || bank < 0)
        return res.status(400).json({ error: "Amounts cannot be negative" });
      if (!loan.hasBankLoan && bank > 0)
        return res.status(400).json({ error: "This loan does not have a bank component" });

      // If this is a reducing balance loan, use atomic transaction and ledger
      if (loan.calculationMethod === "reducing_balance") {
        // Calculate ledger
        const groupSettings = await storage.getGroupSettings(loan.groupId);
        const policy = (groupSettings as any).unpaidInterestPolicy || 'due'; // fallback
        
        // Find how many months have elapsed since last payment, or since approval
        // A simple approach is just charging 1 month of interest every repayment.
        // Or strictly time-based. For now, the accounting function assumes 1 period.
        const ledger = calculateNextLedgerEntry(
          { remainingBalance: loan.remainingBalance, outstandingInterest: loan.outstandingInterest || 0 },
          shg,
          loan.interest,
          loan.duration, // Note: remaining months could be tracked, but using total is fine for pure reducing balance
          policy
        );

        const repayment = await storage.recordLoanRepayment(
          {
            loanId,
            amount: shg + bank,
            shgAmount: shg,
            bankAmount: bank,
            date: new Date().toISOString(),
            recordedBy: req.currentUser!.id,
            remarks: remarks?.trim() || undefined,
          },
          {
            loanId,
            receiptNo: `REP-${loanId.substring(0, 8).toUpperCase()}-${Date.now().toString().slice(-4)}`,
            openingPrincipal: ledger.openingPrincipal,
            interestRateApplied: loan.interest,
            interestCharged: ledger.interestCharged,
            interestPaid: ledger.interestPaid,
            principalPaid: ledger.principalPaid,
            paymentReceived: ledger.paymentReceived,
            closingPrincipal: ledger.closingPrincipal,
            outstandingInterest: ledger.outstandingInterest,
            date: new Date(),
            type: "repayment",
            recordedBy: req.currentUser!.id
          },
          {
            remainingBalance: ledger.closingPrincipal,
            outstandingInterest: ledger.outstandingInterest,
            totalPrincipalPaid: (loan.totalPrincipalPaid || 0) + ledger.principalPaid,
            totalInterestPaid: (loan.totalInterestPaid || 0) + ledger.interestPaid,
          }
        );
      } else {
        // Legacy flat interest logic
        const repayment = await storage.createRepayment({
          loanId,
          amount: shg + bank,
          shgAmount: shg,
          bankAmount: bank,
          date: new Date(),
          recordedBy: req.currentUser!.id,
          remarks: remarks?.trim() || undefined,
        });

        if (shg > 0) {
          const allRepayments = await storage.getRepaymentsByLoanId(loanId);
          const totalShgRepaid = allRepayments.reduce((s, r) => s + resolveRepaymentAmounts(r).shgAmount, 0);
          const shgTotal = loan.amount + Math.round(loan.amount * (loan.interest / 100) * loan.duration);
          const newBalance = Math.max(0, shgTotal - totalShgRepaid);
          await storage.updateLoan(loanId, { remainingBalance: newBalance });
        }

        if (bank > 0 && loan.hasBankLoan) {
          const allRepayments = await storage.getRepaymentsByLoanId(loanId);
          const totalBankRepaid = allRepayments.reduce((s, r) => s + resolveRepaymentAmounts(r).bankAmount, 0);
          const bankTotal = (loan.bankLoanAmount || 0) + Math.round((loan.bankLoanAmount || 0) * ((loan.bankInterestRate || 0) / 100) * (loan.bankDuration || 0));
          const newBankBalance = Math.max(0, bankTotal - totalBankRepaid);
          await storage.updateLoan(loanId, { bankRemainingBalance: newBankBalance });
        }
      }

      // Return the updated loan and repayment
      const updatedLoan = await storage.getLoanById(loanId);
      return res.status(201).json({ success: true, loan: updatedLoan, repayment });
    },
  );

  app.delete(
    "/api/repayments/:repaymentId",
    requireAuth as any,
    requirePresident as any,
    async (req: AuthRequest, res) => {
      const { repaymentId } = req.params;
      const repayment = await storage.getRepaymentById(repaymentId);
      if (!repayment) {
        return res.status(404).json({ error: "Repayment not found" });
      }
      
      const loan = await storage.getLoanById(repayment.loanId);
      if (!loan || loan.groupId !== req.currentUser!.groupId) {
        return res.status(404).json({ error: "Loan not found" });
      }

      if (loan.calculationMethod === "reducing_balance") {
        return res.status(400).json({ error: "Repayments for reducing balance loans are immutable and cannot be deleted." });
      }

      await storage.deleteRepayment(repaymentId);
      
      // Recalculate balances
      const allRepayments = await storage.getRepaymentsByLoanId(loan.id);
      
      // SHG
      const totalShgRepaid = allRepayments.reduce((s, r) => s + resolveRepaymentAmounts(r).shgAmount, 0);
      const shgTotal = loan.amount + Math.round(loan.amount * (loan.interest / 100) * loan.duration);
      const newBalance = Math.max(0, shgTotal - totalShgRepaid);
      
      // Bank
      const totalBankRepaid = allRepayments.reduce((s, r) => s + resolveRepaymentAmounts(r).bankAmount, 0);
      const bankTotal = (loan.bankLoanAmount || 0) + Math.round((loan.bankLoanAmount || 0) * ((loan.bankInterestRate || 0) / 100) * (loan.bankDuration || 0));
      const newBankBalance = loan.hasBankLoan ? Math.max(0, bankTotal - totalBankRepaid) : null;
      
      const updatedLoan = await storage.updateLoan(loan.id, {
        remainingBalance: newBalance,
        ...(loan.hasBankLoan ? { bankRemainingBalance: newBankBalance } : {})
      });

      return res.json({ ok: true, loan: updatedLoan });
    },
  );

  app.get(
    "/api/groups/:groupId/repayments",
    requireAuth as any,
    async (req: AuthRequest, res) => {
      const { groupId } = req.params;
      if (req.currentUser!.groupId !== groupId)
        return res.status(403).json({ error: "Access denied" });
      const repayments = await storage.getRepaymentsByGroupId(groupId);
      return res.json(repayments);
    },
  );

  // ─── GROUP SETTINGS ─────────────────────────────────────────────────────────

  app.get(
    "/api/groups/:groupId/settings",
    requireAuth as any,
    async (req: AuthRequest, res) => {
      const { groupId } = req.params;
      if (req.currentUser!.groupId !== groupId)
        return res.status(403).json({ error: "Access denied" });
      const settings = await storage.getGroupSettings(groupId);
      return res.json(settings);
    },
  );

  app.put(
    "/api/groups/:groupId/settings",
    requireAuth as any,
    requirePresident as any,
    async (req: AuthRequest, res) => {
      const { groupId } = req.params;
      if (req.currentUser!.groupId !== groupId)
        return res.status(403).json({ error: "Access denied" });
      const { interestRate, maxLoanAmount, durationRules } = req.body;
      if (
        interestRate === undefined ||
        maxLoanAmount === undefined ||
        !durationRules
      ) {
        return res.status(400).json({ error: "Missing settings fields" });
      }
      await storage.updateGroupSettings(groupId, {
        interestRate,
        maxLoanAmount,
        durationRules,
      });
      return res.json({ ok: true });
    },
  );

  app.post("/api/auth/logout", (req, res) => {
    res.json({ success: true });
  });

  app.patch("/api/users/language", requireAuth as any, async (req: AuthRequest, res) => {
    try {
      const { preferredLanguage } = req.body;
      if (!preferredLanguage || !["en", "mr"].includes(preferredLanguage)) {
        return res.status(400).json({ error: "Invalid language" });
      }
      await storage.updateUser(req.currentUser!.id, { preferredLanguage });
      return res.json({ success: true });
    } catch (e) {
      console.error(e);
      return res.status(500).json({ error: "Internal server error" });
    }
  });

  // ─── GROUPS ───────────────────────────────────────────────────────────────────

  // ─── GROUP RULES ─────────────────────────────────────────────────────────────

  app.get(
    "/api/groups/:groupId/rules",
    requireAuth as any,
    async (req: AuthRequest, res) => {
      const { groupId } = req.params;
      if (req.currentUser!.groupId !== groupId)
        return res.status(403).json({ error: "Access denied" });
      const rules = await storage.getGroupRules(groupId);
      return res.json({ rules });
    },
  );

  app.put(
    "/api/groups/:groupId/rules",
    requireAuth as any,
    requirePresident as any,
    async (req: AuthRequest, res) => {
      const { groupId } = req.params;
      if (req.currentUser!.groupId !== groupId)
        return res.status(403).json({ error: "Access denied" });
      const { rules } = req.body;
      await storage.updateGroupRules(groupId, rules || "");
      return res.json({ ok: true });
    },
  );

  // ─── NLP / VOICE ASSISTANT ──────────────────────────────────────────────────

  app.post(
    "/api/nlp/classify",
    requireAuth as any,
    async (req: AuthRequest, res) => {
      try {
        const { transcript } = req.body;
        if (
          !transcript ||
          typeof transcript !== "string" ||
          transcript.trim().length === 0
        ) {
          return res.status(400).json({ error: "transcript required" });
        }

        const apiKey = process.env.GROQ_API_KEY;
        if (!apiKey) {
          return res.status(503).json({ error: "NLP service not configured" });
        }

        const groq = new Groq({ apiKey });

        const prompt = `You are an assistant for a rural women's Self Help Group (SHG) app called "SHG Records".
The app has these screens: Dashboard, Meetings, Payments/Savings, Loans, Members, History, Rules, Loan Settings, Request Loan.

The user said (in Marathi or English): "${transcript.trim()}"

Classify their intent into exactly ONE of these actions:
- VIEW_DASHBOARD — home screen, dashboard, मुख्य पृष्ठ, total group savings, गटाची एकूण बचत, group balance, गटाची शिल्लक, monthly collection, चालू महिन्याची वसुली
- VIEW_MEETINGS — meetings, बैठक, बैठका
- VIEW_PAYMENTS — payments, savings, बचत, भरणा, पैसे, pending payments, थकीत देयके
- VIEW_LOANS — loans, कर्ज, कर्जे
- VIEW_MEMBERS — members, सदस्य
- VIEW_HISTORY — history, इतिहास, all records
- VIEW_RULES — rules, नियम, गटाचे नियम
- LOAN_SETTINGS — loan settings, कर्ज सेटिंग्ज, interest rate
- REQUEST_LOAN — request loan, कर्ज मागणी, apply for loan
- VIEW_REPORTS — reports, अहवाल, download report, savings report, loan report, generate savings report, बचत अहवाल, generate loan report, कर्ज अहवाल, overdue members, उशिराने भरलेले सदस्य
- UNKNOWN — cannot determine

Reply with ONLY a JSON object, no markdown, no explanation:
{"action":"ACTION_NAME","confidence":"high|medium|low","replyEn":"short friendly response in English","replyMr":"short friendly response in Marathi"}`;

        const completion = await groq.chat.completions.create({
          model: "llama-3.1-8b-instant",
          temperature: 0,
          messages: [{ role: "user", content: prompt }],
        });
        const text = (completion.choices[0]?.message?.content || "").trim();

        let parsed: {
          action: string;
          confidence: string;
          replyEn: string;
          replyMr: string;
        };
        try {
          const jsonMatch = text.match(/\{[\s\S]*\}/);
          parsed = JSON.parse(jsonMatch ? jsonMatch[0] : text);
        } catch {
          return res.json({
            action: "UNKNOWN",
            confidence: "low",
            replyEn: "Sorry, I didn't understand.",
            replyMr: "माफ करा, मला समजले नाही.",
          });
        }

        const routeMap: Record<string, string> = {
          VIEW_DASHBOARD: "/(main)/",
          VIEW_MEETINGS: "/(main)/meetings",
          VIEW_PAYMENTS: "/(main)/payments",
          VIEW_LOANS: "/loans",
          VIEW_MEMBERS: "/members",
          VIEW_HISTORY: "/history",
          VIEW_RULES: "/rules",
          LOAN_SETTINGS: "/loan-settings",
          REQUEST_LOAN: "/create-loan",
          VIEW_REPORTS: "/reports",
        };

        return res.json({
          action: parsed.action || "UNKNOWN",
          route: routeMap[parsed.action] || null,
          confidence: parsed.confidence || "low",
          replyEn: parsed.replyEn || "Done!",
          replyMr: parsed.replyMr || "ठीक आहे!",
        });
      } catch (e) {
        console.error("NLP classify error:", e);
        return res.status(500).json({ error: "NLP service error" });
      }
    },
  );


  // ─── GROUP BANK LOAN MODULE ───────────────────────────────────────────────

  app.get(
    "/api/groups/:groupId/bank-loans",
    requireAuth as any,
    async (req: AuthRequest, res) => {
      const { groupId } = req.params;
      const bankLoans = await storage.getGroupBankLoansByGroupId(groupId);
      return res.json(bankLoans);
    }
  );

  app.post(
    "/api/groups/:groupId/bank-loans",
    requireAuth as any,
    requirePresident as any,
    async (req: AuthRequest, res) => {
      const { groupId } = req.params;
      const { bankName, branch, accountNumber, sanctionDate, amount, annualInterestRate, durationMonths, repaymentStartDate, remarks } = req.body;
      const loan = await storage.createGroupBankLoan({
        groupId,
        bankName,
        branch,
        accountNumber,
        sanctionDate: new Date(sanctionDate),
        amount,
        annualInterestRate,
        durationMonths,
        repaymentStartDate: repaymentStartDate ? new Date(repaymentStartDate) : null,
        remarks,
        status: "active",
        createdBy: req.currentUser!.id
      });
      return res.status(201).json(loan);
    }
  );

  app.patch(
    "/api/bank-loans/:id",
    requireAuth as any,
    requirePresident as any,
    async (req: AuthRequest, res) => {
      const { id } = req.params;
      const updates = { ...req.body };
      if (updates.sanctionDate) updates.sanctionDate = new Date(updates.sanctionDate);
      if (updates.repaymentStartDate) updates.repaymentStartDate = new Date(updates.repaymentStartDate);
      const loan = await storage.updateGroupBankLoan(id, updates);
      return res.json(loan);
    }
  );

  app.patch(
    "/api/bank-loans/:id/close",
    requireAuth as any,
    requirePresident as any,
    async (req: AuthRequest, res) => {
      const { id } = req.params;
      const loan = await storage.updateGroupBankLoan(id, { status: "completed" });
      return res.json(loan);
    }
  );

  app.get(
    "/api/bank-loans/:id/allocations",
    requireAuth as any,
    async (req: AuthRequest, res) => {
      const { id } = req.params;
      const allocations = await storage.getBankLoanAllocationsByLoanId(id);
      return res.json(allocations);
    }
  );

  app.get(
    "/api/groups/:groupId/bank-loan-allocations",
    requireAuth as any,
    async (req: AuthRequest, res) => {
      const { groupId } = req.params;
      const allocations = await storage.getBankLoanAllocationsByGroupId(groupId);
      return res.json(allocations);
    }
  );

  app.get(
    "/api/groups/:groupId/bank-loan-ledger",
    requireAuth as any,
    async (req: AuthRequest, res) => {
      const { groupId } = req.params;
      const ledgers = await storage.getGroupBankLoanLedgerByGroupId(groupId);
      return res.json(ledgers);
    }
  );

  app.post(
    "/api/bank-loans/:id/allocations",
    requireAuth as any,
    requirePresident as any,
    async (req: AuthRequest, res) => {
      const { id } = req.params;
      const { allocations } = req.body; // Array of { memberId, allocatedPrincipal }
      
      const bankLoan = await storage.getGroupBankLoanById(id);
      if (!bankLoan) return res.status(404).json({ error: "Bank loan not found" });

      const existingAllocations = await storage.getBankLoanAllocationsByLoanId(id);
      const totalAllocatedSoFar = existingAllocations.reduce((sum, a) => sum + a.allocatedPrincipal, 0);
      
      const newTotal = allocations.reduce((sum: number, a: any) => sum + Number(a.allocatedPrincipal), 0);
      
      if (totalAllocatedSoFar + newTotal > bankLoan.amount) {
        return res.status(400).json({ error: "Total allocations exceed sanctioned bank loan amount" });
      }

      const allocsToInsert = [];
      const ledgersToInsert = [];
      
      for (const a of allocations) {
        allocsToInsert.push({
          bankLoanId: id,
          memberId: a.memberId,
          allocatedPrincipal: Number(a.allocatedPrincipal),
          outstandingBalance: Number(a.allocatedPrincipal)
        });
        
        ledgersToInsert.push({
          receiptNo: `DISB-BL-${id.substring(0,6)}`,
          type: "disbursement",
          date: new Date(),
          openingPrincipal: 0,
          interestRateApplied: 0,
          interestCharged: 0,
          interestPaid: 0,
          principalPaid: 0,
          paymentReceived: 0,
          closingPrincipal: Number(a.allocatedPrincipal),
          outstandingInterest: 0,
          remarks: "Initial Disbursement",
          recordedBy: req.currentUser!.id
        });
      }

      await storage.allocateBankLoanFunds(allocsToInsert, ledgersToInsert as any[]);
      
      const allAllocations = await storage.getBankLoanAllocationsByLoanId(id);
      return res.status(201).json(allAllocations);
    }
  );

  app.post(
    "/api/bank-loan-allocations/:id/repayments",
    requireAuth as any,
    requirePresidentOrTreasurer as any,
    async (req: AuthRequest, res) => {
      const { id } = req.params;
      const { amount, date, remarks } = req.body;
      
      const allocation = await storage.getBankLoanAllocationById(id);
      if (!allocation) return res.status(404).json({ error: "Allocation not found" });
      
      const bankLoan = await storage.getGroupBankLoanById(allocation.bankLoanId);
      if (!bankLoan) return res.status(404).json({ error: "Bank loan not found" });

      // Accounting Engine
      const monthlyRate = bankLoan.annualInterestRate / 12;
      const interestCharged = Math.round(allocation.outstandingBalance * (monthlyRate / 100));
      
      const totalInterestDue = allocation.outstandingInterest + interestCharged;
      
      let interestPaid = 0;
      let principalPaid = 0;
      let paymentRemaining = Number(amount);
      
      // Pay interest first
      if (paymentRemaining >= totalInterestDue) {
        interestPaid = totalInterestDue;
        paymentRemaining -= totalInterestDue;
      } else {
        interestPaid = paymentRemaining;
        paymentRemaining = 0;
      }
      
      // Remaining to principal
      principalPaid = paymentRemaining;
      
      const newOutstandingInterest = totalInterestDue - interestPaid;
      const newOutstandingBalance = Math.max(0, allocation.outstandingBalance - principalPaid);
      
      const receiptNo = `REC-BL-${Date.now().toString().slice(-6)}`;
      
      const repayment = {
        allocationId: id,
        receiptNo,
        amount: Number(amount),
        recordedBy: req.currentUser!.id,
        remarks: remarks || "Repayment"
      };
      
      const ledgerEntry = {
        allocationId: id,
        receiptNo,
        type: "repayment",
        date: new Date(date || Date.now()),
        openingPrincipal: allocation.outstandingBalance,
        interestRateApplied: monthlyRate,
        interestCharged,
        interestPaid,
        principalPaid,
        paymentReceived: Number(amount),
        closingPrincipal: newOutstandingBalance,
        outstandingInterest: newOutstandingInterest,
        remarks: remarks || "",
        recordedBy: req.currentUser!.id
      };
      
      const snapshotUpdate = {
        outstandingBalance: newOutstandingBalance,
        outstandingInterest: newOutstandingInterest,
        totalPrincipalPaid: allocation.totalPrincipalPaid + principalPaid,
        totalInterestPaid: allocation.totalInterestPaid + interestPaid,
        status: newOutstandingBalance <= 0 && newOutstandingInterest <= 0 ? "completed" : "active"
      };

      const recordedRepayment = await storage.recordBankLoanRepayment(repayment, ledgerEntry as any, snapshotUpdate);
      return res.status(201).json(recordedRepayment);
    }
  );
  const httpServer = createServer(app);
  return httpServer;
}
