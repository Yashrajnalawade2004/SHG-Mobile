// @ts-nocheck
import type { Express, Request, Response, NextFunction } from "express";
import { createServer, type Server } from "node:http";
import { storage } from "./storage";
import { registerSuperAdminRoutes } from "./super-admin-routes";
import { registerInvitationRoutes } from "./invitation-routes";
import Groq from "groq-sdk";

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
    return res.status(401).json({ error: "Unauthorized" });
  }
  const token = auth.slice(7);
  const session = await storage.getSession(token);
  if (!session) {
    return res.status(401).json({ error: "Invalid or expired session" });
  }
  const user = await storage.getUserById(session.userId);
  if (!user) {
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

      await storage.updateGroup(existingGroup.id, {
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
      const { name, phone, password, village, joinDate, exitDate, invitationCode } = req.body;
      if (!name || !phone || !password || !village || !invitationCode) {
        return res.status(400).json({ error: "Missing required fields" });
      }

      const codeObj = await storage.getInvitationCode(invitationCode);
      if (!codeObj || !codeObj.active || (codeObj.expiresAt && new Date() > codeObj.expiresAt) || codeObj.currentUses >= codeObj.maxUses) {
        return res.status(400).json({ error: "invalidOrExpiredCode" });
      }

      const group = await storage.getGroupByGroupId(codeObj.groupId);
      if (!group || group.status === "pending") {
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
        groupId: codeObj.groupId,
        status: "active",
        preferredLanguage: group.preferredLanguage,
      });

      await storage.incrementInvitationCodeUsage(codeObj.id, user.id);

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
        const totalRepayments = repayments.reduce((sum, r) => sum + r.amount, 0);
        
        const currentBalance = totalSavings + totalPenalties + totalRepayments - totalLoanDisbursed;
        
        const now = new Date();
        const currentMonth = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;
        const currentMonthPayments = payments.filter(p => p.month === currentMonth);
        const expectedCollection = currentMonthPayments.reduce((sum, p) => sum + p.expectedAmount, 0);
        const actualCollection = currentMonthPayments.reduce((sum, p) => sum + p.amount, 0);

        return res.json({
          totalSavings,
          totalLoanDisbursed,
          totalOutstanding,
          totalRepayments,
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
    "/api/groups/:groupId/meetings",
    requireAuth as any,
    requirePresident as any,
    async (req: AuthRequest, res) => {
      const { groupId } = req.params;
      if (req.currentUser!.groupId !== groupId)
        return res.status(403).json({ error: "Access denied" });
      const { scheduledDate, agenda, notes } = req.body;
      if (!scheduledDate)
        return res.status(400).json({ error: "scheduledDate required" });
      const meeting = await storage.createMeeting({
        groupId,
        scheduledDate,
        agenda: agenda || "",
        notes: notes || "",
        attendance: [],
        status: "scheduled",
        createdBy: req.currentUser!.id,
        createdAt: new Date().toISOString(),
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
    requirePresident as any,
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
        if (req.body[key] !== undefined) updates[key] = req.body[key];
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
        date: new Date().toISOString(),
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
      const { status } = req.body;
      const user = req.currentUser!;
      const payment = await storage.getPaymentById(paymentId);
      if (!payment) return res.status(404).json({ error: "Payment not found" });
      if (payment.groupId !== user.groupId)
        return res.status(403).json({ error: "Access denied" });

      if (payment.mode === "online") {
        if (user.role !== "treasurer" && user.role !== "president") {
          return res
            .status(403)
            .json({ error: "Treasurer or President access required" });
        }
        if (!["confirmed", "payment_not_received"].includes(status)) {
          return res
            .status(400)
            .json({ error: "Invalid status for online payment" });
        }
      } else {
        if (user.role !== "president" && user.role !== "treasurer") {
          return res
            .status(403)
            .json({ error: "President or Treasurer access required" });
        }
        if (!["confirmed", "rejected"].includes(status)) {
          return res
            .status(400)
            .json({ error: "Invalid status for cash payment" });
        }
      }

      const updateData: any = {
        status,
        verifiedBy: user.id,
        verifiedAt: new Date().toISOString(),
      };
      
      // If verifying, ensure amount is set correctly (expected + late fee)
      if (status === "confirmed" && payment.amount === 0) {
        updateData.amount = (payment.expectedAmount || 0) + (payment.lateFee || 0);
      }

      const updated = await storage.updatePayment(paymentId, updateData);
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

      // Validate amount
      if (amount <= 0) return res.status(400).json({ error: "invalidAmount" });
      if (amount > settings.maxLoanAmount)
        return res.status(400).json({ error: "exceedsMaxLoan" });

      // Validate duration
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

      const loan = await storage.createLoan({
        groupId,
        memberId: user.id,
        memberName: user.name,
        resolutionNo: "",
        amount: Number(amount),
        interest: settings.interestRate,
        duration: Number(duration),
        remainingBalance: Number(amount),
        status: initialStatus,
        createdAt: new Date().toISOString(),
      });
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
      const updated = await storage.updateLoan(loanId, {
        status: "pending_president",
        treasurerActionBy: user.id,
        treasurerActionAt: new Date().toISOString(),
      });
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
      const loan = await storage.getLoanById(loanId);
      if (!loan || loan.groupId !== user.groupId)
        return res.status(404).json({ error: "Loan not found" });
      if (loan.status !== "pending_treasurer")
        return res
          .status(400)
          .json({ error: "Loan is not awaiting treasurer approval" });
      const updated = await storage.updateLoan(loanId, {
        status: "treasurer_rejected",
        treasurerActionBy: user.id,
        treasurerActionAt: new Date().toISOString(),
      });
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
      if (loan.status !== "pending_president") {
        return res
          .status(400)
          .json({ error: "Loan is not awaiting president approval" });
      }
      const updated = await storage.updateLoan(loanId, {
        status: "approved",
        resolutionNo: resolutionNo || "",
        meetingId,
        approvedBy: req.currentUser!.id,
        approvedAt: new Date().toISOString(),
      });
      return res.json(updated);
    },
  );

  app.patch(
    "/api/loans/:loanId/reject",
    requireAuth as any,
    requirePresident as any,
    async (req: AuthRequest, res) => {
      const { loanId } = req.params;
      const loan = await storage.getLoanById(loanId);
      if (!loan || loan.groupId !== req.currentUser!.groupId) {
        return res.status(404).json({ error: "Loan not found" });
      }
      if (loan.status !== "pending_president") {
        return res
          .status(400)
          .json({ error: "Loan is not awaiting president approval" });
      }
      const updated = await storage.updateLoan(loanId, {
        status: "rejected",
        approvedBy: req.currentUser!.id,
        approvedAt: new Date().toISOString(),
      });
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

  app.post(
    "/api/loans/:loanId/repayments",
    requireAuth as any,
    requirePresident as any,
    async (req: AuthRequest, res) => {
      const { loanId } = req.params;
      const { amount } = req.body;
      if (!amount || amount <= 0)
        return res.status(400).json({ error: "Valid amount required" });
      const loan = await storage.getLoanById(loanId);
      if (!loan || loan.groupId !== req.currentUser!.groupId) {
        return res.status(404).json({ error: "Loan not found" });
      }
      const repayment = await storage.createRepayment({
        loanId,
        amount: Number(amount),
        date: new Date().toISOString(),
        recordedBy: req.currentUser!.id,
      });
      const allRepayments = await storage.getRepaymentsByLoanId(loanId);
      const totalRepaid = allRepayments.reduce((sum, r) => sum + r.amount, 0);
      const newBalance = Math.max(0, loan.amount - totalRepaid);
      await storage.updateLoan(loanId, { remainingBalance: newBalance });
      return res.status(201).json(repayment);
    },
  );

  app.delete(
    "/api/repayments/:repaymentId",
    requireAuth as any,
    requirePresident as any,
    async (req: AuthRequest, res) => {
      const { repaymentId } = req.params;
      const repayments = await storage
        .getRepaymentsByLoanId(repaymentId)
        .catch(() => []);
      // repaymentId is directly the repayment's own id, not a loanId
      await storage.deleteRepayment(repaymentId);
      return res.json({ ok: true });
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

  const httpServer = createServer(app);
  return httpServer;
}
