import {
  createContext,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type PropsWithChildren,
} from "react";
import { useNavigate } from "react-router-dom";
import { toast } from "sonner";

import { api, onUnauthenticated } from "@/shared/api/client";
import type { User } from "@/shared/types/domain";

interface AuthContextValue {
  user: User | null;
  isLoading: boolean;
  login: (email: string, password: string) => Promise<void>;
  register: (name: string, email: string, password: string) => Promise<void>;
  logout: () => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: PropsWithChildren) {
  const [user, setUser] = useState<User | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const navigate = useNavigate();
  // The latest user for the expiry handler, which must not run again for every request that fails after it.
  const userRef = useRef<User | null>(null);

  useEffect(() => {
    userRef.current = user;
  }, [user]);

  // A request of a signed-in screen came back 401: the session expired. Say so once and go to sign in.
  useEffect(
    () =>
      onUnauthenticated(() => {
        if (!userRef.current) return;
        userRef.current = null;
        toast.error("Your session expired. Sign in again.");
        navigate("/login", { replace: true });
        setUser(null);
      }),
    [navigate],
  );

  useEffect(() => {
    api
      .me()
      .then(({ user: currentUser }) => setUser(currentUser))
      .catch(() => {
        // A missing or expired session intentionally leaves the visitor signed out.
      })
      .finally(() => setIsLoading(false));
  }, []);

  const value = useMemo(
    () => ({
      user,
      isLoading,
      login: async (email: string, password: string) => {
        const result = await api.login(email, password);
        setUser(result.user);
      },
      register: async (name: string, email: string, password: string) => {
        const result = await api.register(name, email, password);
        setUser(result.user);
      },
      logout: async () => {
        await api.logout();
        setUser(null);
      },
    }),
    [user, isLoading],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) throw new Error("useAuth must be used inside AuthProvider");
  return context;
}
