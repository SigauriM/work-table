import { createContext } from "react";
import type { PublicUser } from "../types/api";

export type AuthContextValue = {
  user: PublicUser | null;
  ready: boolean;
  login: (login: string, password: string) => Promise<void>;
  logout: () => Promise<void>;
};

export const AuthContext = createContext<AuthContextValue | null>(null);
