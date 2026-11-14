
import { useState, type FormEvent } from "react";
import { useNavigate } from "react-router-dom";
import {
  Leaf,
  Mail,
  Lock,
  Eye,
  EyeOff,
  ArrowRight,
  ShieldCheck,
  AlertCircle,
  Loader2,
} from "lucide-react";

import { useAuth } from "../contexts/AuthContext";

export default function Login() {
  const { signIn } = useAuth();
  const navigate = useNavigate();

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();

    if (loading) return;

    setError("");
    setLoading(true);

    try {
      await signIn(email.trim(), password);
      navigate("/dashboard", { replace: true });
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : "Login করা সম্ভব হয়নি। আবার চেষ্টা করুন।"
      );
    } finally {
      setLoading(false);
    }
  }

  return (
    <main className="flex min-h-screen items-center justify-center bg-slate-50 px-4 py-10">

      <div className="w-full max-w-md">

        {/* Brand */}
        <div className="mb-8 text-center">

          <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-2xl bg-emerald-700 text-white shadow-sm">
            <Leaf size={29} strokeWidth={2.2} />
          </div>

          <h1 className="text-2xl font-bold tracking-tight text-slate-900">
            Pan Arot Pro
          </h1>

          <p className="mt-1 text-xs font-medium tracking-[2px] text-emerald-700">
            BUSINESS MANAGEMENT SYSTEM
          </p>

        </div>

        {/* Login Card */}
        <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm sm:p-9">

          {/* Heading */}
          <div className="mb-8">

            <h2 className="text-2xl font-bold text-slate-900">
              Welcome Back
            </h2>

            <p className="mt-2 text-sm leading-6 text-slate-500">
              আপনার অ্যাকাউন্টে প্রবেশ করতে Email ও Password দিন।
            </p>

          </div>

          {/* Form */}
          <form onSubmit={handleSubmit} className="space-y-5">

            {/* Email */}
            <div>

              <label
                htmlFor="login-email"
                className="mb-2 block text-sm font-semibold text-slate-700"
              >
                Email Address
              </label>

              <div className="relative">

                <Mail
                  size={18}
                  className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400"
                />

                <input
                  id="login-email"
                  type="email"
                  autoComplete="username"
                  required
                  value={email}
                  onChange={(e) => {
                    setEmail(e.target.value);
                    setError("");
                  }}
                  placeholder="name@example.com"
                  disabled={loading}
                  className="h-12 w-full rounded-lg border border-slate-200 bg-white pl-11 pr-4 text-sm text-slate-800 outline-none transition placeholder:text-slate-400 hover:border-slate-300 focus:border-emerald-600 focus:ring-2 focus:ring-emerald-600/10 disabled:bg-slate-50"
                />

              </div>

            </div>

            {/* Password */}
            <div>

              <div className="mb-2 flex items-center justify-between">

                <label
                  htmlFor="login-password"
                  className="text-sm font-semibold text-slate-700"
                >
                  Password
                </label>

              </div>

              <div className="relative">

                <Lock
                  size={18}
                  className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400"
                />

                <input
                  id="login-password"
                  type={showPassword ? "text" : "password"}
                  autoComplete="current-password"
                  required
                  value={password}
                  onChange={(e) => {
                    setPassword(e.target.value);
                    setError("");
                  }}
                  placeholder="Enter your password"
                  disabled={loading}
                  className="h-12 w-full rounded-lg border border-slate-200 bg-white pl-11 pr-12 text-sm text-slate-800 outline-none transition placeholder:text-slate-400 hover:border-slate-300 focus:border-emerald-600 focus:ring-2 focus:ring-emerald-600/10 disabled:bg-slate-50"
                />

                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  disabled={loading}
                  aria-label={
                    showPassword ? "Hide password" : "Show password"
                  }
                  className="absolute right-3.5 top-1/2 -translate-y-1/2 text-slate-400 transition hover:text-emerald-700"
                >
                  {showPassword ? (
                    <EyeOff size={18} />
                  ) : (
                    <Eye size={18} />
                  )}
                </button>

              </div>

            </div>

            {/* Error */}
            {error && (
              <div
                role="alert"
                className="flex items-start gap-2 rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-600"
              >
                <AlertCircle size={18} className="mt-0.5 shrink-0" />
                <span>{error}</span>
              </div>
            )}

            {/* Login Button */}
            <button
              type="submit"
              disabled={loading}
              className="flex h-12 w-full items-center justify-center gap-2 rounded-lg bg-emerald-700 px-4 text-sm font-semibold text-white transition hover:bg-emerald-800 focus:outline-none focus:ring-4 focus:ring-emerald-700/20 disabled:cursor-not-allowed disabled:opacity-60"
            >

              {loading ? (
                <>
                  <Loader2 size={19} className="animate-spin" />
                  Signing in...
                </>
              ) : (
                <>
                  Sign In
                  <ArrowRight size={18} />
                </>
              )}

            </button>

          </form>

          {/* Security */}
          <div className="mt-7 flex items-center justify-center gap-2 border-t border-slate-100 pt-5">

            <ShieldCheck size={16} className="text-emerald-700" />

            <p className="text-xs text-slate-500">
              Your account is protected with secure authentication.
            </p>

          </div>

        </div>

        {/* Footer */}
        <p className="mt-7 text-center text-xs text-slate-400">
          © 2026 Pan Arot Pro. All rights reserved.
        </p>

      </div>

    </main>
  );
}
