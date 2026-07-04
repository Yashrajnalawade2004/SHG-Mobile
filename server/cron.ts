// @ts-nocheck
import { storage } from "./storage";

export function startCronJobs() {
  console.log("Starting background cron jobs...");
  
  // Run every 6 hours
  setInterval(async () => {
    await runJobsSafely();
  }, 1000 * 60 * 60 * 6);

  // Run on startup (with a small delay)
  setTimeout(async () => {
    await runJobsSafely();
  }, 5000);
}

async function runJobsSafely() {
  const locked = await storage.acquireCronLock("monthly_payments");
  if (!locked) {
    console.log("Cron job skipped (lock not acquired or recently run)");
    return;
  }
  
  try {
    await generateMonthlyPayments();
    await calculateLateFees();
  } catch (e) {
    console.error("Cron job error:", e);
  }
}

async function generateMonthlyPayments() {
  const groups = await storage.getAllGroups();
  const now = new Date();
  
  for (const group of groups) {
    const settings = await storage.getGroupSettings(group.groupId);
    const members = await storage.getUsersByGroupId(group.groupId);
    const activeMembers = members.filter(m => m.status === "active");
    
    for (const member of activeMembers) {
      const joinDate = new Date(member.joinDate || group.createdAt);
      
      let iterMonth: Date;
      if (member.contributionStartMonth) {
        const [y, m] = member.contributionStartMonth.split('-');
        iterMonth = new Date(parseInt(y), parseInt(m) - 1, 1);
      } else {
        iterMonth = new Date(joinDate.getFullYear(), joinDate.getMonth(), 1);
      }
      
      const memberPayments = await storage.getPaymentsForMember(group.groupId, member.id);
      const existingMonths = new Set(memberPayments.map(p => p.month));
      
      const currentMonthDate = new Date(now.getFullYear(), now.getMonth(), 1);
      
      while (iterMonth <= currentMonthDate) {
        const monthStr = `${iterMonth.getFullYear()}-${String(iterMonth.getMonth() + 1).padStart(2, "0")}`;
        
        if (!existingMonths.has(monthStr)) {
          let dueDate = new Date(iterMonth.getFullYear(), iterMonth.getMonth(), settings.contributionDueDay);
          const dueDateStr = dueDate.toISOString().split("T")[0];
          
          await storage.createPayment({
            groupId: group.groupId,
            memberId: member.id,
            memberName: member.name,
            amount: 0,
            expectedAmount: settings.monthlyContributionAmount,
            lateFee: 0,
            month: monthStr,
            dueDate: dueDate,
            date: new Date(),
            mode: "cash",
            status: "pending"
          });
          console.log(`Generated missing payment for ${member.name} (${monthStr})`);
        }
        
        iterMonth.setMonth(iterMonth.getMonth() + 1);
      }
    }
  }
}

async function calculateLateFees() {
  const groups = await storage.getAllGroups();
  const now = new Date();
  
  for (const group of groups) {
    const settings = await storage.getGroupSettings(group.groupId);
    const payments = await storage.getPaymentsByGroupId(group.groupId);
    const pendingPayments = payments.filter(p => 
      (p.status === "pending" || p.status === "pending_verification") && p.dueDate
    );
    
    for (const payment of pendingPayments) {
      if (!payment.dueDate) continue;
      const dueDate = new Date(payment.dueDate);
      // add grace period
      dueDate.setDate(dueDate.getDate() + settings.gracePeriodDays);
      
      if (now > dueDate) {
        // Past due with grace period, calculate late fee
        let newLateFee = 0;
        if (settings.lateFeeType === "fixed") {
          newLateFee = settings.lateFeeAmount;
        } else if (settings.lateFeeType === "percentage") {
          newLateFee = Math.round((payment.expectedAmount * settings.lateFeeAmount) / 100);
        }
        
        if (payment.lateFee !== newLateFee) {
          await storage.updatePayment(payment.id, { lateFee: newLateFee });
          console.log(`Updated late fee for payment ${payment.id} to ${newLateFee}`);
        }
      }
    }
  }
}
