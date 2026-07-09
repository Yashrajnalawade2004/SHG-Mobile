// @ts-ignore
import { Pool } from 'pg';
const pool = new Pool({ connectionString: process.env.SUPABASE_DATABASE_URL || 'postgres://postgres:postgres@localhost:5432/shg_mobile' }); 
async function run() {
  try {
    const res = await pool.query('SELECT * FROM loans WHERE amount = 30000 AND interest = 2 AND duration = 6 ORDER BY created_at DESC LIMIT 1');
    if (res.rows.length === 0) {
      console.log('No such loan found.');
      process.exit(0);
    }
    const loan = res.rows[0];
    console.log('Loan ID:', loan.id);
    
    const ledgers = await pool.query('SELECT * FROM loan_ledger WHERE loan_id = $1 ORDER BY date ASC, created_at ASC', [loan.id]);
    console.log('--- LEDGER ENTRIES ---');
    let month = 1;
    for (const l of ledgers.rows) {
      console.log(`Entry ${month}: Op=${l.opening_principal}, PrinPaid=${l.principal_paid}, IntCharged=${l.interest_charged}, IntPaid=${l.interest_paid}, TotPaid=${l.payment_received}, Clos=${l.closing_principal}, Date=${l.date.toISOString()}, Created=${l.created_at.toISOString()}`);
      month++;
    }
  } catch (e) {
    console.error(e);
  } finally {
    pool.end();
  }
}
run();
