import * as dotenv from "dotenv";
dotenv.config();

import { getDb } from "../server/db";
import { loans } from "../shared/schema";
import { eq } from "drizzle-orm";

async function fixCorruptedReducingBalanceLoans() {
  const db = getDb();
  console.log("Fetching all reducing_balance loans...");
  
  const affectedLoans = await db.select()
    .from(loans)
    .where(eq(loans.calculationMethod, "reducing_balance"));
    
  console.log(`Found ${affectedLoans.length} reducing balance loans.`);
  let fixedCount = 0;

  for (const loan of affectedLoans) {
    if ((loan.totalPrincipalPaid || 0) === 0 && loan.remainingBalance > loan.amount) {
      console.log(`Fixing loan ${loan.id} (amount: ${loan.amount}, wrong balance: ${loan.remainingBalance})`);
      await db.update(loans)
        .set({ 
          remainingBalance: loan.amount,
          totalPrincipalPaid: 0,
          totalInterestPaid: 0,
          outstandingInterest: 0
        })
        .where(eq(loans.id, loan.id));
      fixedCount++;
    }
  }
  
  console.log(`Fixed ${fixedCount} corrupted loans.`);
  process.exit(0);
}

fixCorruptedReducingBalanceLoans().catch(e => {
  console.error("Error fixing loans:", e);
  process.exit(1);
});
