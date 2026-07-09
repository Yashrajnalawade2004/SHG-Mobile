import { Pool } from 'pg';

const pool = new Pool({ connectionString: process.env.SUPABASE_DATABASE_URL || process.env.DATABASE_URL });

async function run() {
  console.log('--- STARTING DATABASE REPAIR SCRIPT ---');
  try {
    const loansRes = await pool.query("SELECT * FROM loans WHERE calculation_method = 'reducing_balance'");
    const loans = loansRes.rows;
    console.log(`Found ${loans.length} reducing balance loans to audit.`);

    for (const loan of loans) {
      let isCorrupted = false;
      const ledgersRes = await pool.query('SELECT * FROM loan_ledger WHERE loan_id = $1 ORDER BY date ASC', [loan.id]);
      const ledgers = ledgersRes.rows;

      if (ledgers.length === 0) continue;

      let validLedgers = [];
      let duplicateLedgerIds = [];
      
      let runningClosing = loan.amount;
      
      for (const l of ledgers) {
        if (l.type === 'disbursement' || l.receipt_no?.startsWith('DISB-')) {
          validLedgers.push(l);
          runningClosing = l.closing_principal;
          continue;
        }

        // If the opening principal doesn't match the expected running closing principal, it might be a duplicate
        if (l.opening_principal !== runningClosing) {
          // If it matches the PREVIOUS opening principal, it's a duplicate race condition
          const prev = validLedgers[validLedgers.length - 1];
          if (prev && l.opening_principal === prev.opening_principal) {
            console.log(`Detected duplicate ledger entry for Loan ${loan.id}. Deleting ledger ID: ${l.id}`);
            duplicateLedgerIds.push(l.id);
            isCorrupted = true;
            continue; // Skip this one, do not update runningClosing
          }
        }
        
        validLedgers.push(l);
        runningClosing = l.closing_principal;
      }

      // Delete duplicate ledgers
      for (const dupId of duplicateLedgerIds) {
        // Find corresponding repayment row (created within 1 second, same amount)
        const dupLedger = ledgers.find(x => x.id === dupId);
        const repRes = await pool.query(`
          SELECT * FROM loan_repayments 
          WHERE loan_id = $1 AND amount = $2
          ORDER BY date ASC
        `, [loan.id, dupLedger.payment_received]);
        
        // Find the one closest in time
        let closestRep = null;
        let minDiff = Infinity;
        for (const r of repRes.rows) {
          const diff = Math.abs(new Date(r.date).getTime() - new Date(dupLedger.date).getTime());
          if (diff < minDiff) {
            minDiff = diff;
            closestRep = r;
          }
        }

        if (closestRep && minDiff < 2000) { // within 2 seconds
          console.log(`Deleting corresponding duplicate repayment: ${closestRep.id}`);
          await pool.query('DELETE FROM loan_repayments WHERE id = $1', [closestRep.id]);
        }
        
        await pool.query('DELETE FROM loan_ledger WHERE id = $1', [dupId]);
      }

      // Recalculate snapshot
      const totalPrinPaid = validLedgers.reduce((sum, l) => sum + (l.type !== 'disbursement' ? l.principal_paid : 0), 0);
      const totalIntPaid = validLedgers.reduce((sum, l) => sum + (l.type !== 'disbursement' ? l.interest_paid : 0), 0);
      const lastLedger = validLedgers[validLedgers.length - 1];
      const finalRemaining = lastLedger ? lastLedger.closing_principal : loan.amount;
      const finalOutstandingInt = lastLedger ? lastLedger.outstanding_interest : 0;

      // Check if snapshot is diverged
      if (
        loan.remaining_balance !== finalRemaining ||
        loan.total_principal_paid !== totalPrinPaid ||
        loan.total_interest_paid !== totalIntPaid ||
        loan.outstanding_interest !== finalOutstandingInt
      ) {
        isCorrupted = true;
      }

      if (isCorrupted) {
        console.log(`Correcting Loan ${loan.id}: RemBal: ${loan.remaining_balance}->${finalRemaining}, TotPrin: ${loan.total_principal_paid}->${totalPrinPaid}, TotInt: ${loan.total_interest_paid}->${totalIntPaid}`);
        await pool.query(`
          UPDATE loans 
          SET remaining_balance = $1, 
              total_principal_paid = $2, 
              total_interest_paid = $3, 
              outstanding_interest = $4
          WHERE id = $5
        `, [finalRemaining, totalPrinPaid, totalIntPaid, finalOutstandingInt, loan.id]);
      }
    }
    console.log('--- REPAIR COMPLETE ---');
  } catch (e) {
    console.error('Error during repair:', e);
  } finally {
    pool.end();
  }
}
run();
