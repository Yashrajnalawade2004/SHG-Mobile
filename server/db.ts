// @ts-nocheck
import { drizzle } from "drizzle-orm/node-postgres";
import { Pool } from "pg";
import * as schema from "../shared/schema";

let _db: ReturnType<typeof drizzle> | null = null;

export function getDb() {
  if (!_db) {
    const pool = new Pool({ connectionString: process.env.SUPABASE_DATABASE_URL ?? process.env.DATABASE_URL });
    _db = drizzle(pool, { schema });
  }
  return _db;
}
