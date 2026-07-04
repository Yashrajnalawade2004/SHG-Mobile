import { Express, Request, Response, NextFunction } from "express";
import { storage } from "./storage";
import { AuthRequest, requireAuth } from "./routes";
import { randomBytes } from "crypto";

export function requireSuperAdmin(req: Request, res: Response, next: NextFunction) {
  const authReq = req as AuthRequest;
  if (!authReq.currentUser || (authReq.currentUser.role as string) !== "super_admin") {
    return res.status(403).json({ error: "Forbidden: Super Admin access required" });
  }
  next();
}

export function registerSuperAdminRoutes(app: Express) {
  app.post("/api/super-admin/groups", requireAuth as any, requireSuperAdmin as any, async (req: AuthRequest, res) => {
    try {
      const { name, preferredLanguage } = req.body;
      if (!name) {
        return res.status(400).json({ error: "Missing group name" });
      }

      // Generate unique group code
      const uniqueGroupCode = "SHG-" + randomBytes(4).toString("hex").toUpperCase().slice(0, 8);
      // Generate a random internal group ID since it's required by the schema (uuid usually)
      const groupId = crypto.randomUUID();

      const group = await storage.createGroup({
        groupId,
        uniqueGroupCode,
        name,
        preferredLanguage: preferredLanguage || "mr",
        status: "pending",
        presidentId: null,
        createdBySuperAdmin: req.currentUser!.id,
        createdAt: new Date().toISOString(),
      });

      return res.status(201).json(group);
    } catch (e) {
      console.error(e);
      return res.status(500).json({ error: "Internal server error" });
    }
  });

  app.get("/api/super-admin/groups", requireAuth as any, requireSuperAdmin as any, async (req: AuthRequest, res) => {
    try {
      const groups = await storage.getAllGroups();
      return res.json(groups);
    } catch (e) {
      console.error(e);
      return res.status(500).json({ error: "Internal server error" });
    }
  });

  app.patch("/api/super-admin/groups/:groupId/status", requireAuth as any, requireSuperAdmin as any, async (req: AuthRequest, res) => {
    try {
      const { groupId } = req.params;
      const { status } = req.body;
      if (!["active", "suspended", "inactive"].includes(status)) {
        return res.status(400).json({ error: "Invalid status" });
      }

      const group = await storage.getGroupByGroupId(groupId as string);
      if (!group) {
        return res.status(404).json({ error: "Group not found" });
      }

      const updated = await storage.updateGroup(group.id, { status });
      return res.json(updated);
    } catch (e) {
      console.error(e);
      return res.status(500).json({ error: "Internal server error" });
    }
  });
}
