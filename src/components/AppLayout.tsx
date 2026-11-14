
import { useEffect, useState } from "react";
import {
  NavLink,
  Outlet,
  useLocation,
  useNavigate,
} from "react-router-dom";
import { useAuth } from "../contexts/AuthContext";
import {
  LayoutDashboard,
  Users,
  Truck,
  ShoppingCart,
  Wallet,
  Receipt,
  ChartNoAxesCombined,
  Settings,
  UserCog,
  Menu,
  X,
  Sun,
  Moon,
  LogOut,
  ChevronDown,
  Search,
  Leaf,
  CalendarDays,
  BookOpen,
  PanelLeftClose,
  PanelLeftOpen,
} from "lucide-react";

const navigation = [
  {
    title: "মূল মেনু",
    items: [
      { label: "ড্যাশবোর্ড", path: "/dashboard", icon: LayoutDashboard },
    ],
  },
  {
    title: "ব্যবস্থাপনা",
    items: [
      { label: "Buyer Management", path: "/buyers", icon: Users },
      { label: "Seller Management", path: "/sellers", icon: Truck },
      { label: "দৈনিক পান এন্ট্রি", path: "/purchases", icon: ShoppingCart },
    ],
  },
  {
    title: "আর্থিক হিসাব",
    items: [
      { label: "পেমেন্ট ও কালেকশন", path: "/payments", icon: Wallet },
      { label: "লেনদেনের খাতা", path: "/ledger", icon: BookOpen },
      { label: "খরচ", path: "/expenses", icon: Receipt },
      { label: "দৈনিক ক্লোজিং", path: "/daily-closing", icon: CalendarDays },
      { label: "বিক্রয়", path: "/sales", icon: Receipt },
    ],
  },
  {
    title: "রিপোর্ট ও সেটিংস",
    items: [
      { label: "রিপোর্ট", path: "/reports", icon: ChartNoAxesCombined },
      { label: "ব্যবহারকারী", path: "/users", icon: UserCog },
      { label: "ব্যবসার সেটিংস", path: "/settings", icon: Settings },
    ],
  },
];

const pageTitles: Record<string, string> = {
  "/dashboard": "ড্যাশবোর্ড",
  "/buyers": "ক্রেতা ব্যবস্থাপনা",
  "/sellers": "বিক্রেতা ব্যবস্থাপনা",
  "/purchases": "দৈনিক পান এন্ট্রি",
  "/sales": "বিক্রয়",
  "/payments": "পেমেন্ট ও কালেকশন",
  "/expenses": "খরচ",
  "/other-income": "অন্যান্য আয়",
  "/profit-sharing": "লাভ বণ্টন",
  "/ledger": "লেনদেনের খাতা",
  "/daily-closing": "দৈনিক ক্লোজিং",
  "/reports": "রিপোর্ট",
  "/notifications": "নোটিফিকেশন",
  "/users": "ব্যবহারকারী",
  "/settings": "ব্যবসার সেটিংস",
};

export default function AppLayout() {
  const { user, profile, signOut } = useAuth();

  const navigate = useNavigate();
  const location = useLocation();

  const isAdmin = profile?.role === "admin";

  const [dark, setDark] = useState(
    () => localStorage.getItem("pan-arot-theme") === "dark"
  );
  const [mobileOpen, setMobileOpen] = useState(false);
  const [collapsed, setCollapsed] = useState(false);
  const [profileOpen, setProfileOpen] = useState(false);
  const [loggingOut, setLoggingOut] = useState(false);

  useEffect(() => {
    document.documentElement.classList.toggle("dark", dark);
    localStorage.setItem("pan-arot-theme", dark ? "dark" : "light");
  }, [dark]);

  useEffect(() => {
    setMobileOpen(false);
    setProfileOpen(false);
  }, [location.pathname]);

  async function handleLogout() {
    try {
      setLoggingOut(true);
      await signOut();
      navigate("/login", { replace: true });
    } catch (error) {
      console.error("Logout error:", error);
      alert("Logout করা যায়নি। আবার চেষ্টা করুন।");
    } finally {
      setLoggingOut(false);
    }
  }

  const currentTitle =
    pageTitles[location.pathname] || "Pan Arot Pro";

  const initials = (profile?.full_name || user?.email || "U")
    .split(" ")
    .map((part) => part[0])
    .join("")
    .slice(0, 2)
    .toUpperCase();

  // Employee-এর জন্য Settings menu বাদ দেওয়া
  const visibleNavigation = navigation
    .map((group) => ({
      ...group,
      items: group.items.filter(
        (item) => item.path !== "/settings" || isAdmin
      ),
    }))
    .filter((group) => group.items.length > 0);

  return (
    <div className="app-shell min-h-screen bg-slate-50 text-slate-800 dark:bg-slate-950 dark:text-slate-100">
      {mobileOpen && (
        <button
          type="button"
          aria-label="Close sidebar"
          onClick={() => setMobileOpen(false)}
          className="fixed inset-0 z-40 bg-slate-950/50 backdrop-blur-sm lg:hidden"
        />
      )}

      <aside
        className={`app-sidebar fixed inset-y-0 left-0 z-50 flex flex-col border-r border-slate-200 bg-white transition-all duration-300 dark:border-slate-800 dark:bg-slate-900 ${
          mobileOpen
            ? "translate-x-0"
            : "-translate-x-full lg:translate-x-0"
        } ${collapsed ? "lg:w-[82px]" : "w-[270px]"}`}
      >
        <div className="flex h-[76px] shrink-0 items-center justify-between border-b border-slate-100 px-5 dark:border-slate-800">
          <button
            onClick={() => navigate("/dashboard")}
            className="flex items-center gap-3 overflow-hidden"
          >
            <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-emerald-600 text-white shadow-lg shadow-emerald-600/20">
              <Leaf size={23} />
            </span>

            {!collapsed && (
              <span className="text-left">
                <span className="block text-lg font-extrabold tracking-tight text-slate-900 dark:text-white">
                  Pan Arot Pro
                </span>
                <span className="block text-[10px] font-semibold uppercase tracking-[2px] text-emerald-600">
                  Business Management
                </span>
              </span>
            )}
          </button>

          <button
            onClick={() => setMobileOpen(false)}
            className="rounded-lg p-2 text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-800 lg:hidden"
            aria-label="Close menu"
          >
            <X size={20} />
          </button>
        </div>

        <nav className="custom-scrollbar flex-1 space-y-6 overflow-y-auto px-3 py-5">
          {visibleNavigation.map((group) => (
            <div key={group.title}>
              {!collapsed && (
                <p className="mb-2 px-3 text-[10px] font-bold uppercase tracking-[1.5px] text-slate-400">
                  {group.title}
                </p>
              )}

              <div className="space-y-1">
                {group.items.map((item) => {
                  const Icon = item.icon;

                  return (
                    <NavLink
                      key={item.path}
                      to={item.path}
                      title={collapsed ? item.label : undefined}
                      className={({ isActive }) =>
                        `sidebar-link flex items-center gap-3 rounded-xl px-3 py-3 text-[13px] font-semibold transition-all ${
                          isActive
                            ? "bg-emerald-50 text-emerald-700 dark:bg-emerald-500/10 dark:text-emerald-400"
                            : "text-slate-500 hover:bg-slate-50 hover:text-slate-900 dark:text-slate-400 dark:hover:bg-slate-800 dark:hover:text-white"
                        } ${collapsed ? "justify-center" : ""}`
                      }
                    >
                      <Icon size={19} className="shrink-0" />
                      {!collapsed && <span>{item.label}</span>}
                    </NavLink>
                  );
                })}
              </div>
            </div>
          ))}
        </nav>

        <div className="border-t border-slate-100 p-3 dark:border-slate-800">
          {!collapsed && (
            <div className="mb-3 rounded-xl bg-emerald-50 p-3 dark:bg-emerald-500/10">
              <p className="text-xs font-bold text-emerald-800 dark:text-emerald-400">
                Pan Arot Pro
              </p>
              <p className="mt-1 text-[11px] text-emerald-700/70 dark:text-emerald-400/70">
                আপনার ব্যবসা, আপনার নিয়ন্ত্রণ।
              </p>
            </div>
          )}

          <button
            onClick={() => setCollapsed((value) => !value)}
            className="hidden w-full items-center justify-center gap-2 rounded-lg p-2 text-xs font-semibold text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 lg:flex"
          >
            {collapsed ? (
              <PanelLeftOpen size={18} />
            ) : (
              <>
                <PanelLeftClose size={18} />
                Sidebar ছোট করুন
              </>
            )}
          </button>
        </div>
      </aside>

      <div
        className={`min-h-screen transition-all duration-300 ${
          collapsed ? "lg:ml-[82px]" : "lg:ml-[270px]"
        }`}
      >
        <header className="sticky top-0 z-30 flex h-[76px] items-center justify-between border-b border-slate-200 bg-white/90 px-4 backdrop-blur-xl dark:border-slate-800 dark:bg-slate-900/90 sm:px-6 lg:px-8">
          <div className="flex min-w-0 items-center gap-3">
            <button
              onClick={() => setMobileOpen(true)}
              className="rounded-xl border border-slate-200 p-2 text-slate-600 dark:border-slate-700 dark:text-slate-300 lg:hidden"
              aria-label="Open menu"
            >
              <Menu size={20} />
            </button>

            <div className="min-w-0">
              <h1 className="truncate text-lg font-bold text-slate-900 dark:text-white sm:text-xl">
                {currentTitle}
              </h1>
              <p className="hidden text-xs text-slate-400 sm:block">
                Pan Arot Pro / {currentTitle}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2 sm:gap-3">
            <div className="hidden items-center gap-2 rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-xs text-slate-400 dark:border-slate-700 dark:bg-slate-800 sm:flex">
              <Search size={15} />
              <span>Business Dashboard</span>
            </div>

            <button
              onClick={() => setDark((value) => !value)}
              className="rounded-xl border border-slate-200 p-2.5 text-slate-600 transition hover:bg-slate-100 dark:border-slate-700 dark:text-amber-400 dark:hover:bg-slate-800"
              title={dark ? "Light Mode" : "Dark Mode"}
            >
              {dark ? <Sun size={19} /> : <Moon size={19} />}
            </button>

            <div className="relative">
              <button
                onClick={() => setProfileOpen((value) => !value)}
                className="flex items-center gap-2 rounded-xl p-1.5 hover:bg-slate-100 dark:hover:bg-slate-800"
              >
                <span className="flex h-9 w-9 items-center justify-center rounded-full bg-emerald-600 text-xs font-bold text-white">
                  {initials}
                </span>

                <span className="hidden text-left sm:block">
                  <span className="block max-w-[130px] truncate text-xs font-bold text-slate-800 dark:text-white">
                    {profile?.full_name || "User"}
                  </span>
                  <span className="block text-[10px] capitalize text-slate-400">
                    {profile?.role || "Account"}
                  </span>
                </span>

                <ChevronDown
                  size={15}
                  className="hidden text-slate-400 sm:block"
                />
              </button>

              {profileOpen && (
                <div className="absolute right-0 top-14 z-50 w-56 rounded-2xl border border-slate-200 bg-white p-2 shadow-xl dark:border-slate-700 dark:bg-slate-900">
                  <div className="border-b border-slate-100 px-3 py-3 dark:border-slate-800">
                    <p className="text-sm font-bold">
                      {profile?.full_name || "User"}
                    </p>
                    <p className="mt-1 truncate text-xs text-slate-400">
                      {user?.email}
                    </p>
                  </div>

                  <button
                    onClick={handleLogout}
                    disabled={loggingOut}
                    className="mt-2 flex w-full items-center gap-2 rounded-xl px-3 py-2.5 text-sm font-semibold text-red-600 hover:bg-red-50 disabled:opacity-50 dark:hover:bg-red-500/10"
                  >
                    <LogOut size={17} />
                    {loggingOut ? "Logout হচ্ছে..." : "Logout"}
                  </button>
                </div>
              )}
            </div>
          </div>
        </header>

        <main className="mx-auto w-full max-w-[1600px] p-4 sm:p-6 lg:p-8">
          <Outlet />
        </main>

        <footer className="border-t border-slate-200 px-6 py-5 text-center text-xs text-slate-400 dark:border-slate-800">
          © {new Date().getFullYear()} Pan Arot Pro. All rights reserved.
        </footer>
      </div>
    </div>
  );
}
