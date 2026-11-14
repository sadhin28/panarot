
import {
  BrowserRouter,
  Navigate,
  Route,
  Routes,
} from "react-router-dom";

import { AuthProvider, useAuth } from "./contexts/AuthContext";
import ProtectedRoute from "./components/ProtectedRoute";
import AppLayout from "./components/AppLayout";

import Login from "./pages/Login";
import Dashboard from "./pages/Dashboard";
import Buyers from "./pages/Buyers";
import Sellers from "./pages/Sellers";
import Purchases from "./pages/Purchases";
import Payments from "./pages/Payments";
import Ledger from "./pages/Ledger";
import Settings from "./pages/Settings";
import Reports from "./pages/Reports";
import Sales from "./pages/Sales";
import Expenses from "./pages/Expenses";
import DailyClosing from "./pages/DailyClosing";
import UsersPage from "./pages/Users";

function ComingSoon({ title }: { title: string }) {
  return (
    <div className="flex min-h-[60vh] items-center justify-center">
      <div className="w-full max-w-md rounded-2xl border border-slate-200 bg-white p-8 text-center shadow-sm dark:border-slate-800 dark:bg-slate-900">
        <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-2xl bg-emerald-50 text-emerald-600 dark:bg-emerald-500/10">
          <span className="text-2xl">🚧</span>
        </div>
        <h1 className="text-2xl font-bold text-slate-900 dark:text-white">
          {title}
        </h1>
        <p className="mt-2 text-sm text-slate-500 dark:text-slate-400">
          এই মডিউলটি এখনো তৈরি করা হচ্ছে।
        </p>
      </div>
    </div>
  );
}

function AppRoutes() {
  const { user, profile, loading } = useAuth();

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-slate-50 dark:bg-slate-950">
        <div className="text-center">
          <div className="mx-auto h-10 w-10 animate-spin rounded-full border-4 border-emerald-100 border-t-emerald-600" />
          <p className="mt-4 text-sm font-semibold text-slate-600 dark:text-slate-300">
            Pan Arot Pro Loading...
          </p>
        </div>
      </div>
    );
  }

  return (
    <Routes>
      <Route
        path="/login"
        element={
          user && profile
            ? <Navigate to="/dashboard" replace />
            : <Login />
        }
      />

      <Route element={<ProtectedRoute />}>
        <Route element={<AppLayout />}>
          <Route path="/dashboard" element={<Dashboard />} />

          <Route path="/buyers" element={<Buyers />} />
          <Route path="/sellers" element={<Sellers />} />

          <Route path="/purchases" element={<Purchases />} />
          <Route path="/sales" element={<Sales />} />
          <Route path="/payments" element={<Payments />} />

          <Route path="/stock" element={<ComingSoon title="Stock & Inventory" />} />

          <Route path="/expenses" element={<Expenses />} />
          <Route path="/other-income" element={<ComingSoon title="Other Income" />} />
          <Route path="/profit-sharing" element={<ComingSoon title="Profit Sharing" />} />
          <Route path="/ledger" element={<Ledger />} />
          <Route path="/daily-closing" element={<DailyClosing/>} />

          <Route path="/reports" element={<Reports/>} />

          <Route path="/notifications" element={<ComingSoon title="Notifications" />} />
          <Route path="/settings" element={<Settings/>} />
          <Route path="/users" element={<UsersPage/>} />
        </Route>
      </Route>

      <Route
        path="*"
        element={
          <Navigate
            to={user && profile ? "/dashboard" : "/login"}
            replace
          />
        }
      />
    </Routes>
  );
}

export default function App() {
  return (
    <BrowserRouter>
      <AuthProvider>
        <AppRoutes />
      </AuthProvider>
    </BrowserRouter>
  );
}



