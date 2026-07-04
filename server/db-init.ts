import "dotenv/config";
import { getDb } from "./db";
import * as schema from "../shared/schema";
import { eq, isNull } from "drizzle-orm";
import { randomUUID, randomBytes } from "crypto";

function generateUniqueCode(length = 8) {
  return "SHG-" + randomBytes(4).toString("hex").toUpperCase().slice(0, length);
}

async function runMigration() {
  console.log("Starting DB migration and seed...");
  const db = getDb();

  // 1. Seed Super Admin
  const superAdminPhone = process.env.SUPER_ADMIN_PHONE;
  if (!superAdminPhone) throw new Error("SUPER_ADMIN_PHONE is missing from .env");
  const superAdminPassword = process.env.SUPER_ADMIN_PASSWORD;
  if (!superAdminPassword) throw new Error("SUPER_ADMIN_PASSWORD is missing from .env");
  const superAdminName = process.env.SUPER_ADMIN_NAME || "Super Admin";
  
  const existingSuperAdmin = await db.select().from(schema.users).where(eq(schema.users.phone, superAdminPhone));
  
  let superAdminId: string;
  if (existingSuperAdmin.length === 0) {
    console.log("Creating default Super Admin account...");
    superAdminId = randomUUID();
    await db.insert(schema.users).values({
      id: superAdminId,
      name: superAdminName,
      phone: superAdminPhone,
      password: superAdminPassword,
      village: "System",
      joinDate: new Date(),
      role: "super_admin",
      groupId: "system",
      status: "active",
      preferredLanguage: "en",
    });
    console.log("Super Admin created successfully.");
  } else {
    superAdminId = existingSuperAdmin[0].id;
    console.log("Super Admin already exists.");
  }

  // 2. Backfill existing groups
  console.log("Backfilling existing groups...");
  const existingGroups = await db.select().from(schema.groups).where(isNull(schema.groups.uniqueGroupCode));
  
  for (const group of existingGroups) {
    const code = generateUniqueCode();
    // Defaulting activatedOn to createdAt as a timestamp
    const activatedOn = new Date(group.createdAt).getTime() ? new Date(group.createdAt) : new Date();
    
    await db.update(schema.groups)
      .set({
        uniqueGroupCode: code,
        preferredLanguage: "mr",
        status: "active",
        createdBySuperAdmin: superAdminId,
        activatedOn,
      })
      .where(eq(schema.groups.id, group.id));
      
    console.log(`Updated group ${group.name} with code ${code}`);
  }
  
  console.log("Migration and seed completed successfully!");
  process.exit(0);
}

runMigration().catch((e) => {
  console.error("Migration failed:", e);
  process.exit(1);
});
