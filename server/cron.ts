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
    // Payments are entered by the President as real transactions. Do not create
    // synthetic monthly payment records, which would conflict with partial payments.
    await calculateLateFees();
  } catch (e) {
    console.error("Cron job error:", e);
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
