import { createContext, useContext, useState, useMemo, ReactNode, useCallback, useEffect } from "react";
import { apiPost, apiGet, getToken, saveToken, clearToken } from "@/lib/api";

export type UserRole = "president" | "treasurer" | "member";

export interface User {
  id: string;
  name: string;
  phone: string;
  village: string;
  joinDate: string;
  exitDate?: string;
  role: UserRole;
  groupId: string;
  status: "active" | "left";
}

export interface Group {
  id: string;
  groupId: string;
  name: string;
  presidentId: string;
  treasurerId?: string;
  qrCode?: string;
  createdAt: string;
}

interface AuthContextValue {
  user: User | null;
  group: Group | null;
  isLoading: boolean;
  login: (phone: string, password: string) => Promise<{ success: boolean; error?: string; role?: string }>;
  registerPresident: (data: { name: string; phone: string; password: string; village: string; joinDate?: string; exitDate?: string; uniqueGroupCode: string }) => Promise<{ success: boolean; error?: string }>;
  registerMember: (data: { name: string; phone: string; password: string; village: string; joinDate?: string; exitDate?: string; invitationCode: string }) => Promise<{ success: boolean; error?: string }>;
  logout: () => Promise<void>;
  verifyPassword: (password: string) => Promise<boolean>;
  isPresident: boolean;
  isTreasurer: boolean;
  refreshSession: () => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [group, setGroup] = useState<Group | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    restoreSession();
  }, []);

  const restoreSession = async () => {
    try {
      const token = await getToken();
      if (!token) return;
      const data = await apiGet<{ user: User; group: Group }>("/api/auth/session");
      setUser(data.user);
      setGroup(data.group);
    } catch {
      await clearToken();
    } finally {
      setIsLoading(false);
    }
  };

  const login = useCallback(async (phone: string, password: string) => {
    try {
      const data = await apiPost<{ token: string; user: User; group: Group }>(
        "/api/auth/login",
        { phone, password },
        false,
      );
      await saveToken(data.token);
      setUser(data.user);
      setGroup(data.group);
      return { success: true, role: data.user.role };
    } catch (e: any) {
      return { success: false, error: e.message || "error" };
    }
  }, []);

  const registerPresident = useCallback(async (data: { name: string; phone: string; password: string; village: string; joinDate?: string; exitDate?: string; uniqueGroupCode: string }) => {
    try {
      const res = await apiPost<{ token: string; user: User; group: Group }>(
        "/api/auth/register/president",
        data,
        false,
      );
      await saveToken(res.token);
      setUser(res.user);
      setGroup(res.group);
      return { success: true };
    } catch (e: any) {
      return { success: false, error: e.message || "error" };
    }
  }, []);

  const registerMember = useCallback(async (data: { name: string; phone: string; password: string; village: string; joinDate?: string; exitDate?: string; uniqueGroupCode: string }) => {
    try {
      const res = await apiPost<{ token: string; user: User; group: Group }>(
        "/api/auth/register/member",
        data,
        false,
      );
      await saveToken(res.token);
      setUser(res.user);
      setGroup(res.group);
      return { success: true };
    } catch (e: any) {
      return { success: false, error: e.message || "error" };
    }
  }, []);

  const logout = useCallback(async () => {
    try {
      await apiPost("/api/auth/logout", {});
    } catch {}
    await clearToken();
    setUser(null);
    setGroup(null);
  }, []);

  const verifyPassword = useCallback(async (password: string): Promise<boolean> => {
    try {
      const res = await apiPost<{ valid: boolean }>("/api/auth/verify-password", { password });
      return res.valid;
    } catch {
      return false;
    }
  }, []);

  const isPresident = user?.role === "president";
  const isTreasurer = user?.role === "treasurer";

  const refreshSession = useCallback(async () => {
    try {
      const data = await apiGet<{ user: User; group: Group }>("/api/auth/session");
      setUser(data.user);
      setGroup(data.group);
    } catch {}
  }, []);

  const value = useMemo(
    () => ({ user, group, isLoading, login, registerPresident, registerMember, logout, verifyPassword, isPresident, isTreasurer, refreshSession }),
    [user, group, isLoading, login, registerPresident, registerMember, logout, verifyPassword, isPresident, isTreasurer, refreshSession],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) throw new Error("useAuth must be used within AuthProvider");
  return context;
}
