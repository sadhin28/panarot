
import { useCallback, useEffect, useMemo, useState, type FormEvent } from "react";
import {
  Plus,
  Search,
  RefreshCw,
  Truck,
  Wallet,
  TrendingUp,
  CheckCircle2,
  XCircle,
  Edit,
  Eye,
  X,
  Phone,
  MapPin,
  CalendarDays,
  Receipt,
  Printer,
  AlertCircle,
  UserRound,
  ArrowDownLeft,
  Percent,
} from "lucide-react";

import { supabase } from "../lib/supabase";
import { useAuth } from "../contexts/AuthContext";

// --------------------------------------------------
// Types
// --------------------------------------------------

interface Seller {
  id: string;
  seller_code: string;
  name: string;
  phone: string | null;
  address: string | null;
  opening_balance: number;
  notes: string | null;
  is_active: boolean;
  created_at: string;
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

interface SellerSlip {
  entry_line_id: string;
  seller_slip_no: string;
  entry_no: string;
  entry_date: string;
  status: string;
  buyer_code: string;
  buyer_name: string;
  seller_id: string;
  seller_code: string;
  seller_name: string;
  quantity: number;
  rate: number;
  gross_amount: number;
  commission_percent: number;
  commission_amount: number;
  slip_cost: number;
  seller_net_amount: number;
}

interface SellerForm {
  name: string;
  phone: string;
  address: string;
  opening_balance: string;
  notes: string;
}

const emptyForm: SellerForm = {
  name: "",
  phone: "",
  address: "",
  opening_balance: "0",
  notes: "",
};

// --------------------------------------------------
// Helpers
// --------------------------------------------------

const numeric = (value: number | string | null | undefined) => {
  const result = Number(value ?? 0);
  return Number.isFinite(result) ? result : 0;
};

const money = (value: number | string | null | undefined) => {
  return `৳${new Intl.NumberFormat("en-IN", {
    maximumFractionDigits: 2,
  }).format(numeric(value))}`;
};

const formatDate = (dateString: string) => {
  if (!dateString) return "—";

  return new Intl.DateTimeFormat("bn-BD", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    timeZone: "Asia/Dhaka",
  }).format(new Date(`${dateString.slice(0, 10)}T12:00:00+06:00`));
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

  return "কাজটি সম্পন্ন করা যায়নি। আবার চেষ্টা করুন।";
};

const escapeHtml = (value: unknown) => {
  return String(value ?? "").replace(/[&<>"']/g, (character) => {
    const entities: Record<string, string> = {
      "&": "&amp;",
      "<": "&lt;",
      ">": "&gt;",
      '"': "&quot;",
      "'": "&#039;",
    };

    return entities[character];
  });
};

// --------------------------------------------------
// Reusable components
// --------------------------------------------------

function StatCard({
  title,
  value,
  subtitle,
  icon: Icon,
  iconClass,
}: {
  title: string;
  value: string;
  subtitle: string;
  icon: React.ElementType;
  iconClass: string;
}) {
  return (
    <div className="rounded-2xl border border-gray-100 bg-white p-5 shadow-sm dark:border-gray-800 dark:bg-gray-900">
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
    </div>
  );
}

function SectionTitle({
  title,
  subtitle,
  action,
}: {
  title: string;
  subtitle?: string;
  action?: React.ReactNode;
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

// --------------------------------------------------
// Main Sellers Page
// --------------------------------------------------

export default function Sellers() {
  const { user } = useAuth();

  const [sellers, setSellers] = useState<Seller[]>([]);
  const [ledgers, setLedgers] = useState<SellerLedger[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<
    "all" | "active" | "inactive"
  >("all");

  const [formOpen, setFormOpen] = useState(false);
  const [editingSeller, setEditingSeller] = useState<Seller | null>(null);
  const [form, setForm] = useState<SellerForm>(emptyForm);
  const [saving, setSaving] = useState(false);

  const [selectedSeller, setSelectedSeller] = useState<Seller | null>(null);
  const [sellerSlips, setSellerSlips] = useState<SellerSlip[]>([]);
  const [detailsLoading, setDetailsLoading] = useState(false);

  // ------------------------------------------------
  // Load sellers and ledger data
  // ------------------------------------------------

  const loadData = useCallback(async (refresh = false) => {
    if (refresh) {
      setRefreshing(true);
    } else {
      setLoading(true);
    }

    setError("");

    try {
      const [sellerResult, ledgerResult] = await Promise.all([
        supabase
          .from("sellers")
          .select("*")
          .order("created_at", { ascending: false }),

        supabase
          .from("seller_ledger_summary")
          .select("*"),
      ]);

      if (sellerResult.error) throw sellerResult.error;
      if (ledgerResult.error) throw ledgerResult.error;

      setSellers((sellerResult.data ?? []) as Seller[]);
      setLedgers((ledgerResult.data ?? []) as SellerLedger[]);
    } catch (err) {
      console.error("Seller loading error:", err);
      setError(getErrorMessage(err));
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    void loadData();

    const handleFocus = () => {
      void loadData(true);
    };

    window.addEventListener("focus", handleFocus);

    return () => {
      window.removeEventListener("focus", handleFocus);
    };
  }, [loadData]);

  // ------------------------------------------------
  // Ledger lookup
  // ------------------------------------------------

  const getLedger = (sellerId: string) => {
    return ledgers.find((item) => item.seller_id === sellerId);
  };

  // ------------------------------------------------
  // Statistics
  // ------------------------------------------------

  const statistics = useMemo(() => {
    const activeSellers = sellers.filter((seller) => seller.is_active);

    const totalGross = ledgers.reduce(
      (sum, item) => sum + numeric(item.total_gross),
      0
    );

    const totalCommission = ledgers.reduce(
      (sum, item) => sum + numeric(item.total_commission),
      0
    );

    const totalPayable = ledgers.reduce(
      (sum, item) => sum + numeric(item.total_payable),
      0
    );

    const totalPaid = ledgers.reduce(
      (sum, item) => sum + numeric(item.total_paid),
      0
    );

    const totalDue = ledgers.reduce(
      (sum, item) => sum + Math.max(0, numeric(item.current_due)),
      0
    );

    return {
      activeCount: activeSellers.length,
      totalCount: sellers.length,
      totalGross,
      totalCommission,
      totalPayable,
      totalPaid,
      totalDue,
    };
  }, [sellers, ledgers]);

  // ------------------------------------------------
  // Filter sellers
  // ------------------------------------------------

  const filteredSellers = useMemo(() => {
    const keyword = search.trim().toLowerCase();

    return sellers.filter((seller) => {
      const matchesSearch =
        !keyword ||
        seller.name.toLowerCase().includes(keyword) ||
        seller.seller_code.toLowerCase().includes(keyword) ||
        (seller.phone ?? "").toLowerCase().includes(keyword);

      const matchesStatus =
        statusFilter === "all" ||
        (statusFilter === "active" && seller.is_active) ||
        (statusFilter === "inactive" && !seller.is_active);

      return matchesSearch && matchesStatus;
    });
  }, [sellers, search, statusFilter]);

  // ------------------------------------------------
  // Open create modal
  // ------------------------------------------------

  const openCreateForm = () => {
    setEditingSeller(null);
    setForm(emptyForm);
    setError("");
    setSuccess("");
    setFormOpen(true);
  };

  // ------------------------------------------------
  // Open edit modal
  // ------------------------------------------------

  const openEditForm = (seller: Seller) => {
    setEditingSeller(seller);

    setForm({
      name: seller.name,
      phone: seller.phone ?? "",
      address: seller.address ?? "",
      opening_balance: String(seller.opening_balance ?? 0),
      notes: seller.notes ?? "",
    });

    setError("");
    setSuccess("");
    setFormOpen(true);
  };

  // ------------------------------------------------
  // Save seller
  // ------------------------------------------------

  const handleSaveSeller = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();

    if (!form.name.trim()) {
      setError("Seller-এর নাম লিখুন।");
      return;
    }

    const openingBalance = Number(form.opening_balance || 0);

    if (!Number.isFinite(openingBalance) || openingBalance < 0) {
      setError("সঠিক Opening Balance লিখুন।");
      return;
    }

    setSaving(true);
    setError("");

    try {
      const payload = {
        name: form.name.trim(),
        phone: form.phone.trim() || null,
        address: form.address.trim() || null,
        opening_balance: openingBalance,
        notes: form.notes.trim() || null,
      };

      if (editingSeller) {
        const { error: updateError } = await supabase
          .from("sellers")
          .update(payload)
          .eq("id", editingSeller.id);

        if (updateError) throw updateError;

        setSuccess("Seller-এর তথ্য সফলভাবে আপডেট হয়েছে।");
      } else {
        const { error: insertError } = await supabase
          .from("sellers")
          .insert({
            ...payload,
            created_by: user?.id ?? null,
          });

        if (insertError) throw insertError;

        setSuccess("নতুন Seller সফলভাবে তৈরি হয়েছে।");
      }

      setFormOpen(false);
      setEditingSeller(null);
      setForm(emptyForm);

      await loadData(true);
    } catch (err) {
      console.error("Seller save error:", err);
      setError(getErrorMessage(err));
    } finally {
      setSaving(false);
    }
  };

  // ------------------------------------------------
  // Activate / Deactivate seller
  // ------------------------------------------------

  const toggleSellerStatus = async (seller: Seller) => {
    const action = seller.is_active ? "বন্ধ" : "চালু";

    if (!window.confirm(
      `${seller.name}-এর অ্যাকাউন্ট ${action} করতে চান?`
    )) {
      return;
    }

    setError("");
    setSuccess("");

    try {
      const { error: updateError } = await supabase
        .from("sellers")
        .update({ is_active: !seller.is_active })
        .eq("id", seller.id);

      if (updateError) throw updateError;

      setSuccess(
        seller.is_active
          ? "Seller অ্যাকাউন্ট নিষ্ক্রিয় করা হয়েছে।"
          : "Seller অ্যাকাউন্ট সক্রিয় করা হয়েছে।"
      );

      await loadData(true);
    } catch (err) {
      setError(getErrorMessage(err));
    }
  };

  // ------------------------------------------------
  // Seller details and individual slips
  // ------------------------------------------------

  const openSellerDetails = async (seller: Seller) => {
    setSelectedSeller(seller);
    setSellerSlips([]);
    setDetailsLoading(true);
    setError("");

    try {
      const { data, error: slipError } = await supabase
        .from("seller_individual_slips")
        .select("*")
        .eq("seller_id", seller.id)
        .order("entry_date", { ascending: false });

      if (slipError) throw slipError;

      setSellerSlips((data ?? []) as SellerSlip[]);
    } catch (err) {
      console.error("Seller details error:", err);
      setError(getErrorMessage(err));
    } finally {
      setDetailsLoading(false);
    }
  };

  // ------------------------------------------------
  // Print individual seller slips
  // ------------------------------------------------

  const printSellerSlips = () => {
    if (!selectedSeller) return;

    const ledger = getLedger(selectedSeller.id);

    const rows = sellerSlips
      .map(
        (slip) => `
          <tr>
            <td>${escapeHtml(slip.seller_slip_no)}</td>
            <td>${escapeHtml(slip.entry_no)}</td>
            <td>${escapeHtml(formatDate(slip.entry_date))}</td>
            <td>${escapeHtml(slip.buyer_name)}</td>
            <td>${numeric(slip.quantity)}</td>
            <td>৳${numeric(slip.rate).toLocaleString("en-IN")}</td>
            <td>৳${numeric(slip.gross_amount).toLocaleString("en-IN")}</td>
            <td>৳${numeric(slip.commission_amount).toLocaleString("en-IN")}</td>
            <td>৳${numeric(slip.slip_cost).toLocaleString("en-IN")}</td>
            <td>৳${numeric(slip.seller_net_amount).toLocaleString("en-IN")}</td>
          </tr>
        `
      )
      .join("");

    const printWindow = window.open("", "_blank");

    if (!printWindow) {
      setError("Print window খোলা যায়নি। Browser popup allow করুন।");
      return;
    }

    printWindow.document.write(`
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="UTF-8" />
        <title>Seller Statement - ${escapeHtml(selectedSeller.name)}</title>
        <style>
          body { font-family: Arial, sans-serif; padding: 25px; color: #222; }
          h1, h2, p { margin: 5px 0; }
          .header { text-align: center; margin-bottom: 25px; }
          .summary { display: flex; flex-wrap: wrap; gap: 15px; margin: 20px 0; }
          .summary div { border: 1px solid #ddd; padding: 12px; flex: 1; min-width: 120px; }
          table { width: 100%; border-collapse: collapse; margin-top: 20px; }
          th, td { border: 1px solid #ddd; padding: 8px; font-size: 11px; text-align: left; }
          th { background: #ecfdf5; }
          .footer { margin-top: 35px; text-align: right; }
          @media print { button { display: none; } }
        </style>
      </head>
      <body>
        <div class="header">
          <h1>Pan Arot Pro</h1>
          <h2>Seller Statement</h2>
          <p>${escapeHtml(selectedSeller.name)} (${escapeHtml(selectedSeller.seller_code)})</p>
          <p>${escapeHtml(selectedSeller.phone ?? "")}</p>
        </div>

        <div class="summary">
          <div><strong>মোট বিক্রি</strong><p>৳${numeric(ledger?.total_gross).toLocaleString("en-IN")}</p></div>
          <div><strong>কমিশন</strong><p>৳${numeric(ledger?.total_commission).toLocaleString("en-IN")}</p></div>
          <div><strong>মোট পাওনা</strong><p>৳${numeric(ledger?.total_payable).toLocaleString("en-IN")}</p></div>
          <div><strong>পরিশোধ</strong><p>৳${numeric(ledger?.total_paid).toLocaleString("en-IN")}</p></div>
          <div><strong>বর্তমান বাকি</strong><p>৳${numeric(ledger?.current_due).toLocaleString("en-IN")}</p></div>
        </div>

        <h3>Seller Transaction History</h3>

        <table>
          <thead>
            <tr>
              <th>Slip No.</th>
              <th>Entry No.</th>
              <th>Date</th>
              <th>Buyer</th>
              <th>Quantity</th>
              <th>Rate</th>
              <th>Gross</th>
              <th>Commission</th>
              <th>Slip Cost</th>
              <th>Net Payable</th>
            </tr>
          </thead>
          <tbody>${rows}</tbody>
        </table>

        <div class="footer">
          <p>Printed: ${escapeHtml(new Date().toLocaleString())}</p>
          <br/><br/>
          <p>________________________</p>
          <p>Authorized Signature</p>
        </div>

        <script>
          window.onload = function() {
            window.print();
          };
        </script>
      </body>
      </html>
    `);

    printWindow.document.close();
  };

  // ------------------------------------------------
  // Loading screen
  // ------------------------------------------------

  if (loading) {
    return (
      <div className="space-y-6">
        <div className="h-24 animate-pulse rounded-2xl bg-gray-100 dark:bg-gray-800" />

        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-3">
          {Array.from({ length: 6 }).map((_, index) => (
            <div
              key={index}
              className="h-32 animate-pulse rounded-2xl bg-gray-100 dark:bg-gray-800"
            />
          ))}
        </div>
      </div>
    );
  }

  // ------------------------------------------------
  // Main UI
  // ------------------------------------------------

  return (
    <div className="space-y-6 pb-8">

      {/* Header */}

      <div className="relative overflow-hidden rounded-2xl bg-gradient-to-r from-emerald-700 to-green-600 p-6 text-white shadow-lg sm:p-8">
        <div className="relative z-10 flex flex-wrap items-center justify-between gap-4">
          <div>
            <div className="mb-3 flex items-center gap-2 text-sm text-emerald-100">
              <Truck size={17} />
              <span>Pan Arot Pro</span>
            </div>

            <h1 className="text-2xl font-bold sm:text-3xl">
              Seller Management
            </h1>

            <p className="mt-2 text-sm text-emerald-100">
              সকল Seller-এর অ্যাকাউন্ট, বিক্রি ও পাওনার হিসাব পরিচালনা করুন।
            </p>
          </div>

          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              onClick={() => void loadData(true)}
              disabled={refreshing}
              className="flex items-center gap-2 rounded-xl border border-white/30 bg-white/10 px-4 py-3 text-sm font-semibold hover:bg-white/20 disabled:opacity-60"
            >
              <RefreshCw
                size={16}
                className={refreshing ? "animate-spin" : ""}
              />
              Refresh
            </button>

            <button
              type="button"
              onClick={openCreateForm}
              className="flex items-center gap-2 rounded-xl bg-white px-4 py-3 text-sm font-bold text-emerald-800 shadow-sm hover:bg-emerald-50"
            >
              <Plus size={18} />
              নতুন Seller
            </button>
          </div>
        </div>

        <div className="pointer-events-none absolute -right-10 -top-20 h-64 w-64 rounded-full border-[35px] border-white/10" />
      </div>

      {/* Alerts */}

      {error && (
        <div className="flex items-start gap-3 rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-700 dark:border-red-900 dark:bg-red-950/30 dark:text-red-300">
          <AlertCircle size={18} className="mt-0.5 shrink-0" />
          <span className="flex-1 break-words">{error}</span>
          <button type="button" onClick={() => setError("")}>
            <X size={17} />
          </button>
        </div>
      )}

      {success && (
        <div className="flex items-center gap-3 rounded-xl border border-emerald-200 bg-emerald-50 p-4 text-sm text-emerald-700 dark:border-emerald-900 dark:bg-emerald-950/30 dark:text-emerald-300">
          <CheckCircle2 size={18} />
          <span className="flex-1">{success}</span>
          <button type="button" onClick={() => setSuccess("")}>
            <X size={17} />
          </button>
        </div>
      )}

      {/* Statistics */}

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-3">
        <StatCard
          title="Active Sellers"
          value={String(statistics.activeCount)}
          subtitle={`মোট ${statistics.totalCount} জন Seller`}
          icon={Truck}
          iconClass="bg-emerald-50 text-emerald-600 dark:bg-emerald-950/40 dark:text-emerald-400"
        />

        <StatCard
          title="মোট পান বিক্রি"
          value={money(statistics.totalGross)}
          subtitle="সকল Seller-এর Gross Amount"
          icon={TrendingUp}
          iconClass="bg-blue-50 text-blue-600 dark:bg-blue-950/40 dark:text-blue-400"
        />

        <StatCard
          title="মোট কমিশন"
          value={money(statistics.totalCommission)}
          subtitle="আড়তের অর্জিত কমিশন"
          icon={Percent}
          iconClass="bg-purple-50 text-purple-600 dark:bg-purple-950/40 dark:text-purple-400"
        />

        <StatCard
          title="Seller-কে মোট পাওনা"
          value={money(statistics.totalPayable)}
          subtitle="কমিশন ও Slip Cost বাদ দেওয়ার পর"
          icon={Wallet}
          iconClass="bg-orange-50 text-orange-600 dark:bg-orange-950/40 dark:text-orange-400"
        />

        <StatCard
          title="Seller-কে পরিশোধ"
          value={money(statistics.totalPaid)}
          subtitle="সর্বমোট পরিশোধিত টাকা"
          icon={CheckCircle2}
          iconClass="bg-blue-50 text-blue-600 dark:bg-blue-950/40 dark:text-blue-400"
        />

        <StatCard
          title="Seller-এর বর্তমান বাকি"
          value={money(statistics.totalDue)}
          subtitle="সকল Seller-এর পজিটিভ বকেয়া"
          icon={ArrowDownLeft}
          iconClass="bg-red-50 text-red-600 dark:bg-red-950/40 dark:text-red-400"
        />
      </div>

      {/* Seller List */}

      <section className="rounded-2xl border border-gray-100 bg-white p-5 shadow-sm dark:border-gray-800 dark:bg-gray-900 sm:p-6">
        <SectionTitle
          title="সকল Seller"
          subtitle="Seller-এর তথ্য ও ব্যক্তিগত হিসাব"
          action={
            <span className="rounded-lg bg-emerald-50 px-3 py-2 text-xs font-semibold text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-400">
              {filteredSellers.length} জন পাওয়া গেছে
            </span>
          }
        />

        {/* Search and filters */}

        <div className="mb-5 flex flex-col gap-3 sm:flex-row">
          <div className="relative flex-1">
            <Search
              size={18}
              className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400"
            />

            <input
              type="text"
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              placeholder="নাম, Seller ID অথবা ফোন দিয়ে খুঁজুন..."
              className="w-full rounded-xl border border-gray-200 bg-white py-3 pl-10 pr-4 text-sm text-gray-800 outline-none transition focus:border-emerald-500 focus:ring-2 focus:ring-emerald-100 dark:border-gray-700 dark:bg-gray-800 dark:text-white dark:focus:ring-emerald-950"
            />
          </div>

          <select
            value={statusFilter}
            onChange={(event) =>
              setStatusFilter(
                event.target.value as "all" | "active" | "inactive"
              )
            }
            className="rounded-xl border border-gray-200 bg-white px-4 py-3 text-sm text-gray-700 outline-none focus:border-emerald-500 dark:border-gray-700 dark:bg-gray-800 dark:text-white"
          >
            <option value="all">সকল Seller</option>
            <option value="active">শুধু Active</option>
            <option value="inactive">শুধু Inactive</option>
          </select>
        </div>

        {/* Table */}

        {filteredSellers.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-14 text-center">
            <Truck size={38} className="mb-3 text-gray-300" />

            <h3 className="font-semibold text-gray-700 dark:text-gray-200">
              কোনো Seller পাওয়া যায়নি
            </h3>

            <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
              নতুন Seller তৈরি করুন অথবা Search পরিবর্তন করুন।
            </p>

            <button
              type="button"
              onClick={openCreateForm}
              className="mt-4 flex items-center gap-2 rounded-xl bg-emerald-600 px-4 py-2.5 text-sm font-semibold text-white hover:bg-emerald-700"
            >
              <Plus size={17} />
              নতুন Seller তৈরি করুন
            </button>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[950px] text-left text-sm">
              <thead>
                <tr className="border-b border-gray-100 text-xs text-gray-500 dark:border-gray-800 dark:text-gray-400">
                  <th className="px-3 py-3 font-semibold">Seller</th>
                  <th className="px-3 py-3 font-semibold">Phone</th>
                  <th className="px-3 py-3 text-right font-semibold">
                    মোট বিক্রি
                  </th>
                  <th className="px-3 py-3 text-right font-semibold">
                    মোট কমিশন
                  </th>
                  <th className="px-3 py-3 text-right font-semibold">
                    পরিশোধ
                  </th>
                  <th className="px-3 py-3 text-right font-semibold">
                    বর্তমান বাকি
                  </th>
                  <th className="px-3 py-3 text-center font-semibold">
                    Status
                  </th>
                  <th className="px-3 py-3 text-center font-semibold">
                    Action
                  </th>
                </tr>
              </thead>

              <tbody>
                {filteredSellers.map((seller) => {
                  const ledger = getLedger(seller.id);

                  return (
                    <tr
                      key={seller.id}
                      className="border-b border-gray-50 last:border-0 hover:bg-gray-50/70 dark:border-gray-800 dark:hover:bg-gray-800/40"
                    >
                      <td className="px-3 py-4">
                        <div className="flex items-center gap-3">
                          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-emerald-50 text-emerald-600 dark:bg-emerald-950/40 dark:text-emerald-400">
                            <UserRound size={20} />
                          </div>

                          <div>
                            <p className="font-bold text-gray-800 dark:text-gray-100">
                              {seller.name}
                            </p>

                            <p className="mt-1 text-xs font-medium text-emerald-600 dark:text-emerald-400">
                              {seller.seller_code}
                            </p>
                          </div>
                        </div>
                      </td>

                      <td className="px-3 py-4 text-gray-600 dark:text-gray-300">
                        {seller.phone || "—"}
                      </td>

                      <td className="px-3 py-4 text-right font-semibold text-gray-800 dark:text-gray-200">
                        {money(ledger?.total_gross)}
                      </td>

                      <td className="px-3 py-4 text-right text-purple-600 dark:text-purple-400">
                        {money(ledger?.total_commission)}
                      </td>

                      <td className="px-3 py-4 text-right text-blue-600 dark:text-blue-400">
                        {money(ledger?.total_paid)}
                      </td>

                      <td className="px-3 py-4 text-right font-bold text-red-600 dark:text-red-400">
                        {money(ledger?.current_due)}
                      </td>

                      <td className="px-3 py-4 text-center">
                        {seller.is_active ? (
                          <span className="inline-flex items-center gap-1 rounded-full bg-emerald-50 px-3 py-1 text-xs font-semibold text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-400">
                            <CheckCircle2 size={13} />
                            Active
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1 rounded-full bg-gray-100 px-3 py-1 text-xs font-semibold text-gray-600 dark:bg-gray-800 dark:text-gray-400">
                            <XCircle size={13} />
                            Inactive
                          </span>
                        )}
                      </td>

                      <td className="px-3 py-4">
                        <div className="flex items-center justify-center gap-1">
                          <button
                            type="button"
                            title="Details"
                            onClick={() => void openSellerDetails(seller)}
                            className="rounded-lg p-2 text-blue-600 transition hover:bg-blue-50 dark:hover:bg-blue-950/40"
                          >
                            <Eye size={17} />
                          </button>

                          <button
                            type="button"
                            title="Edit"
                            onClick={() => openEditForm(seller)}
                            className="rounded-lg p-2 text-emerald-600 transition hover:bg-emerald-50 dark:hover:bg-emerald-950/40"
                          >
                            <Edit size={17} />
                          </button>

                          <button
                            type="button"
                            title={seller.is_active ? "Deactivate" : "Activate"}
                            onClick={() => void toggleSellerStatus(seller)}
                            className="rounded-lg p-2 text-gray-500 transition hover:bg-gray-100 dark:hover:bg-gray-800"
                          >
                            {seller.is_active ? (
                              <XCircle size={17} />
                            ) : (
                              <CheckCircle2 size={17} />
                            )}
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </section>

      {/* Create / Edit Seller Modal */}

      {formOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center overflow-y-auto bg-black/50 p-4">
          <div className="my-auto w-full max-w-xl rounded-2xl bg-white shadow-2xl dark:bg-gray-900">
            <div className="flex items-center justify-between border-b border-gray-100 p-5 dark:border-gray-800">
              <div>
                <h2 className="text-lg font-bold text-gray-900 dark:text-white">
                  {editingSeller ? "Seller Edit করুন" : "নতুন Seller তৈরি করুন"}
                </h2>

                <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">
                  Seller-এর প্রয়োজনীয় তথ্য দিন।
                </p>
              </div>

              <button
                type="button"
                onClick={() => setFormOpen(false)}
                className="rounded-lg p-2 text-gray-500 hover:bg-gray-100 dark:hover:bg-gray-800"
              >
                <X size={20} />
              </button>
            </div>

            <form onSubmit={handleSaveSeller} className="space-y-4 p-5">
              {error && (
                <div className="rounded-lg bg-red-50 p-3 text-sm text-red-600 dark:bg-red-950/30 dark:text-red-300">
                  {error}
                </div>
              )}

              <div>
                <label className="mb-2 block text-sm font-semibold text-gray-700 dark:text-gray-300">
                  Seller-এর নাম *
                </label>

                <input
                  type="text"
                  required
                  value={form.name}
                  onChange={(event) =>
                    setForm({ ...form, name: event.target.value })
                  }
                  placeholder="যেমন: করিম মিয়া"
                  className="w-full rounded-xl border border-gray-200 bg-white px-4 py-3 text-sm outline-none focus:border-emerald-500 focus:ring-2 focus:ring-emerald-100 dark:border-gray-700 dark:bg-gray-800 dark:text-white dark:focus:ring-emerald-950"
                />
              </div>

              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                <div>
                  <label className="mb-2 block text-sm font-semibold text-gray-700 dark:text-gray-300">
                    ফোন নম্বর
                  </label>

                  <input
                    type="tel"
                    value={form.phone}
                    onChange={(event) =>
                      setForm({ ...form, phone: event.target.value })
                    }
                    placeholder="01XXXXXXXXX"
                    className="w-full rounded-xl border border-gray-200 bg-white px-4 py-3 text-sm outline-none focus:border-emerald-500 dark:border-gray-700 dark:bg-gray-800 dark:text-white"
                  />
                </div>

                <div>
                  <label className="mb-2 block text-sm font-semibold text-gray-700 dark:text-gray-300">
                    Opening Balance
                  </label>

                  <input
                    type="number"
                    min="0"
                    step="0.01"
                    value={form.opening_balance}
                    onChange={(event) =>
                      setForm({
                        ...form,
                        opening_balance: event.target.value,
                      })
                    }
                    className="w-full rounded-xl border border-gray-200 bg-white px-4 py-3 text-sm outline-none focus:border-emerald-500 dark:border-gray-700 dark:bg-gray-800 dark:text-white"
                  />
                </div>
              </div>

              <div>
                <label className="mb-2 block text-sm font-semibold text-gray-700 dark:text-gray-300">
                  ঠিকানা
                </label>

                <input
                  type="text"
                  value={form.address}
                  onChange={(event) =>
                    setForm({ ...form, address: event.target.value })
                  }
                  placeholder="Seller-এর ঠিকানা"
                  className="w-full rounded-xl border border-gray-200 bg-white px-4 py-3 text-sm outline-none focus:border-emerald-500 dark:border-gray-700 dark:bg-gray-800 dark:text-white"
                />
              </div>

              <div>
                <label className="mb-2 block text-sm font-semibold text-gray-700 dark:text-gray-300">
                  Notes
                </label>

                <textarea
                  rows={3}
                  value={form.notes}
                  onChange={(event) =>
                    setForm({ ...form, notes: event.target.value })
                  }
                  placeholder="অতিরিক্ত তথ্য..."
                  className="w-full resize-none rounded-xl border border-gray-200 bg-white px-4 py-3 text-sm outline-none focus:border-emerald-500 dark:border-gray-700 dark:bg-gray-800 dark:text-white"
                />
              </div>

              {!editingSeller && (
                <p className="rounded-lg bg-emerald-50 p-3 text-xs text-emerald-700 dark:bg-emerald-950/30 dark:text-emerald-400">
                  Seller ID Database থেকে স্বয়ংক্রিয়ভাবে তৈরি হবে।
                </p>
              )}

              <div className="flex flex-col-reverse gap-3 pt-2 sm:flex-row sm:justify-end">
                <button
                  type="button"
                  onClick={() => setFormOpen(false)}
                  className="rounded-xl border border-gray-200 px-5 py-3 text-sm font-semibold text-gray-600 hover:bg-gray-50 dark:border-gray-700 dark:text-gray-300 dark:hover:bg-gray-800"
                >
                  বাতিল
                </button>

                <button
                  type="submit"
                  disabled={saving}
                  className="flex items-center justify-center gap-2 rounded-xl bg-emerald-600 px-5 py-3 text-sm font-bold text-white hover:bg-emerald-700 disabled:cursor-not-allowed disabled:opacity-60"
                >
                  {saving && (
                    <RefreshCw size={16} className="animate-spin" />
                  )}

                  {saving
                    ? "সংরক্ষণ হচ্ছে..."
                    : editingSeller
                      ? "পরিবর্তন সংরক্ষণ"
                      : "Seller তৈরি করুন"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Seller Details Modal */}

      {selectedSeller && (
        <div className="fixed inset-0 z-50 flex items-center justify-center overflow-y-auto bg-black/50 p-3 sm:p-5">
          <div className="my-auto max-h-[95vh] w-full max-w-6xl overflow-y-auto rounded-2xl bg-white shadow-2xl dark:bg-gray-900">
            <div className="sticky top-0 z-10 flex flex-wrap items-center justify-between gap-3 border-b border-gray-100 bg-white p-5 dark:border-gray-800 dark:bg-gray-900">
              <div>
                <h2 className="text-lg font-bold text-gray-900 dark:text-white">
                  {selectedSeller.name}
                </h2>

                <p className="mt-1 text-sm font-medium text-emerald-600 dark:text-emerald-400">
                  {selectedSeller.seller_code}
                </p>
              </div>

              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={printSellerSlips}
                  disabled={sellerSlips.length === 0}
                  className="flex items-center gap-2 rounded-lg bg-emerald-600 px-3 py-2 text-sm font-semibold text-white hover:bg-emerald-700 disabled:opacity-50"
                >
                  <Printer size={16} />
                  Print
                </button>

                <button
                  type="button"
                  onClick={() => setSelectedSeller(null)}
                  className="rounded-lg p-2 text-gray-500 hover:bg-gray-100 dark:hover:bg-gray-800"
                >
                  <X size={20} />
                </button>
              </div>
            </div>

            <div className="space-y-6 p-5">
              {/* Seller information */}

              <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
                <div className="flex items-center gap-3 rounded-xl bg-gray-50 p-4 dark:bg-gray-800">
                  <Phone className="text-emerald-600" size={19} />
                  <div>
                    <p className="text-xs text-gray-500">Phone</p>
                    <p className="mt-1 text-sm font-semibold text-gray-800 dark:text-white">
                      {selectedSeller.phone || "—"}
                    </p>
                  </div>
                </div>

                <div className="flex items-center gap-3 rounded-xl bg-gray-50 p-4 dark:bg-gray-800">
                  <MapPin className="text-emerald-600" size={19} />
                  <div>
                    <p className="text-xs text-gray-500">Address</p>
                    <p className="mt-1 text-sm font-semibold text-gray-800 dark:text-white">
                      {selectedSeller.address || "—"}
                    </p>
                  </div>
                </div>

                <div className="flex items-center gap-3 rounded-xl bg-gray-50 p-4 dark:bg-gray-800">
                  <CalendarDays className="text-emerald-600" size={19} />
                  <div>
                    <p className="text-xs text-gray-500">Created At</p>
                    <p className="mt-1 text-sm font-semibold text-gray-800 dark:text-white">
                      {formatDate(selectedSeller.created_at)}
                    </p>
                  </div>
                </div>
              </div>

              {/* Seller balance cards */}

              {(() => {
                const ledger = getLedger(selectedSeller.id);

                return (
                  <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-4">
                    <div className="rounded-xl bg-blue-50 p-4 dark:bg-blue-950/30">
                      <p className="text-xs text-blue-700 dark:text-blue-400">
                        মোট Gross বিক্রি
                      </p>
                      <p className="mt-2 text-xl font-bold text-blue-800 dark:text-blue-300">
                        {money(ledger?.total_gross)}
                      </p>
                    </div>

                    <div className="rounded-xl bg-purple-50 p-4 dark:bg-purple-950/30">
                      <p className="text-xs text-purple-700 dark:text-purple-400">
                        মোট কমিশন
                      </p>
                      <p className="mt-2 text-xl font-bold text-purple-800 dark:text-purple-300">
                        {money(ledger?.total_commission)}
                      </p>
                    </div>

                    <div className="rounded-xl bg-emerald-50 p-4 dark:bg-emerald-950/30">
                      <p className="text-xs text-emerald-700 dark:text-emerald-400">
                        মোট পরিশোধ
                      </p>
                      <p className="mt-2 text-xl font-bold text-emerald-800 dark:text-emerald-300">
                        {money(ledger?.total_paid)}
                      </p>
                    </div>

                    <div className="rounded-xl bg-red-50 p-4 dark:bg-red-950/30">
                      <p className="text-xs text-red-700 dark:text-red-400">
                        বর্তমান বাকি
                      </p>
                      <p className="mt-2 text-xl font-bold text-red-800 dark:text-red-300">
                        {money(ledger?.current_due)}
                      </p>
                    </div>
                  </div>
                );
              })()}

              {/* Transaction history */}

              <section>
                <SectionTitle
                  title="Seller Transaction History"
                  subtitle="এই Seller-এর সব Individual Slip"
                  action={
                    <span className="text-xs text-gray-500 dark:text-gray-400">
                      {sellerSlips.length} টি Slip
                    </span>
                  }
                />

                {detailsLoading ? (
                  <div className="py-12 text-center text-sm text-gray-500">
                    Transaction History লোড হচ্ছে...
                  </div>
                ) : sellerSlips.length === 0 ? (
                  <div className="rounded-xl bg-gray-50 py-12 text-center dark:bg-gray-800">
                    <Receipt
                      size={35}
                      className="mx-auto mb-3 text-gray-300"
                    />
                    <p className="text-sm text-gray-500 dark:text-gray-400">
                      এই Seller-এর কোনো Slip পাওয়া যায়নি।
                    </p>
                  </div>
                ) : (
                  <div className="overflow-x-auto rounded-xl border border-gray-100 dark:border-gray-800">
                    <table className="w-full min-w-[900px] text-left text-sm">
                      <thead className="bg-gray-50 dark:bg-gray-800">
                        <tr className="text-xs text-gray-500 dark:text-gray-400">
                          <th className="px-3 py-3">Slip No.</th>
                          <th className="px-3 py-3">Date</th>
                          <th className="px-3 py-3">Buyer</th>
                          <th className="px-3 py-3 text-right">Quantity</th>
                          <th className="px-3 py-3 text-right">Rate</th>
                          <th className="px-3 py-3 text-right">Gross</th>
                          <th className="px-3 py-3 text-right">Commission</th>
                          <th className="px-3 py-3 text-right">Net Payable</th>
                        </tr>
                      </thead>

                      <tbody>
                        {sellerSlips.map((slip) => (
                          <tr
                            key={slip.entry_line_id}
                            className="border-t border-gray-100 dark:border-gray-800"
                          >
                            <td className="px-3 py-3 font-semibold text-emerald-600 dark:text-emerald-400">
                              {slip.seller_slip_no}
                            </td>

                            <td className="px-3 py-3 text-gray-500 dark:text-gray-400">
                              {formatDate(slip.entry_date)}
                            </td>

                            <td className="px-3 py-3">
                              <p className="font-semibold text-gray-800 dark:text-gray-200">
                                {slip.buyer_name}
                              </p>
                              <p className="text-xs text-gray-500">
                                {slip.buyer_code}
                              </p>
                            </td>

                            <td className="px-3 py-3 text-right">
                              {numeric(slip.quantity)}
                            </td>

                            <td className="px-3 py-3 text-right">
                              {money(slip.rate)}
                            </td>

                            <td className="px-3 py-3 text-right font-semibold">
                              {money(slip.gross_amount)}
                            </td>

                            <td className="px-3 py-3 text-right text-purple-600 dark:text-purple-400">
                              {money(slip.commission_amount)}
                            </td>

                            <td className="px-3 py-3 text-right font-bold text-emerald-700 dark:text-emerald-400">
                              {money(slip.seller_net_amount)}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </section>

              {selectedSeller.notes && (
                <div className="rounded-xl bg-gray-50 p-4 dark:bg-gray-800">
                  <p className="text-xs font-semibold text-gray-500">
                    Notes
                  </p>
                  <p className="mt-2 text-sm text-gray-700 dark:text-gray-300">
                    {selectedSeller.notes}
                  </p>
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
