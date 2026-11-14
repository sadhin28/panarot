
import {
  useCallback,
  useEffect,
  useMemo,
  useState,
} from "react";
import type { ElementType, ReactNode } from "react";
import { useNavigate } from "react-router-dom";
import {
  Activity,
  ArrowDownLeft,
  ArrowRight,
  CalendarDays,
  Clock,
  CheckCircle2,
  CreditCard,
  Leaf,
  Package,
  RefreshCw,
  ShoppingCart,
  TrendingUp,
  Truck,
  Users,
  Wallet,
  AlertCircle,
  Percent,
  Receipt,
} from "lucide-react";

import { supabase } from "../lib/supabase";
import { useAuth } from "../contexts/AuthContext";

// --------------------------------------------------
// Types
// --------------------------------------------------

interface DailySummary {
  entry_date: string;
  total_entries: number;
  total_seller_lines: number;
  total_purchase: number;
  total_commission: number;
  total_slip_cost: number;
  total_seller_payable: number;
}

interface BuyerLedger {
  buyer_id: string;
  buyer_code: string;
  name: string;
  phone: string | null;
  opening_balance: number;
  total_purchases: number;
  total_collected: number;
  current_due: number;
}

interface SellerLedger {
  seller_id: string;
  seller_code: string;
  name: string;
  phone: string | null;
  opening_balance: number;
  total_gross: number;
  total_commission: number;
  total_slip_cost: number;
  total_payable: number;
  total_paid: number;
  current_due: number;
}

interface DiscountSummary {
  buyer_id: string;
  buyer_code: string;
  name: string;
  month_start: string;
  monthly_purchase: number;
  discount_percent: number;
  discount_earned: number;
  discount_paid: number;
  discount_remaining: number;
}

interface RecentSlip {
  entry_id: string;
  entry_no: string;
  entry_date: string;
  status: string;
  buyer_id: string;
  buyer_code: string;
  buyer_name: string;
  total_amount: number;
}

interface DashboardData {
  daily: DailySummary[];
  buyers: BuyerLedger[];
  sellers: SellerLedger[];
  discounts: DiscountSummary[];
  recentSlips: RecentSlip[];
  buyerCount: number;
  sellerCount: number;
  settings: Record<string, unknown> | null;
}

// --------------------------------------------------
// Helpers
// --------------------------------------------------

const money = (value: number | string | null | undefined) => {
  const amount = Number(value ?? 0);

  return `৳${new Intl.NumberFormat("en-IN", {
    maximumFractionDigits: 2,
    minimumFractionDigits: 0,
  }).format(Number.isFinite(amount) ? amount : 0)}`;
};

const numeric = (value: number | string | null | undefined) => {
  const result = Number(value ?? 0);
  return Number.isFinite(result) ? result : 0;
};

const getDhakaDate = (date = new Date()) => {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Dhaka",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(date);

  const year = parts.find((part) => part.type === "year")?.value;
  const month = parts.find((part) => part.type === "month")?.value;
  const day = parts.find((part) => part.type === "day")?.value;

  return `${year}-${month}-${day}`;
};

const addDays = (dateString: string, days: number) => {
  const date = new Date(`${dateString}T12:00:00+06:00`);
  date.setDate(date.getDate() + days);
  return getDhakaDate(date);
};

const getMonthStart = (dateString: string) => {
  return `${dateString.slice(0, 7)}-01`;
};

const formatDate = (dateString: string) => {
  if (!dateString) return "—";

  return new Intl.DateTimeFormat("bn-BD", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    timeZone: "Asia/Dhaka",
  }).format(new Date(`${dateString}T12:00:00+06:00`));
};

const getPositiveTotal = (rows: { current_due: number }[]) => {
  return rows.reduce(
    (total, row) => total + Math.max(0, numeric(row.current_due)),
    0
  );
};

const getSetting = (
  settings: Record<string, unknown> | null,
  keys: string[],
  fallback: number
) => {
  if (!settings) return fallback;

  for (const key of keys) {
    const value = settings[key];

    if (value !== undefined && value !== null && value !== "") {
      return numeric(value as number | string);
    }
  }

  return fallback;
};

const getErrorMessage = (error: unknown) => {
  if (error instanceof Error) return error.message;

  if (
    typeof error === "object" &&
    error !== null &&
    "message" in error
  ) {
    return String(error.message);
  }

  return "ডেটা লোড করা যায়নি। আবার চেষ্টা করুন।";
};

// --------------------------------------------------
// Reusable Components
// --------------------------------------------------

function StatCard({
  title,
  value,
  subtitle,
  icon: Icon,
  iconClass = "bg-emerald-50 text-emerald-600",
  onClick,
}: {
  title: string;
  value: string;
  subtitle: string;
  icon: ElementType;
  iconClass?: string;
  onClick?: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="dashboard-card w-full rounded-2xl border border-gray-100 bg-white p-5 text-left shadow-sm transition hover:-translate-y-0.5 hover:shadow-md dark:border-gray-800 dark:bg-gray-900"
    >
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="text-sm font-medium text-gray-500 dark:text-gray-400">
            {title}
          </p>

          <h3 className="mt-3 break-words text-2xl font-bold text-gray-900 dark:text-white">
            {value}
          </h3>

          <p className="mt-2 text-xs text-gray-500 dark:text-gray-400">
            {subtitle}
          </p>
        </div>

        <div className={`rounded-xl p-3 ${iconClass}`}>
          <Icon size={21} />
        </div>
      </div>
    </button>
  );
}

function SectionTitle({
  title,
  subtitle,
  action,
}: {
  title: string;
  subtitle?: string;
  action?: ReactNode;
}) {
  return (
    <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
      <div>
        <h2 className="text-lg font-bold text-gray-900 dark:text-white">
          {title}
        </h2>

        {subtitle && (
          <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
            {subtitle}
          </p>
        )}
      </div>

      {action}
    </div>
  );
}

function EmptyState({ message }: { message: string }) {
  return (
    <div className="flex flex-col items-center justify-center py-10 text-center">
      <Package className="mb-3 text-gray-300" size={34} />
      <p className="text-sm text-gray-500 dark:text-gray-400">
        {message}
      </p>
    </div>
  );
}

// --------------------------------------------------
// Dashboard
// --------------------------------------------------

type Period = "today" | "week" | "month";

export default function Dashboard() {
  const navigate = useNavigate();
  const { profile } = useAuth();

  const [data, setData] = useState<DashboardData>({
    daily: [],
    buyers: [],
    sellers: [],
    discounts: [],
    recentSlips: [],
    buyerCount: 0,
    sellerCount: 0,
    settings: null,
  });

  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState("");
  const [period, setPeriod] = useState<Period>("today");

  const today = getDhakaDate();
  const monthStart = getMonthStart(today);
  const sevenDaysAgo = addDays(today, -6);

  // ------------------------------------------------
  // Load Supabase Data
  // ------------------------------------------------

  const loadDashboard = useCallback(async (isRefresh = false) => {
    if (isRefresh) {
      setRefreshing(true);
    } else {
      setLoading(true);
    }

    setError("");

    try {
      const currentDate = getDhakaDate();
      const currentMonthStart = getMonthStart(currentDate);
      const weekStart = addDays(currentDate, -6);

      const queryStart =
        weekStart < currentMonthStart
          ? weekStart
          : currentMonthStart;

      const [
        dailyResult,
        buyerResult,
        sellerResult,
        discountResult,
        recentResult,
        buyerCountResult,
        sellerCountResult,
        settingsResult,
      ] = await Promise.all([
        supabase
          .from("pan_daily_summary")
          .select("*")
          .gte("entry_date", queryStart)
          .lte("entry_date", currentDate)
          .order("entry_date", { ascending: true }),

        supabase
          .from("buyer_ledger_summary")
          .select("*"),

        supabase
          .from("seller_ledger_summary")
          .select("*"),

        supabase
          .from("buyer_monthly_discount_summary")
          .select("*")
          .eq("month_start", currentMonthStart),

        supabase
          .from("buyer_combined_slips")
          .select(
            "entry_id,entry_no,entry_date,status,buyer_id,buyer_code,buyer_name,total_amount"
          )
          .eq("status", "posted")
          .order("entry_date", { ascending: false })
          .limit(8),

        supabase
          .from("buyers")
          .select("id", { count: "exact", head: true })
          .eq("is_active", true),

        supabase
          .from("sellers")
          .select("id", { count: "exact", head: true })
          .eq("is_active", true),

        supabase
          .from("pan_arot_settings")
          .select("*")
          .limit(1)
          .maybeSingle(),
      ]);

      const results = [
        dailyResult,
        buyerResult,
        sellerResult,
        discountResult,
        recentResult,
        buyerCountResult,
        sellerCountResult,
        settingsResult,
      ];

      const failedResult = results.find((result) => result.error);

      if (failedResult?.error) {
        throw failedResult.error;
      }

      setData({
        daily: (dailyResult.data ?? []) as DailySummary[],
        buyers: (buyerResult.data ?? []) as BuyerLedger[],
        sellers: (sellerResult.data ?? []) as SellerLedger[],
        discounts: (discountResult.data ?? []) as DiscountSummary[],
        recentSlips: (recentResult.data ?? []) as RecentSlip[],
        buyerCount: buyerCountResult.count ?? 0,
        sellerCount: sellerCountResult.count ?? 0,
        settings: settingsResult.data as Record<string, unknown> | null,
      });
    } catch (err) {
      console.error("Dashboard loading error:", err);
      setError(getErrorMessage(err));
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    void loadDashboard();

    const handleFocus = () => {
      void loadDashboard(true);
    };

    window.addEventListener("focus", handleFocus);

    return () => {
      window.removeEventListener("focus", handleFocus);
    };
  }, [loadDashboard]);

  // ------------------------------------------------
  // Calculate Dashboard Numbers
  // ------------------------------------------------

  const selectedDailyRows = useMemo(() => {
    if (period === "today") {
      return data.daily.filter(
        (row) => row.entry_date === today
      );
    }

    if (period === "week") {
      return data.daily.filter(
        (row) =>
          row.entry_date >= sevenDaysAgo &&
          row.entry_date <= today
      );
    }

    return data.daily.filter(
      (row) =>
        row.entry_date >= monthStart &&
        row.entry_date <= today
    );
  }, [data.daily, period, today, sevenDaysAgo, monthStart]);

  const totals = useMemo(() => {
    return selectedDailyRows.reduce(
      (result, row) => ({
        entries: result.entries + numeric(row.total_entries),
        sellerLines:
          result.sellerLines + numeric(row.total_seller_lines),
        purchase: result.purchase + numeric(row.total_purchase),
        commission:
          result.commission + numeric(row.total_commission),
        slipCost:
          result.slipCost + numeric(row.total_slip_cost),
        sellerPayable:
          result.sellerPayable + numeric(row.total_seller_payable),
      }),
      {
        entries: 0,
        sellerLines: 0,
        purchase: 0,
        commission: 0,
        slipCost: 0,
        sellerPayable: 0,
      }
    );
  }, [selectedDailyRows]);

  const buyerDue = useMemo(
    () => getPositiveTotal(data.buyers),
    [data.buyers]
  );

  const sellerDue = useMemo(
    () => getPositiveTotal(data.sellers),
    [data.sellers]
  );

  const discountTotals = useMemo(() => {
    return data.discounts.reduce(
      (result, row) => ({
        purchase:
          result.purchase + numeric(row.monthly_purchase),
        earned:
          result.earned + numeric(row.discount_earned),
        paid:
          result.paid + numeric(row.discount_paid),
        remaining:
          result.remaining + numeric(row.discount_remaining),
      }),
      {
        purchase: 0,
        earned: 0,
        paid: 0,
        remaining: 0,
      }
    );
  }, [data.discounts]);

  const commissionRate = getSetting(
    data.settings,
    ["commission_rate"],
    10
  );

  const slipCost = getSetting(
    data.settings,
    ["seller_slip_cost"],
    5
  );

  const discountRate =
    data.discounts.length > 0
      ? numeric(data.discounts[0].discount_percent)
      : getSetting(
          data.settings,
          [
            "buyer_discount_rate",
            "buyer_discount_percent",
            "discount_rate",
          ],
          5
        );

  // ------------------------------------------------
  // Seven-Day Chart
  // ------------------------------------------------

  const chartData = useMemo(() => {
    return Array.from({ length: 7 }, (_, index) => {
      const date = addDays(today, index - 6);

      const row = data.daily.find(
        (item) => item.entry_date === date
      );

      const weekday = new Intl.DateTimeFormat("bn-BD", {
        weekday: "short",
        timeZone: "Asia/Dhaka",
      }).format(new Date(`${date}T12:00:00+06:00`));

      return {
        date,
        weekday,
        amount: numeric(row?.total_purchase),
        entries: numeric(row?.total_entries),
      };
    });
  }, [data.daily, today]);

  const maxChartAmount = Math.max(
    1,
    ...chartData.map((item) => item.amount)
  );

  // ------------------------------------------------
  // Loading Screen
  // ------------------------------------------------

  if (loading) {
    return (
      <div className="space-y-6">
        <div className="h-28 animate-pulse rounded-2xl bg-gray-100 dark:bg-gray-800" />

        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-3">
          {Array.from({ length: 6 }).map((_, index) => (
            <div
              key={index}
              className="h-32 animate-pulse rounded-2xl bg-gray-100 dark:bg-gray-800"
            />
          ))}
        </div>

        <div className="h-72 animate-pulse rounded-2xl bg-gray-100 dark:bg-gray-800" />
      </div>
    );
  }

  // ------------------------------------------------
  // Error Screen
  // ------------------------------------------------

  if (error) {
    return (
      <div className="rounded-2xl border border-red-200 bg-red-50 p-6 dark:border-red-900 dark:bg-red-950/30">
        <div className="flex items-start gap-3">
          <AlertCircle className="mt-1 shrink-0 text-red-600" />

          <div className="min-w-0 flex-1">
            <h3 className="font-bold text-red-700 dark:text-red-400">
              Dashboard ডেটা লোড করা যায়নি
            </h3>

            <p className="mt-2 break-words text-sm text-red-600 dark:text-red-300">
              {error}
            </p>

            <button
              type="button"
              onClick={() => void loadDashboard()}
              className="mt-4 rounded-lg bg-red-600 px-4 py-2 text-sm font-semibold text-white hover:bg-red-700"
            >
              আবার চেষ্টা করুন
            </button>
          </div>
        </div>
      </div>
    );
  }

  // ------------------------------------------------
  // Dashboard UI
  // ------------------------------------------------

  return (
    <div className="space-y-6 pb-8">
      {/* Welcome Header */}

      <div className="relative overflow-hidden rounded-2xl bg-gradient-to-r from-emerald-700 to-green-600 p-6 text-white shadow-lg sm:p-8">
        <div className="relative z-10 flex flex-wrap items-center justify-between gap-5">
          <div>
            <div className="mb-3 flex items-center gap-2 text-sm text-emerald-100">
              <Leaf size={17} />
              <span>Pan Arot Pro Dashboard</span>
            </div>

            <h1 className="text-2xl font-bold sm:text-3xl">
              স্বাগতম, {profile?.full_name || "Admin"}!
            </h1>

            <p className="mt-2 max-w-xl text-sm text-emerald-100">
              আপনার পান আরতের সম্পূর্ণ হিসাব এক জায়গায় দেখুন।
            </p>

            <div className="mt-5 flex items-center gap-2 text-sm text-emerald-100">
              <CalendarDays size={16} />
              {formatDate(today)}
            </div>
          </div>

          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              onClick={() => navigate("/purchases")}
              className="flex items-center gap-2 rounded-xl bg-white px-4 py-3 text-sm font-bold text-emerald-800 shadow-sm transition hover:bg-emerald-50"
            >
              <ShoppingCart size={17} />
              নতুন ক্রয় এন্ট্রি
            </button>

            <button
              type="button"
              onClick={() => void loadDashboard(true)}
              disabled={refreshing}
              className="flex items-center gap-2 rounded-xl border border-white/30 bg-white/10 px-4 py-3 text-sm font-semibold text-white transition hover:bg-white/20 disabled:opacity-60"
            >
              <RefreshCw
                size={16}
                className={refreshing ? "animate-spin" : ""}
              />
              Refresh
            </button>
          </div>
        </div>

        <div className="pointer-events-none absolute -right-10 -top-20 h-64 w-64 rounded-full border-[35px] border-white/10" />
        <div className="pointer-events-none absolute -bottom-32 right-40 h-64 w-64 rounded-full border-[35px] border-white/10" />
      </div>

      {/* Period Selector */}

      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-lg font-bold text-gray-900 dark:text-white">
            ব্যবসার সারসংক্ষেপ
          </h2>

          <p className="text-sm text-gray-500 dark:text-gray-400">
            নির্বাচিত সময়ের হিসাব
          </p>
        </div>

        <div className="flex rounded-xl border border-gray-200 bg-white p-1 dark:border-gray-700 dark:bg-gray-900">
          {(
            [
              ["today", "আজ"],
              ["week", "৭ দিন"],
              ["month", "এই মাস"],
            ] as [Period, string][]
          ).map(([value, label]) => (
            <button
              key={value}
              type="button"
              onClick={() => setPeriod(value)}
              className={`rounded-lg px-4 py-2 text-sm font-semibold transition ${
                period === value
                  ? "bg-emerald-600 text-white shadow-sm"
                  : "text-gray-500 hover:bg-gray-100 dark:text-gray-400 dark:hover:bg-gray-800"
              }`}
            >
              {label}
            </button>
          ))}
        </div>
      </div>

      {/* Main Statistics */}

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-3">
        <StatCard
          title="মোট পান ক্রয়"
          value={money(totals.purchase)}
          subtitle={`${totals.entries} টি Buyer Entry`}
          icon={ShoppingCart}
          iconClass="bg-blue-50 text-blue-600 dark:bg-blue-950/40 dark:text-blue-400"
          onClick={() => navigate("/purchases")}
        />

        <StatCard
          title="মোট কমিশন"
          value={money(totals.commission)}
          subtitle={`Commission Rate ${commissionRate}%`}
          icon={TrendingUp}
          iconClass="bg-emerald-50 text-emerald-600 dark:bg-emerald-950/40 dark:text-emerald-400"
        />

        <StatCard
          title="Seller Slip Charge"
          value={money(totals.slipCost)}
          subtitle={`${totals.sellerLines} টি Seller Line`}
          icon={Receipt}
          iconClass="bg-purple-50 text-purple-600 dark:bg-purple-950/40 dark:text-purple-400"
        />

        <StatCard
          title="Seller-কে পরিশোধযোগ্য"
          value={money(totals.sellerPayable)}
          subtitle="নির্বাচিত সময়ের Seller Payable"
          icon={Truck}
          iconClass="bg-orange-50 text-orange-600 dark:bg-orange-950/40 dark:text-orange-400"
          onClick={() => navigate("/payments")}
        />

        <StatCard
          title="Buyer-এর বকেয়া"
          value={money(buyerDue)}
          subtitle="সকল Buyer-এর বর্তমান পজিটিভ বকেয়া"
          icon={ArrowDownLeft}
          iconClass="bg-red-50 text-red-600 dark:bg-red-950/40 dark:text-red-400"
          onClick={() => navigate("/buyers")}
        />

        <StatCard
          title="Seller-এর পাওনা"
          value={money(sellerDue)}
          subtitle="সকল Seller-এর বর্তমান পজিটিভ পাওনা"
          icon={Wallet}
          iconClass="bg-amber-50 text-amber-600 dark:bg-amber-950/40 dark:text-amber-400"
          onClick={() => navigate("/sellers")}
        />
      </div>

      {/* Party Overview */}

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <button
          type="button"
          onClick={() => navigate("/buyers")}
          className="flex items-center justify-between rounded-2xl border border-gray-100 bg-white p-5 text-left shadow-sm transition hover:shadow-md dark:border-gray-800 dark:bg-gray-900"
        >
          <div className="flex items-center gap-4">
            <div className="rounded-xl bg-blue-50 p-3 text-blue-600 dark:bg-blue-950/40 dark:text-blue-400">
              <Users size={24} />
            </div>

            <div>
              <p className="text-sm text-gray-500 dark:text-gray-400">
                Active Buyers
              </p>
              <h3 className="mt-1 text-2xl font-bold text-gray-900 dark:text-white">
                {data.buyerCount}
              </h3>
            </div>
          </div>

          <ArrowRight className="text-gray-400" />
        </button>

        <button
          type="button"
          onClick={() => navigate("/sellers")}
          className="flex items-center justify-between rounded-2xl border border-gray-100 bg-white p-5 text-left shadow-sm transition hover:shadow-md dark:border-gray-800 dark:bg-gray-900"
        >
          <div className="flex items-center gap-4">
            <div className="rounded-xl bg-emerald-50 p-3 text-emerald-600 dark:bg-emerald-950/40 dark:text-emerald-400">
              <Truck size={24} />
            </div>

            <div>
              <p className="text-sm text-gray-500 dark:text-gray-400">
                Active Sellers
              </p>
              <h3 className="mt-1 text-2xl font-bold text-gray-900 dark:text-white">
                {data.sellerCount}
              </h3>
            </div>
          </div>

          <ArrowRight className="text-gray-400" />
        </button>
      </div>

      {/* Monthly Discount */}

      <section className="rounded-2xl border border-gray-100 bg-white p-5 shadow-sm dark:border-gray-800 dark:bg-gray-900 sm:p-6">
        <SectionTitle
          title="Buyer Monthly Discount"
          subtitle={`${formatDate(monthStart)} থেকে ${formatDate(today)} পর্যন্ত`}
          action={
            <button
              type="button"
              onClick={() => navigate("/profit-sharing")}
              className="flex items-center gap-1 text-sm font-semibold text-emerald-600 hover:text-emerald-700"
            >
              বিস্তারিত
              <ArrowRight size={16} />
            </button>
          }
        />

        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
          <div className="rounded-xl bg-gray-50 p-4 dark:bg-gray-800/70">
            <p className="text-sm text-gray-500 dark:text-gray-400">
              মাসিক মোট কেনাকাটা
            </p>
            <h3 className="mt-2 text-xl font-bold text-gray-900 dark:text-white">
              {money(discountTotals.purchase)}
            </h3>
          </div>

          <div className="rounded-xl bg-emerald-50 p-4 dark:bg-emerald-950/30">
            <p className="text-sm text-emerald-700 dark:text-emerald-400">
              Discount অর্জিত
            </p>
            <h3 className="mt-2 text-xl font-bold text-emerald-800 dark:text-emerald-300">
              {money(discountTotals.earned)}
            </h3>
            <p className="mt-1 text-xs text-emerald-700 dark:text-emerald-400">
              Discount Rate: {discountRate}%
            </p>
          </div>

          <div className="rounded-xl bg-blue-50 p-4 dark:bg-blue-950/30">
            <p className="text-sm text-blue-700 dark:text-blue-400">
              Discount পরিশোধিত
            </p>
            <h3 className="mt-2 text-xl font-bold text-blue-800 dark:text-blue-300">
              {money(discountTotals.paid)}
            </h3>
          </div>

          <div className="rounded-xl bg-orange-50 p-4 dark:bg-orange-950/30">
            <p className="text-sm text-orange-700 dark:text-orange-400">
              Discount বাকি
            </p>
            <h3 className="mt-2 text-xl font-bold text-orange-800 dark:text-orange-300">
              {money(discountTotals.remaining)}
            </h3>
          </div>
        </div>
      </section>

      {/* Seven Day Chart */}

      <section className="rounded-2xl border border-gray-100 bg-white p-5 shadow-sm dark:border-gray-800 dark:bg-gray-900 sm:p-6">
        <SectionTitle
          title="গত ৭ দিনের ক্রয়"
          subtitle="প্রতিদিনের মোট পান কেনাকাটার পরিমাণ"
        />

        {chartData.every((item) => item.amount === 0) ? (
          <EmptyState message="এখনো কোনো দৈনিক ক্রয়ের তথ্য নেই।" />
        ) : (
          <div className="pt-4">
            <div className="flex h-52 items-end justify-between gap-2 sm:gap-4">
              {chartData.map((item) => {
                const height =
                  item.amount > 0
                    ? Math.max(
                        5,
                        (item.amount / maxChartAmount) * 100
                      )
                    : 0;

                return (
                  <div
                    key={item.date}
                    className="flex h-full min-w-0 flex-1 flex-col items-center justify-end gap-2"
                  >
                    <div className="text-center">
                      {item.amount > 0 && (
                        <span className="block truncate text-[10px] font-semibold text-gray-500 sm:text-xs">
                          {money(item.amount)}
                        </span>
                      )}
                    </div>

                    <div className="flex h-36 w-full items-end justify-center">
                      <div
                        title={`${formatDate(item.date)}: ${money(item.amount)}`}
                        className="w-full max-w-12 rounded-t-lg bg-emerald-500 transition-all duration-500 hover:bg-emerald-600"
                        style={{ height: `${height}%` }}
                      />
                    </div>

                    <span className="text-xs font-medium text-gray-500 dark:text-gray-400">
                      {item.weekday}
                    </span>
                  </div>
                );
              })}
            </div>
          </div>
        )}
      </section>

      {/* Business Calculation */}

      <section className="rounded-2xl border border-gray-100 bg-white p-5 shadow-sm dark:border-gray-800 dark:bg-gray-900 sm:p-6">
        <SectionTitle
          title="আড়তের হিসাবের নিয়ম"
          subtitle="বর্তমান Settings অনুযায়ী"
        />

        <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
          <div className="flex items-center gap-3 rounded-xl bg-gray-50 p-4 dark:bg-gray-800">
            <div className="rounded-lg bg-emerald-100 p-2 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-400">
              <Percent size={20} />
            </div>

            <div>
              <p className="text-xs text-gray-500 dark:text-gray-400">
                Seller Commission
              </p>
              <p className="text-lg font-bold text-gray-900 dark:text-white">
                {commissionRate}%
              </p>
            </div>
          </div>

          <div className="flex items-center gap-3 rounded-xl bg-gray-50 p-4 dark:bg-gray-800">
            <div className="rounded-lg bg-purple-100 p-2 text-purple-700 dark:bg-purple-950 dark:text-purple-400">
              <Receipt size={20} />
            </div>

            <div>
              <p className="text-xs text-gray-500 dark:text-gray-400">
                Seller Slip Charge
              </p>
              <p className="text-lg font-bold text-gray-900 dark:text-white">
                {money(slipCost)}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-3 rounded-xl bg-gray-50 p-4 dark:bg-gray-800">
            <div className="rounded-lg bg-blue-100 p-2 text-blue-700 dark:bg-blue-950 dark:text-blue-400">
              <Percent size={20} />
            </div>

            <div>
              <p className="text-xs text-gray-500 dark:text-gray-400">
                Buyer Monthly Discount
              </p>
              <p className="text-lg font-bold text-gray-900 dark:text-white">
                {discountRate}%
              </p>
            </div>
          </div>
        </div>

        <div className="mt-4 rounded-xl border border-emerald-100 bg-emerald-50/70 p-4 dark:border-emerald-900 dark:bg-emerald-950/20">
          <p className="mb-2 text-sm font-bold text-emerald-800 dark:text-emerald-300">
            Seller হিসাবের উদাহরণ
          </p>

          <div className="flex flex-wrap items-center gap-2 text-sm text-gray-700 dark:text-gray-300">
            <span>মোট বিক্রি ৳৬,০০০</span>
            <ArrowRight size={15} />
            <span>কমিশন ৳৬০০</span>
            <span>+</span>
            <span>Slip ৳৫</span>
            <span>=</span>
            <strong className="text-emerald-700 dark:text-emerald-400">
              Seller পাবে ৳৫,৩৯৫
            </strong>
          </div>
        </div>
      </section>

      {/* Recent Transactions */}

      <section className="rounded-2xl border border-gray-100 bg-white p-5 shadow-sm dark:border-gray-800 dark:bg-gray-900 sm:p-6">
        <SectionTitle
          title="সাম্প্রতিক Buyer Entry"
          subtitle="সর্বশেষ ৮টি Posted Entry"
          action={
            <button
              type="button"
              onClick={() => navigate("/purchases")}
              className="flex items-center gap-1 text-sm font-semibold text-emerald-600 hover:text-emerald-700"
            >
              সব দেখুন
              <ArrowRight size={16} />
            </button>
          }
        />

        {data.recentSlips.length === 0 ? (
          <EmptyState message="এখনো কোনো Posted Entry পাওয়া যায়নি।" />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[620px] text-left text-sm">
              <thead>
                <tr className="border-b border-gray-100 text-xs text-gray-500 dark:border-gray-800 dark:text-gray-400">
                  <th className="px-3 py-3 font-semibold">Entry No.</th>
                  <th className="px-3 py-3 font-semibold">Buyer</th>
                  <th className="px-3 py-3 font-semibold">Date</th>
                  <th className="px-3 py-3 text-right font-semibold">
                    Amount
                  </th>
                  <th className="px-3 py-3 text-center font-semibold">
                    Status
                  </th>
                </tr>
              </thead>

              <tbody>
                {data.recentSlips.map((slip) => (
                  <tr
                    key={slip.entry_id}
                    className="border-b border-gray-50 last:border-0 dark:border-gray-800"
                  >
                    <td className="px-3 py-4 font-semibold text-emerald-700 dark:text-emerald-400">
                      {slip.entry_no}
                    </td>

                    <td className="px-3 py-4">
                      <p className="font-semibold text-gray-800 dark:text-gray-200">
                        {slip.buyer_name}
                      </p>
                      <p className="mt-1 text-xs text-gray-500">
                        {slip.buyer_code}
                      </p>
                    </td>

                    <td className="px-3 py-4 text-gray-500 dark:text-gray-400">
                      {formatDate(slip.entry_date)}
                    </td>

                    <td className="px-3 py-4 text-right font-bold text-gray-900 dark:text-white">
                      {money(slip.total_amount)}
                    </td>

                    <td className="px-3 py-4 text-center">
                      <span className="inline-flex items-center gap-1 rounded-full bg-emerald-50 px-3 py-1 text-xs font-semibold text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-400">
                        <CheckCircle2 size={13} />
                        Posted
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      {/* Quick Actions */}

      <section>
        <SectionTitle
          title="দ্রুত কাজ"
          subtitle="প্রয়োজনীয় পেজে সরাসরি যান"
        />

        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 xl:grid-cols-4">
          {[
            {
              label: "নতুন Buyer Entry",
              icon: ShoppingCart,
              path: "/purchases",
              color: "text-blue-600 bg-blue-50 dark:bg-blue-950/40",
            },
            {
              label: "Buyer Management",
              icon: Users,
              path: "/buyers",
              color: "text-emerald-600 bg-emerald-50 dark:bg-emerald-950/40",
            },
            {
              label: "Seller Management",
              icon: Truck,
              path: "/sellers",
              color: "text-purple-600 bg-purple-50 dark:bg-purple-950/40",
            },
            {
              label: "Payment Management",
              icon: CreditCard,
              path: "/payments",
              color: "text-orange-600 bg-orange-50 dark:bg-orange-950/40",
            },
            {
              label: "Ledger",
              icon: Activity,
              path: "/ledger",
              color: "text-cyan-600 bg-cyan-50 dark:bg-cyan-950/40",
            },
            {
              label: "Reports",
              icon: Receipt,
              path: "/reports",
              color: "text-pink-600 bg-pink-50 dark:bg-pink-950/40",
            },
            {
              label: "Discount",
              icon: Percent,
              path: "/profit-sharing",
              color: "text-amber-600 bg-amber-50 dark:bg-amber-950/40",
            },
            {
              label: "Daily Closing",
              icon: Clock,
              path: "/daily-closing",
              color: "text-indigo-600 bg-indigo-50 dark:bg-indigo-950/40",
            },
          ].map((item) => {
            const Icon = item.icon;

            return (
              <button
                key={item.path}
                type="button"
                onClick={() => navigate(item.path)}
                className="flex items-center gap-3 rounded-xl border border-gray-100 bg-white p-4 text-left transition hover:-translate-y-0.5 hover:shadow-md dark:border-gray-800 dark:bg-gray-900"
              >
                <div className={`rounded-lg p-2 ${item.color}`}>
                  <Icon size={19} />
                </div>

                <span className="text-sm font-semibold text-gray-700 dark:text-gray-200">
                  {item.label}
                </span>
              </button>
            );
          })}
        </div>
      </section>
    </div>
  );
}
