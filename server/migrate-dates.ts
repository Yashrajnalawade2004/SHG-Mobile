import "dotenv/config";
import { getDb } from "./db";
import { sql } from "drizzle-orm";

async function run() {
  const db = getDb();
  console.log("Migrating text dates to timestamp...");
  
  const queries = [
    `ALTER TABLE "groups" ALTER COLUMN "created_at" TYPE timestamp USING "created_at"::timestamp;`,
    `ALTER TABLE "users" ALTER COLUMN "join_date" TYPE timestamp USING "join_date"::timestamp;`,
    `ALTER TABLE "users" ALTER COLUMN "exit_date" TYPE timestamp USING "exit_date"::timestamp;`,
    `ALTER TABLE "meetings" ALTER COLUMN "scheduled_date" TYPE timestamp USING "scheduled_date"::timestamp;`,
    `ALTER TABLE "meetings" ALTER COLUMN "created_at" TYPE timestamp USING "created_at"::timestamp;`,
    `ALTER TABLE "payments" ALTER COLUMN "due_date" TYPE timestamp USING "due_date"::timestamp;`,
    `ALTER TABLE "payments" ALTER COLUMN "date" TYPE timestamp USING "date"::timestamp;`,
    `ALTER TABLE "payments" ALTER COLUMN "verified_at" TYPE timestamp USING "verified_at"::timestamp;`,
    `ALTER TABLE "loans" ALTER COLUMN "treasurer_action_at" TYPE timestamp USING "treasurer_action_at"::timestamp;`,
    `ALTER TABLE "loans" ALTER COLUMN "approved_at" TYPE timestamp USING "approved_at"::timestamp;`,
    `ALTER TABLE "loans" ALTER COLUMN "created_at" TYPE timestamp USING "created_at"::timestamp;`,
    `ALTER TABLE "loan_repayments" ALTER COLUMN "date" TYPE timestamp USING "date"::timestamp;`,
    `ALTER TABLE "cron_locks" ALTER COLUMN "locked_at" TYPE timestamp USING "locked_at"::timestamp;`
  ];
  
  for (const q of queries) {
    try {
      await db.execute(sql.raw(q));
      console.log("Executed: " + q);
    } catch (e: any) {
      console.log("Skipped/Error: " + q + " -> " + e.message);
    }
  }
  
  console.log("Done.");
  process.exit(0);
}

run();
