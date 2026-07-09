// @ts-ignore
import { Pool } from 'pg';
import * as dotenv from 'dotenv';
dotenv.config();

const pool = new Pool({ connectionString: process.env.SUPABASE_DATABASE_URL || process.env.DATABASE_URL });

async function run() {
  console.log('--- STARTING VERIFICATION SCRIPT ---');
  try {
    const existingLoan = await pool.query(`SELECT * FROM loans WHERE calculation_method = 'reducing_balance' LIMIT 1`);
    if (existingLoan.rows.length === 0) throw new Error('No loan found');
    const loan = existingLoan.rows[0];
    const loanId = loan.id;
    const memberId = loan.member_id;
    const token = 'test-token-dup-' + Date.now();

    await pool.query(`
      INSERT INTO sessions (token, user_id, created_at)
      VALUES ($1, $2, now())
    `, [token, memberId]);

    const amounts = [1000];
    
    console.log(`Sending TWO duplicate requests exactly simultaneously for loan ${loanId}...`);
    const reqs = [
      fetch(`http://localhost:5000/api/loans/${loanId}/repayments`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
        body: JSON.stringify({ amount: amounts[0], shgAmount: amounts[0], bankAmount: 0 })
      }),
      fetch(`http://localhost:5000/api/loans/${loanId}/repayments`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
        body: JSON.stringify({ amount: amounts[0], shgAmount: amounts[0], bankAmount: 0 })
      })
    ];
    
    const results = await Promise.all(reqs);
    for (const res of results) {
      if (!res.ok) {
         console.log('Response Error:', res.status, await res.text());
      } else {
         console.log('Response Success:', res.status);
      }
    }

    const ledgerRes = await pool.query(`SELECT * FROM loan_ledger WHERE loan_id = $1 ORDER BY created_at DESC LIMIT 5`, [loanId]);
    console.log(`\nRECENT LEDGER ENTRIES:`);
    for (const row of ledgerRes.rows) {
      console.log(`- ${row.created_at} | Paid: ${row.principal_paid} | Closing: ${row.closing_principal}`);
    }

  } catch (e) {
    console.error(e);
  } finally {
    pool.end();
  }
}

run();
