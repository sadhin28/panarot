
import {
  createContext,
  useContext,
  useEffect,
  useState,
  type ReactNode,
} from "react";
import type { User } from "@supabase/supabase-js";
import { supabase } from "../lib/supabase";

export interface Profile {
  id: string;
  full_name: string;
  phone: string | null;
  role: "admin" | "employee";
  is_active: boolean;
}

interface AuthContextType {
  user: User | null;
  profile: Profile | null;
  loading: boolean;
  signIn: (email: string, password: string) => Promise<void>;
  signOut: () => Promise<void>;
  refreshProfile: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [loading, setLoading] = useState(true);

  async function loadProfile(userId: string) {
    const { data, error } = await supabase
      .from("profiles")
      .select("id, full_name, phone, role, is_active")
      .eq("id", userId)
      .single();

    if (error || !data) {
      setProfile(null);
      throw new Error("User profile পাওয়া যায়নি।");
    }

    if (!data.is_active) {
      setProfile(null);
      throw new Error("আপনার Account Deactivated। Admin-এর সঙ্গে যোগাযোগ করুন।");
    }

    setProfile(data as Profile);
    return data as Profile;
  }

  async function signIn(email: string, password: string) {
    const { data, error } = await supabase.auth.signInWithPassword({
      email,
      password,
    });

    if (error) throw error;

    if (!data.user) {
      throw new Error("Login করা সম্ভব হয়নি।");
    }

    try {
      await loadProfile(data.user.id);
      setUser(data.user);
    } catch (profileError) {
      await supabase.auth.signOut();
      setUser(null);
      setProfile(null);
      throw profileError;
    }
  }

  async function signOut() {
    const { error } = await supabase.auth.signOut();

    if (error) throw error;

    setUser(null);
    setProfile(null);
  }

  async function refreshProfile() {
    if (user) {
      await loadProfile(user.id);
    }
  }

  useEffect(() => {
    let mounted = true;

    const initialize = async () => {
      const { data } = await supabase.auth.getSession();

      if (!mounted) return;

      if (data.session?.user) {
        setUser(data.session.user);

        try {
          await loadProfile(data.session.user.id);
        } catch {
          await supabase.auth.signOut();
          setUser(null);
          setProfile(null);
        }
      }

      if (mounted) setLoading(false);
    };

    void initialize();

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, session) => {
      if (!mounted) return;

      if (!session?.user) {
        setUser(null);
        setProfile(null);
        setLoading(false);
      } else {
        setUser(session.user);
      }
    });

    return () => {
      mounted = false;
      subscription.unsubscribe();
    };
  }, []);

  return (
    <AuthContext.Provider
      value={{
        user,
        profile,
        loading,
        signIn,
        signOut,
        refreshProfile,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);

  if (!context) {
    throw new Error("useAuth must be used inside AuthProvider");
  }

  return context;
}
