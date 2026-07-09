// @ts-ignore
import { Pool } from 'pg';
import * as dotenv from 'dotenv';
dotenv.config();

const pool = new Pool({ connectionString: process.env.SUPABASE_DATABASE_URL || process.env.DATABASE_URL });

async function run() {
  console.log('--- STARTING LOAN INTEGRITY VERIFICATION ---');
  try {
    const loansRes = await pool.query(`SELECT * FROM loans WHERE calculation_method = 'reducing_balance'`);
    const loans = loansRes.rows;
    console.log(`Found ${loans.length} reducing balance loans to audit.\n`);

    let passed = 0;
    let failed = 0;

    for (const loan of loans) {
      const ledgerRes = await pool.query(
        `SELECT * FROM loan_ledger WHERE loan_id = $1 ORDER BY date ASC, created_at ASC`,
        [loan.id]
      );
      const ledger = ledgerRes.rows;

      if (ledger.length === 0) {
        console.log(`Loan: ${loan.id}`);
        console.log(`❌ Integrity Failure: No ledger entries found.\n`);
        failed++;
        continue;
      }

      // Reconstruct values from ledger
      let calculatedTotalPrincipalPaid = 0;
      let calculatedTotalInterestPaid = 0;
      
      const lastEntry = ledger[ledger.length - 1];
      const calculatedRemainingBalance = lastEntry.closing_principal;
      const calculatedOutstandingInterest = lastEntry.outstanding_interest;

      for (const entry of ledger) {
        calculatedTotalPrincipalPaid += Number(entry.principal_paid || 0);
        calculatedTotalInterestPaid += Number(entry.interest_paid || 0);
      }

      const match = 
        Math.abs(Number(loan.remaining_balance) - calculatedRemainingBalance) < 0.01 &&
        Math.abs(Number(loan.total_principal_paid) - calculatedTotalPrincipalPaid) < 0.01 &&
        Math.abs(Number(loan.total_interest_paid) - calculatedTotalInterestPaid) < 0.01 &&
        Math.abs(Number(loan.outstanding_interest) - calculatedOutstandingInterest) < 0.01;

      console.log(`Loan: ${loan.id}`);
      if (match) {
        console.log(`✓ Snapshot matches Ledger\n`);
        passed++;
      } else {
        console.log(`❌ Integrity Failure`);
        console.log(`  Expected Remaining Balance: ₹${calculatedRemainingBalance}`);
        console.log(`  Actual Remaining Balance:   ₹${loan.remaining_balance}`);
        console.log(`  Expected Total Principal Paid: ₹${calculatedTotalPrincipalPaid}`);
        console.log(`  Actual Total Principal Paid:   ₹${loan.total_principal_paid}`);
        console.log(`  Expected Total Interest Paid:  ₹${calculatedTotalInterestPaid}`);
        console.log(`  Actual Total Interest Paid:    ₹${loan.total_interest_paid}`);
        console.log(`  Expected Outstanding Interest: ₹${calculatedOutstandingInterest}`);
        console.log(`  Actual Outstanding Interest:   ₹${loan.outstanding_interest}\n`);
        failed++;
      }
    }

    console.log(`--- AUDIT SUMMARY ---`);
    console.log(`Total Audited: ${loans.length}`);
    console.log(`Passed: ${passed}`);
    console.log(`Failed: ${failed}`);

  } catch (e) {
    console.error(e);
  } finally {
    pool.end();
  }
}

run();
