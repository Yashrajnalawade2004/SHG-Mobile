// @ts-ignore
import { Pool } from 'pg';
import * as crypto from 'crypto';

const pool = new Pool({ connectionString: process.env.SUPABASE_DATABASE_URL || process.env.DATABASE_URL });

async function run() {
  console.log('--- STARTING VERIFICATION SCRIPT ---');
  try {
    // 1. Get a group and a member to attach this loan to
    const membersRes = await pool.query("SELECT * FROM users WHERE role IN ('president', 'treasurer') LIMIT 1");
    const member = membersRes.rows[0];
    const group = { id: member.group_id };

    const loanId = crypto.randomUUID();
    console.log(`Creating test loan ${loanId} for member ${member.id}...`);

    // 2. Create the test loan
    await pool.query(`
      INSERT INTO loans (
        id, group_id, member_id, amount, duration, interest, member_name, resolution_no, 
        calculation_method, status, remaining_balance, outstanding_interest,
        total_principal_paid, total_interest_paid, fixed_principal_installment,
        created_at
      ) VALUES (
        $1, $2, $3, 30000, 6, 2, $4, 'TEST-RES-1',
        'reducing_balance', 'approved', 30000, 0,
        0, 0, 5000,
        now()
      )
    `, [loanId, group.id, member.id, member.name]);

    // Insert disbursement ledger entry
    await pool.query(`
      INSERT INTO loan_ledger (
        id, loan_id, receipt_no, date,
        opening_principal, interest_rate_applied, interest_charged, interest_paid,
        principal_paid, payment_received, closing_principal, outstanding_interest,
        type, recorded_by
      ) VALUES (
        $1, $2, $3, now(),
        0, 2, 0, 0,
        0, 0, 30000, 0,
        'disbursement', $4
      )
    `, [crypto.randomUUID(), loanId, `DISB-${loanId.substring(0, 8).toUpperCase()}`, member.id]);

    // 3. Make 6 repayments via API equivalent (using the same logic)
    const token = crypto.randomUUID();
    await pool.query(`
      INSERT INTO sessions (token, user_id, created_at)
      VALUES ($1, $2, now())
    `, [token, member.id]);

    const amounts = [3000];
    
    for (let i = 0; i < amounts.length; i++) {
      console.log(`Making repayment ${i+1}: ${amounts[i]}`);
      const res = await fetch(`http://localhost:5000/api/loans/${loanId}/repayments`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({
          amount: amounts[i],
          shgAmount: amounts[i],
          bankAmount: 0
        })
      });
      if (!res.ok) {
        const err = await res.text();
        console.error(`Failed repayment ${i+1}:`, res.status, err);
      }
    }

    // 4. Verify Final Values
    const finalLoanRes = await pool.query('SELECT * FROM loans WHERE id = $1', [loanId]);
    const finalLoan = finalLoanRes.rows[0];

    console.log(`FINAL LOAN SNAPSHOT:`);
    console.log(`Total Principal Paid: ${finalLoan.total_principal_paid} (Expected: 30000)`);
    console.log(`Total Interest Paid: ${finalLoan.total_interest_paid} (Expected: 2100)`);
    console.log(`Remaining Balance: ${finalLoan.remaining_balance} (Expected: 0)`);
    console.log(`Outstanding Interest: ${finalLoan.outstanding_interest} (Expected: 0)`);

    const finalLedgerRes = await pool.query('SELECT * FROM loan_ledger WHERE loan_id = $1 ORDER BY date ASC, created_at ASC', [loanId]);
    console.log(`Total Ledger Entries: ${finalLedgerRes.rows.length} (Expected: 7)`);

  } catch (e) {
    console.error(e);
  } finally {
    pool.end();
  }
}
run();
