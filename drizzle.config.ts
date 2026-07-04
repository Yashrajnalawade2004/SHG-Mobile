import { defineConfig } from "drizzle-kit";
import dotenv from "dotenv";

dotenv.config();

const dbUrl = process.env.SUPABASE_DATABASE_URL || process.env.DATABASE_URL;

if (!dbUrl) {
  throw new Error(
    "DATABASE_URL or SUPABASE_DATABASE_URL is missing. Set it in your .env file."
  );
}

export default defineConfig({
  out: "./migrations",
  schema: "./shared/schema.ts",
  dialect: "postgresql",
  dbCredentials: {
    url: dbUrl,
  },
});
