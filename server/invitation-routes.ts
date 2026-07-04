// @ts-nocheck
import { Express } from "express";
import { storage } from "./storage";
import { AuthRequest, requireAuth, requireSameGroup } from "./routes";
import { randomBytes } from "crypto";

export function registerInvitationRoutes(app: Express) {
  app.post("/api/groups/:groupId/invitations", requireAuth as any, requireSameGroup as any, async (req: AuthRequest, res) => {
    try {
      if (req.currentUser?.role !== "president") {
        return res.status(403).json({ error: "Only presidents can generate invitations" });
      }

      const { groupId } = req.params;
      const group = await storage.getGroupByGroupId(groupId);
      if (!group || group.status === "pending") {
        return res.status(400).json({ error: "Group is not fully active yet" });
      }

      const { maxUses = 1, expiresInDays = 7 } = req.body;

      const code = randomBytes(3).toString("hex").toUpperCase(); // 6 chars
      const expiresAt = new Date();
      expiresAt.setDate(expiresAt.getDate() + expiresInDays);

      const invitation = await storage.createInvitationCode({
        code,
        groupId,
        active: true,
        maxUses,
        expiresAt,
        createdBy: req.currentUser.id,
      });

      return res.status(201).json(invitation);
    } catch (e) {
      console.error(e);
      return res.status(500).json({ error: "Internal server error" });
    }
  });

  app.get("/api/groups/:groupId/invitations", requireAuth as any, requireSameGroup as any, async (req: AuthRequest, res) => {
    try {
      if (req.currentUser?.role !== "president") {
        return res.status(403).json({ error: "Only presidents can view invitations" });
      }

      const { groupId } = req.params;
      const invitations = await storage.getInvitationCodesByGroup(groupId);
      return res.json(invitations);
    } catch (e) {
      console.error(e);
      return res.status(500).json({ error: "Internal server error" });
    }
  });
}
