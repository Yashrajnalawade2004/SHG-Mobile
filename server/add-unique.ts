import "dotenv/config";
import { getDb } from "./db";
import { sql } from "drizzle-orm";

async function run() {
  const db = getDb();
  console.log("Adding unique constraint...");
  try {
    await db.execute(sql.raw(`ALTER TABLE "groups" ADD CONSTRAINT "groups_unique_group_code_unique" UNIQUE("unique_group_code");`));
    console.log("Unique constraint added.");
  } catch (e: any) {
    console.log("Failed: " + e.message);
  }
  process.exit(0);
}
run();
