import "dotenv/config";
import { getDb } from "../db";
import { users } from "../../shared/schema";
import { eq, isNull } from "drizzle-orm";

async function run() {
  console.log("Starting backfill for contributionStartMonth...");
  const db = getDb();
  const allUsers = await db.select().from(users).where(isNull(users.contributionStartMonth));
  
  let count = 0;
  for (const user of allUsers) {
    if (user.joinDate) {
      const jd = new Date(user.joinDate);
      const yyyy = jd.getFullYear();
      const mm = String(jd.getMonth() + 1).padStart(2, '0');
      const startMonth = `${yyyy}-${mm}`;
      
      await db.update(users)
        .set({ contributionStartMonth: startMonth })
        .where(eq(users.id, user.id));
      count++;
    }
  }
  console.log(`Backfilled ${count} users.`);
}

run().catch(console.error).finally(() => process.exit(0));
