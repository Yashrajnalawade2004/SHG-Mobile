import "dotenv/config";
import { getDb } from "./server/db";
import { storage } from "./server/storage";
import { calculateEqualDistribution, applyBankLoanRepayment, validateAllocations } from "./shared/bankLoanAccounting";
import { randomUUID } from "crypto";

async function runAudit() {
  console.log("Starting Group Bank Loan Functional Audit...");
  const db = getDb();

  // Setup: create a dummy group and users for testing
  const groupId = randomUUID();
  const presidentId = randomUUID();
  const treasurerId = randomUUID();
  const members = Array.from({ length: 10 }).map(() => ({ id: randomUUID(), name: `Member` }));

  // 1. Create Bank Loan
  console.log("\n--- 1. Create Bank Loan ---");
  try {
    const loan = await storage.createGroupBankLoan({
      groupId,
      bankName: "State Bank of India",
      branch: "Main Branch",
      accountNumber: "1234567890",
      ifscCode: "SBIN0001234",
      sanctionDate: new Date("2027-01-01"),
      amount: 500000,
      annualInterestRate: 12,
      durationMonths: 24,
      repaymentStartDate: new Date("2027-02-01"),
      remarks: "Test Loan",
      status: "active",
      createdBy: presidentId,
    });
    console.log("✅ Bank loan created successfully:", loan.id);

    // 2. Equal Allocation
    console.log("\n--- 2. Equal Allocation ---");
    const equalAlloc = calculateEqualDistribution(members.map(m => m.id), 500000);
    const totalAlloc = equalAlloc.reduce((sum, a) => sum + a.allocatedPrincipal, 0);
    console.log(`Equal alloc: ${equalAlloc.length} members. Total = ${totalAlloc} (Expected: 500000). First member alloc: ${equalAlloc[0].allocatedPrincipal}`);
    if (totalAlloc === 500000 && equalAlloc.length === 10) {
      console.log("✅ Equal allocation perfectly matches sanctioned amount with rounding adjustments.");
    } else {
      console.error("❌ Equal allocation failed.");
    }

    // 3. Custom Allocation Validation
    console.log("\n--- 3. Custom Allocation ---");
    const overAlloc = [...equalAlloc];
    overAlloc[0].allocatedPrincipal += 1000;
    const overRes = validateAllocations(overAlloc, 500000);
    console.log(`Over allocation result: ${overRes} (Expected: bank_loan.error_exceeds_sanction)`);
    
    const underAlloc = [...equalAlloc];
    underAlloc[0].allocatedPrincipal -= 1000;
    const underRes = validateAllocations(underAlloc, 500000);
    console.log(`Under allocation result: ${underRes} (Expected: bank_loan.error_not_fully_allocated)`);

    if (overRes === "bank_loan.error_exceeds_sanction" && underRes === "bank_loan.error_not_fully_allocated") {
      console.log("✅ Custom allocation validation works.");
    } else {
      console.error("❌ Custom allocation validation failed.");
    }

    // Insert the allocations into DB so we can test repayments
    console.log("\n--- Inserting Allocations to DB ---");
    const ledgers = equalAlloc.map(a => ({
      allocationId: "temp", // will be replaced inside allocateBankLoanFunds
      receiptNo: "DISB-" + loan.id.substring(0, 8).toUpperCase(),
      type: "disbursement" as const,
      date: new Date(),
      openingPrincipal: 0,
      interestRateApplied: 12,
      interestCharged: 0,
      interestPaid: 0,
      principalPaid: 0,
      paymentReceived: 0,
      closingPrincipal: a.allocatedPrincipal,
      outstandingInterest: 0,
      recordedBy: presidentId,
    }));
    
    const dbAllocations = equalAlloc.map(a => ({
      bankLoanId: loan.id,
      memberId: a.memberId,
      allocatedPrincipal: a.allocatedPrincipal,
      outstandingBalance: a.allocatedPrincipal,
      outstandingInterest: 0,
      totalPrincipalPaid: 0,
      totalInterestPaid: 0,
      status: "active" as const,
    }));

    await storage.allocateBankLoanFunds(dbAllocations, ledgers);
    const savedAllocations = await storage.getBankLoanAllocationsByLoanId(loan.id);
    console.log(`✅ Saved ${savedAllocations.length} allocations to DB.`);

    // 5. Repayment Flow
    console.log("\n--- 5. Repayment Flow (Accounting Engine) ---");
    const alloc = savedAllocations[0];
    
    // Exact payment test: 1% of 50k = 500 interest. Let's pay 5000 total.
    // 500 interest, 4500 principal.
    const res1 = applyBankLoanRepayment(alloc.outstandingBalance, alloc.outstandingInterest, 12, 5000);
    console.log("Exact/Normal Payment:", res1);
    if (res1.interestCharged === 500 && res1.interestPaid === 500 && res1.principalPaid === 4500) {
      console.log("✅ Normal payment applied correctly.");
    } else {
      console.error("❌ Normal payment failed.");
    }

    // Underpayment test (pays only 300, interest was 500)
    const res2 = applyBankLoanRepayment(alloc.outstandingBalance, alloc.outstandingInterest, 12, 300);
    console.log("Underpayment:", res2);
    if (res2.interestCharged === 500 && res2.interestPaid === 300 && res2.principalPaid === 0 && res2.outstandingInterest === 200) {
      console.log("✅ Underpayment applied correctly.");
    } else {
      console.error("❌ Underpayment failed.");
    }

    // Overpayment with carryover interest
    const res3 = applyBankLoanRepayment(alloc.outstandingBalance, 200, 12, 6000);
    console.log("Carryover Overpayment:", res3);
    if (res3.interestCharged === 500 && res3.interestPaid === 700 && res3.principalPaid === 5300 && res3.outstandingInterest === 0) {
      console.log("✅ Carryover overpayment applied correctly.");
    } else {
      console.error("❌ Carryover overpayment failed.");
    }

  } catch (err) {
    console.error("Audit error:", err);
  }
  
  process.exit(0);
}

runAudit();
