
import {
  useCallback,
  useEffect,
  useMemo,
  useState,
  type FormEvent,
} from "react";

import {
  Users,
  Plus,
  Search,
  RefreshCw,
  Eye,
  Edit,
  X,
  Phone,
  MapPin,
  Wallet,
  ShoppingBag,
  Percent,
  CalendarDays,
  Printer,
  CheckCircle2,
  XCircle,
  AlertCircle,
  UserRound,
} from "lucide-react";

import { supabase } from "../lib/supabase";
import { useAuth } from "../contexts/AuthContext";

// --------------------------------------------------
// Types
// --------------------------------------------------

interface Buyer {
  id: string;
  buyer_code: string;
  name: string;
  phone: string | null;
  address: string | null;
  opening_balance: number;
  notes: string | null;
  is_active: boolean;
  created_by: string | null;
  created_at: string;
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

interface MonthlyDiscount {
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

interface BuyerSlip {
  entry_id: string;
  entry_no: string;
  entry_date: string;
  status: string;
  buyer_id: string;
  buyer_code: string;
  buyer_name: string;
  total_amount: number;
  seller_lines: unknown;
}

interface SellerLine {
  seller_name?: string;
  seller_code?: string;
  quantity?: number;
  rate?: number;
  gross_amount?: number;
  commission_amount?: number;
  slip_cost?: number;
  seller_net_amount?: number;
}

interface BuyerForm {
  name: string;
  phone: string;
  address: string;
  opening_balance: string;
  notes: string;
}

const emptyForm: BuyerForm = {
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

const formatDate = (value: string) => {
  if (!value) return "—";

  return new Intl.DateTimeFormat("bn-BD", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    timeZone: "Asia/Dhaka",
  }).format(new Date(`${value.slice(0, 10)}T12:00:00+06:00`));
};

const normalizePhone = (value: string | null | undefined) => {
  return (value || "").replace(/\D/g, "");
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

function getSellerLines(value: unknown): SellerLine[] {
  if (Array.isArray(value)) {
    return value as SellerLine[];
  }

  if (typeof value === "string") {
    try {
      const parsed = JSON.parse(value);
      return Array.isArray(parsed) ? parsed : [];
    } catch {
      return [];
    }
  }

  return [];
}

// --------------------------------------------------
// Reusable Stat Card
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

// --------------------------------------------------
// Section Title
// --------------------------------------------------

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
// Main Buyers Page
// --------------------------------------------------

export default function Buyers() {
  const { user } = useAuth();

  const [buyers, setBuyers] = useState<Buyer[]>([]);
  const [ledgers, setLedgers] = useState<Record<string, BuyerLedger>>({});

  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [saving, setSaving] = useState(false);

  const [search, setSearch] = useState("");

  const [statusFilter, setStatusFilter] = useState<
    "all" | "active" | "inactive"
  >("all");

  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  const [formOpen, setFormOpen] = useState(false);
  const [editingBuyer, setEditingBuyer] = useState<Buyer | null>(null);
  const [form, setForm] = useState<BuyerForm>(emptyForm);

  const [selectedBuyer, setSelectedBuyer] = useState<Buyer | null>(null);
  const [buyerSlips, setBuyerSlips] = useState<BuyerSlip[]>([]);
  const [monthlyDiscounts, setMonthlyDiscounts] = useState<MonthlyDiscount[]>([]);
  const [detailsLoading, setDetailsLoading] = useState(false);

  // --------------------------------------------------
  // Load Buyers and Ledger
  // --------------------------------------------------

  const loadData = useCallback(async (refresh = false) => {
    if (refresh) {
      setRefreshing(true);
    } else {
      setLoading(true);
    }

    setError("");

    try {
      const [buyerResult, ledgerResult] = await Promise.all([
        supabase
          .from("buyers")
          .select("*")
          .order("created_at", { ascending: false }),

        supabase
          .from("buyer_ledger_summary")
          .select("*"),
      ]);

      if (buyerResult.error) throw buyerResult.error;
      if (ledgerResult.error) throw ledgerResult.error;

      const buyerRows = (buyerResult.data ?? []) as Buyer[];
      const ledgerRows = (ledgerResult.data ?? []) as BuyerLedger[];

      const ledgerMap: Record<string, BuyerLedger> = {};

      ledgerRows.forEach((item) => {
        ledgerMap[item.buyer_id] = item;
      });

      setBuyers(buyerRows);
      setLedgers(ledgerMap);
    } catch (err) {
      console.error("Buyer loading error:", err);
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

  // --------------------------------------------------
  // Statistics
  // --------------------------------------------------

  const statistics = useMemo(() => {
    const activeBuyers = buyers.filter((buyer) => buyer.is_active);

    const totalPurchase = Object.values(ledgers).reduce(
      (sum, item) => sum + numeric(item.total_purchases),
      0
    );

    const totalCollected = Object.values(ledgers).reduce(
      (sum, item) => sum + numeric(item.total_collected),
      0
    );

    const totalDue = Object.values(ledgers).reduce(
      (sum, item) => sum + numeric(item.current_due),
      0
    );

    return {
      totalCount: buyers.length,
      activeCount: activeBuyers.length,
      totalPurchase,
      totalCollected,
      totalDue,
    };
  }, [buyers, ledgers]);

  // --------------------------------------------------
  // Filter Buyers
  // --------------------------------------------------

  const filteredBuyers = useMemo(() => {
    const keyword = search.trim().toLowerCase();

    return buyers.filter((buyer) => {
      const matchesSearch =
        !keyword ||
        buyer.name.toLowerCase().includes(keyword) ||
        buyer.buyer_code.toLowerCase().includes(keyword) ||
        (buyer.phone ?? "").toLowerCase().includes(keyword) ||
        (buyer.address ?? "").toLowerCase().includes(keyword);

      const matchesStatus =
        statusFilter === "all" ||
        (statusFilter === "active" && buyer.is_active) ||
        (statusFilter === "inactive" && !buyer.is_active);

      return matchesSearch && matchesStatus;
    });
  }, [buyers, search, statusFilter]);

  // --------------------------------------------------
  // Form Helpers
  // --------------------------------------------------

  const updateForm = (field: keyof BuyerForm, value: string) => {
    setForm((previous) => ({
      ...previous,
      [field]: value,
    }));
  };

  const openCreateForm = () => {
    setEditingBuyer(null);
    setForm(emptyForm);
    setError("");
    setSuccess("");
    setFormOpen(true);
  };

  const openEditForm = (buyer: Buyer) => {
    setEditingBuyer(buyer);

    setForm({
      name: buyer.name,
      phone: buyer.phone ?? "",
      address: buyer.address ?? "",
      opening_balance: String(buyer.opening_balance ?? 0),
      notes: buyer.notes ?? "",
    });

    setError("");
    setSuccess("");
    setFormOpen(true);
  };

  const closeForm = () => {
    setFormOpen(false);
    setEditingBuyer(null);
    setForm(emptyForm);
  };

  // --------------------------------------------------
  // Duplicate Check
  // --------------------------------------------------

  const findDuplicate = () => {
    const name = form.name.trim().toLowerCase();
    const phone = normalizePhone(form.phone);

    return buyers.filter((buyer) => {
      if (editingBuyer && buyer.id === editingBuyer.id) {
        return false;
      }

      const sameName =
        name.length > 0 &&
        buyer.name.trim().toLowerCase() === name;

      const samePhone =
        phone.length > 0 &&
        normalizePhone(buyer.phone) === phone;

      return sameName || samePhone;
    });
  };

  // --------------------------------------------------
  // Save Buyer
  // --------------------------------------------------

  const handleSaveBuyer = async (
    event: FormEvent<HTMLFormElement>
  ) => {
    event.preventDefault();

    setError("");
    setSuccess("");

    const name = form.name.trim();

    if (!name) {
      setError("Buyer-এর নাম লিখুন।");
      return;
    }

    const duplicates = findDuplicate();

    if (duplicates.length > 0) {
      setError(
        `এই নাম অথবা ফোন নম্বরে আগের Buyer Account আছে (${duplicates[0].buyer_code})।`
      );
      return;
    }

    const openingBalance = Number(form.opening_balance || 0);

    if (!Number.isFinite(openingBalance) || openingBalance < 0) {
      setError("সঠিক Opening Balance লিখুন।");
      return;
    }

    setSaving(true);

    try {
      const payload = {
        name,
        phone: form.phone.trim() || null,
        address: form.address.trim() || null,
        opening_balance: openingBalance,
        notes: form.notes.trim() || null,
      };

      if (editingBuyer) {
        const { error: updateError } = await supabase
          .from("buyers")
          .update(payload)
          .eq("id", editingBuyer.id);

        if (updateError) throw updateError;

        setSuccess("Buyer তথ্য সফলভাবে আপডেট হয়েছে।");
      } else {
        const { error: insertError } = await supabase
          .from("buyers")
          .insert({
            ...payload,
            created_by: user?.id ?? null,
          });

        if (insertError) throw insertError;

        setSuccess("নতুন Buyer Account সফলভাবে তৈরি হয়েছে।");
      }

      closeForm();
      await loadData(true);
    } catch (err) {
      console.error("Buyer save error:", err);
      setError(getErrorMessage(err));
    } finally {
      setSaving(false);
    }
  };

  // --------------------------------------------------
  // Activate / Deactivate Buyer
  // --------------------------------------------------

  const toggleBuyerStatus = async (buyer: Buyer) => {
    const nextStatus = !buyer.is_active;

    const confirmed = window.confirm(
      `${buyer.name}-কে ${nextStatus ? "Active" : "Inactive"} করতে চান?`
    );

    if (!confirmed) return;

    setError("");
    setSuccess("");

    try {
      const { error: updateError } = await supabase
        .from("buyers")
        .update({ is_active: nextStatus })
        .eq("id", buyer.id);

      if (updateError) throw updateError;

      setSuccess(
        nextStatus
          ? "Buyer Account সক্রিয় করা হয়েছে।"
          : "Buyer Account নিষ্ক্রিয় করা হয়েছে।"
      );

      await loadData(true);
    } catch (err) {
      setError(getErrorMessage(err));
    }
  };

  // --------------------------------------------------
  // Get Buyer Ledger
  // --------------------------------------------------

  const getLedger = (buyerId: string) => {
    return ledgers[buyerId];
  };

  // --------------------------------------------------
  // Buyer Details
  // --------------------------------------------------

  const openBuyerDetails = async (buyer: Buyer) => {
    setSelectedBuyer(buyer);
    setBuyerSlips([]);
    setMonthlyDiscounts([]);
    setDetailsLoading(true);
    setError("");

    try {
      const [slipResult, discountResult] = await Promise.all([
        supabase
          .from("buyer_combined_slips")
          .select("*")
          .eq("buyer_id", buyer.id)
          .order("entry_date", { ascending: false }),

        supabase
          .from("buyer_monthly_discount_summary")
          .select("*")
          .eq("buyer_id", buyer.id)
          .order("month_start", { ascending: false }),
      ]);

      if (slipResult.error) throw slipResult.error;
      if (discountResult.error) throw discountResult.error;

      setBuyerSlips((slipResult.data ?? []) as BuyerSlip[]);
      setMonthlyDiscounts(
        (discountResult.data ?? []) as MonthlyDiscount[]
      );
    } catch (err) {
      console.error("Buyer details error:", err);
      setError(getErrorMessage(err));
    } finally {
      setDetailsLoading(false);
    }
  };

  const closeDetails = () => {
    setSelectedBuyer(null);
    setBuyerSlips([]);
    setMonthlyDiscounts([]);
  };

  // --------------------------------------------------
  // Print Buyer Statement
  // --------------------------------------------------

  const printBuyerDetails = () => {
    if (!selectedBuyer) return;

    const ledger = getLedger(selectedBuyer.id);

    const rows = buyerSlips
      .map((slip) => {
        const lines = getSellerLines(slip.seller_lines);

        const sellerText = lines
          .map(
            (line) =>
              `${escapeHtml(line.seller_name || "Seller")} - ${numeric(
                line.quantity
              )} x ${money(line.rate)}`
          )
          .join("<br/>");

        return `
          <tr>
            <td>${escapeHtml(slip.entry_no)}</td>
            <td>${escapeHtml(formatDate(slip.entry_date))}</td>
            <td>${sellerText}</td>
            <td>${money(slip.total_amount)}</td>
            <td>${escapeHtml(slip.status)}</td>
          </tr>
        `;
      })
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
        <title>Buyer Statement - ${escapeHtml(selectedBuyer.name)}</title>
        <style>
          body {
            font-family: Arial, sans-serif;
            padding: 25px;
            color: #222;
          }
          h1, h2, p { margin: 5px 0; }
          .header {
            text-align: center;
            margin-bottom: 25px;
          }
          .summary {
            display: flex;
            flex-wrap: wrap;
            gap: 15px;
            margin: 20px 0;
          }
          .summary div {
            border: 1px solid #ddd;
            padding: 12px;
            flex: 1;
            min-width: 120px;
          }
          table {
            width: 100%;
            border-collapse: collapse;
            margin-top: 20px;
          }
          th, td {
            border: 1px solid #ddd;
            padding: 8px;
            font-size: 11px;
            text-align: left;
          }
          th { background: #ecfdf5; }
          .footer {
            margin-top: 35px;
            text-align: right;
          }
        </style>
      </head>
      <body>
        <div class="header">
          <h1>Pan Arot Pro</h1>
          <h2>Buyer Statement</h2>
          <p>${escapeHtml(selectedBuyer.name)}</p>
          <p>${escapeHtml(selectedBuyer.buyer_code)}</p>
          <p>${escapeHtml(selectedBuyer.phone ?? "")}</p>
        </div>

        <div class="summary">
          <div>
            <strong>মোট কেনাকাটা</strong>
            <p>${money(ledger?.total_purchases)}</p>
          </div>
          <div>
            <strong>মোট আদায়</strong>
            <p>${money(ledger?.total_collected)}</p>
          </div>
          <div>
            <strong>বর্তমান বকেয়া</strong>
            <p>${money(ledger?.current_due)}</p>
          </div>
        </div>

        <h3>Buyer Purchase History</h3>

        <table>
          <thead>
            <tr>
              <th>Entry No.</th>
              <th>Date</th>
              <th>Seller Details</th>
              <th>Total Amount</th>
              <th>Status</th>
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

  // --------------------------------------------------
  // Loading Screen
  // --------------------------------------------------

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

  // --------------------------------------------------
  // Main UI
  // --------------------------------------------------

  return (
    <div className="space-y-6 pb-8">

      {/* Header */}

      <div className="relative overflow-hidden rounded-2xl bg-gradient-to-r from-emerald-700 to-green-600 p-6 text-white shadow-lg sm:p-8">
        <div className="relative z-10 flex flex-wrap items-center justify-between gap-4">
          <div>
            <div className="mb-3 flex items-center gap-2 text-sm text-emerald-100">
              <Users size={17} />
              <span>Pan Arot Pro</span>
            </div>

            <h1 className="text-2xl font-bold sm:text-3xl">
              Buyer Management
            </h1>

            <p className="mt-2 text-sm text-emerald-100">
              সকল Buyer-এর Account, কেনাকাটা ও বকেয়ার হিসাব পরিচালনা করুন।
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
              নতুন Buyer
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

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-2">
        <StatCard
          title="Active Buyers"
          value={String(statistics.activeCount)}
          subtitle={`মোট ${statistics.totalCount} জন Buyer`}
          icon={Users}
          iconClass="bg-emerald-50 text-emerald-600 dark:bg-emerald-950/40 dark:text-emerald-400"
        />

        <StatCard
          title="মোট কেনাকাটা"
          value={money(statistics.totalPurchase)}
          subtitle="সকল Buyer-এর মোট কেনাকাটা"
          icon={ShoppingBag}
          iconClass="bg-blue-50 text-blue-600 dark:bg-blue-950/40 dark:text-blue-400"
        />

        <StatCard
          title="মোট আদায়"
          value={money(statistics.totalCollected)}
          subtitle="Buyer-দের কাছ থেকে পাওয়া টাকা"
          icon={Wallet}
          iconClass="bg-purple-50 text-purple-600 dark:bg-purple-950/40 dark:text-purple-400"
        />

        <StatCard
          title="Buyer-এর বর্তমান বকেয়া"
          value={money(statistics.totalDue)}
          subtitle="সকল Buyer-এর বর্তমান বকেয়া"
          icon={AlertCircle}
          iconClass="bg-orange-50 text-orange-600 dark:bg-orange-950/40 dark:text-orange-400"
        />
      </div>

      {/* Buyer List */}

      <section className="rounded-2xl border border-gray-100 bg-white p-5 shadow-sm dark:border-gray-800 dark:bg-gray-900 sm:p-6">
        <SectionTitle
          title="সকল Buyer"
          subtitle="Buyer-এর তথ্য ও ব্যক্তিগত হিসাব"
          action={
            <span className="rounded-lg bg-emerald-50 px-3 py-2 text-xs font-semibold text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-400">
              {filteredBuyers.length} জন পাওয়া গেছে
            </span>
          }
        />

        {/* Search and Filters */}

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
              placeholder="নাম, Buyer ID অথবা ফোন দিয়ে খুঁজুন..."
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
            <option value="all">সকল Buyer</option>
            <option value="active">শুধু Active</option>
            <option value="inactive">শুধু Inactive</option>
          </select>
        </div>

        {/* Buyer Table */}

        {filteredBuyers.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-14 text-center">
            <Users size={38} className="mb-3 text-gray-300" />

            <h3 className="font-semibold text-gray-700 dark:text-gray-200">
              কোনো Buyer পাওয়া যায়নি
            </h3>

            <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
              নতুন Buyer তৈরি করুন অথবা Search পরিবর্তন করুন।
            </p>

            <button
              type="button"
              onClick={openCreateForm}
              className="mt-4 flex items-center gap-2 rounded-xl bg-emerald-600 px-4 py-2.5 text-sm font-semibold text-white hover:bg-emerald-700"
            >
              <Plus size={17} />
              নতুন Buyer তৈরি করুন
            </button>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[950px] text-left text-sm">
              <thead>
                <tr className="border-b border-gray-100 text-xs text-gray-500 dark:border-gray-800 dark:text-gray-400">
                  <th className="px-3 py-3 font-semibold">Buyer</th>
                  <th className="px-3 py-3 font-semibold">Phone</th>
                  <th className="px-3 py-3 text-right font-semibold">
                    মোট কেনাকাটা
                  </th>
                  <th className="px-3 py-3 text-right font-semibold">
                    মোট আদায়
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
                {filteredBuyers.map((buyer) => {
                  const ledger = getLedger(buyer.id);

                  return (
                    <tr
                      key={buyer.id}
                      className="border-b border-gray-50 last:border-0 hover:bg-gray-50/70 dark:border-gray-800 dark:hover:bg-gray-800/40"
                    >
                      <td className="px-3 py-4">
                        <div className="flex items-center gap-3">
                          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-emerald-50 text-emerald-600 dark:bg-emerald-950/40 dark:text-emerald-400">
                            <UserRound size={20} />
                          </div>

                          <div>
                            <p className="font-bold text-gray-800 dark:text-gray-100">
                              {buyer.name}
                            </p>

                            <p className="mt-1 text-xs font-medium text-emerald-600 dark:text-emerald-400">
                              {buyer.buyer_code}
                            </p>
                          </div>
                        </div>
                      </td>

                      <td className="px-3 py-4 text-gray-600 dark:text-gray-300">
                        {buyer.phone || "—"}
                      </td>

                      <td className="px-3 py-4 text-right font-semibold text-gray-800 dark:text-gray-200">
                        {money(ledger?.total_purchases)}
                      </td>

                      <td className="px-3 py-4 text-right text-emerald-600 dark:text-emerald-400">
                        {money(ledger?.total_collected)}
                      </td>

                      <td className="px-3 py-4 text-right font-bold text-orange-600 dark:text-orange-400">
                        {money(ledger?.current_due)}
                      </td>

                      <td className="px-3 py-4 text-center">
                        {buyer.is_active ? (
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
                            onClick={() => void openBuyerDetails(buyer)}
                            className="rounded-lg p-2 text-blue-600 transition hover:bg-blue-50 dark:hover:bg-blue-950/40"
                          >
                            <Eye size={17} />
                          </button>

                          <button
                            type="button"
                            title="Edit"
                            onClick={() => openEditForm(buyer)}
                            className="rounded-lg p-2 text-emerald-600 transition hover:bg-emerald-50 dark:hover:bg-emerald-950/40"
                          >
                            <Edit size={17} />
                          </button>

                          <button
                            type="button"
                            title={buyer.is_active ? "Deactivate" : "Activate"}
                            onClick={() => void toggleBuyerStatus(buyer)}
                            className="rounded-lg p-2 text-gray-500 transition hover:bg-gray-100 dark:hover:bg-gray-800"
                          >
                            {buyer.is_active ? (
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

      {/* Create / Edit Buyer Modal */}

      {formOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center overflow-y-auto bg-black/50 p-4">
          <div className="my-auto w-full max-w-xl rounded-2xl bg-white shadow-2xl dark:bg-gray-900">
            <div className="flex items-center justify-between border-b border-gray-100 p-5 dark:border-gray-800">
              <div>
                <h2 className="text-lg font-bold text-gray-900 dark:text-white">
                  {editingBuyer ? "Buyer Edit করুন" : "নতুন Buyer তৈরি করুন"}
                </h2>

                <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">
                  Buyer-এর প্রয়োজনীয় তথ্য দিন।
                </p>
              </div>

              <button
                type="button"
                onClick={closeForm}
                className="rounded-lg p-2 text-gray-500 hover:bg-gray-100 dark:hover:bg-gray-800"
              >
                <X size={20} />
              </button>
            </div>

            <form
              onSubmit={handleSaveBuyer}
              className="space-y-4 p-5"
            >
              {error && (
                <div className="rounded-lg bg-red-50 p-3 text-sm text-red-600 dark:bg-red-950/30 dark:text-red-300">
                  {error}
                </div>
              )}

              <div>
                <label className="mb-2 block text-sm font-semibold text-gray-700 dark:text-gray-300">
                  Buyer-এর নাম *
                </label>

                <input
                  type="text"
                  required
                  autoFocus
                  value={form.name}
                  onChange={(event) =>
                    updateForm("name", event.target.value)
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
                      updateForm("phone", event.target.value)
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
                      updateForm("opening_balance", event.target.value)
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
                    updateForm("address", event.target.value)
                  }
                  placeholder="Buyer-এর ঠিকানা"
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
                    updateForm("notes", event.target.value)
                  }
                  placeholder="অতিরিক্ত তথ্য..."
                  className="w-full resize-none rounded-xl border border-gray-200 bg-white px-4 py-3 text-sm outline-none focus:border-emerald-500 dark:border-gray-700 dark:bg-gray-800 dark:text-white"
                />
              </div>

              {!editingBuyer && (
                <p className="rounded-lg bg-emerald-50 p-3 text-xs text-emerald-700 dark:bg-emerald-950/30 dark:text-emerald-400">
                  Buyer ID Database থেকে স্বয়ংক্রিয়ভাবে তৈরি হবে।
                </p>
              )}

              <div className="flex flex-col-reverse gap-3 pt-2 sm:flex-row sm:justify-end">
                <button
                  type="button"
                  onClick={closeForm}
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
                    : editingBuyer
                      ? "পরিবর্তন সংরক্ষণ"
                      : "Buyer তৈরি করুন"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Buyer Details Modal */}

      {selectedBuyer && (
        <div className="fixed inset-0 z-50 flex items-center justify-center overflow-y-auto bg-black/50 p-3 sm:p-5">
          <div className="my-auto max-h-[95vh] w-full max-w-6xl overflow-y-auto rounded-2xl bg-white shadow-2xl dark:bg-gray-900">
            <div className="sticky top-0 z-10 flex flex-wrap items-center justify-between gap-3 border-b border-gray-100 bg-white p-5 dark:border-gray-800 dark:bg-gray-900">
              <div>
                <h2 className="text-lg font-bold text-gray-900 dark:text-white">
                  {selectedBuyer.name}
                </h2>

                <p className="mt-1 text-sm font-medium text-emerald-600 dark:text-emerald-400">
                  {selectedBuyer.buyer_code}
                </p>
              </div>

              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={printBuyerDetails}
                  disabled={buyerSlips.length === 0}
                  className="flex items-center gap-2 rounded-lg bg-emerald-600 px-3 py-2 text-sm font-semibold text-white hover:bg-emerald-700 disabled:opacity-50"
                >
                  <Printer size={16} />
                  Print
                </button>

                <button
                  type="button"
                  onClick={closeDetails}
                  className="rounded-lg p-2 text-gray-500 hover:bg-gray-100 dark:hover:bg-gray-800"
                >
                  <X size={20} />
                </button>
              </div>
            </div>

            <div className="space-y-6 p-5">
              {/* Buyer Information */}

              <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
                <div className="flex items-center gap-3 rounded-xl bg-gray-50 p-4 dark:bg-gray-800">
                  <Phone className="text-emerald-600" size={19} />

                  <div>
                    <p className="text-xs text-gray-500">Phone</p>
                    <p className="mt-1 text-sm font-semibold text-gray-800 dark:text-white">
                      {selectedBuyer.phone || "—"}
                    </p>
                  </div>
                </div>

                <div className="flex items-center gap-3 rounded-xl bg-gray-50 p-4 dark:bg-gray-800">
                  <MapPin className="text-emerald-600" size={19} />

                  <div>
                    <p className="text-xs text-gray-500">Address</p>
                    <p className="mt-1 text-sm font-semibold text-gray-800 dark:text-white">
                      {selectedBuyer.address || "—"}
                    </p>
                  </div>
                </div>

                <div className="flex items-center gap-3 rounded-xl bg-gray-50 p-4 dark:bg-gray-800">
                  <CalendarDays className="text-emerald-600" size={19} />

                  <div>
                    <p className="text-xs text-gray-500">Created At</p>
                    <p className="mt-1 text-sm font-semibold text-gray-800 dark:text-white">
                      {formatDate(selectedBuyer.created_at)}
                    </p>
                  </div>
                </div>
              </div>

              {/* Buyer Balance Cards */}

              {(() => {
                const ledger = getLedger(selectedBuyer.id);

                return (
                  <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-4">
                    <div className="rounded-xl bg-blue-50 p-4 dark:bg-blue-950/30">
                      <p className="text-xs text-blue-700 dark:text-blue-400">
                        মোট কেনাকাটা
                      </p>

                      <p className="mt-2 text-xl font-bold text-blue-800 dark:text-blue-300">
                        {money(ledger?.total_purchases)}
                      </p>
                    </div>

                    <div className="rounded-xl bg-purple-50 p-4 dark:bg-purple-950/30">
                      <p className="text-xs text-purple-700 dark:text-purple-400">
                        মোট আদায়
                      </p>

                      <p className="mt-2 text-xl font-bold text-purple-800 dark:text-purple-300">
                        {money(ledger?.total_collected)}
                      </p>
                    </div>

                    <div className="rounded-xl bg-emerald-50 p-4 dark:bg-emerald-950/30">
                      <p className="text-xs text-emerald-700 dark:text-emerald-400">
                        Opening Balance
                      </p>

                      <p className="mt-2 text-xl font-bold text-emerald-800 dark:text-emerald-300">
                        {money(ledger?.opening_balance)}
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

              {/* Monthly Discount */}

              <section>
                <SectionTitle
                  title="মাসিক ৫% Discount হিসাব"
                  subtitle="প্রতি মাসে Buyer-এর Discount-এর হিসাব"
                  action={
                    <span className="text-xs text-gray-500 dark:text-gray-400">
                      {monthlyDiscounts.length} টি মাস
                    </span>
                  }
                />

                {detailsLoading ? (
                  <div className="py-12 text-center text-sm text-gray-500">
                    Discount হিসাব লোড হচ্ছে...
                  </div>
                ) : monthlyDiscounts.length === 0 ? (
                  <div className="rounded-xl bg-gray-50 py-12 text-center dark:bg-gray-800">
                    <Percent
                      size={35}
                      className="mx-auto mb-3 text-gray-300"
                    />

                    <p className="text-sm text-gray-500 dark:text-gray-400">
                      এখনো কোনো মাসিক Discount হিসাব পাওয়া যায়নি।
                    </p>
                  </div>
                ) : (
                  <div className="overflow-x-auto rounded-xl border border-gray-100 dark:border-gray-800">
                    <table className="w-full min-w-[700px] text-left text-sm">
                      <thead className="bg-gray-50 dark:bg-gray-800">
                        <tr className="text-xs text-gray-500 dark:text-gray-400">
                          <th className="px-3 py-3 font-semibold">মাস</th>
                          <th className="px-3 py-3 text-right font-semibold">
                            কেনাকাটা
                          </th>
                          <th className="px-3 py-3 text-right font-semibold">
                            Discount
                          </th>
                          <th className="px-3 py-3 text-right font-semibold">
                            পরিশোধ
                          </th>
                          <th className="px-3 py-3 text-right font-semibold">
                            বাকি
                          </th>
                        </tr>
                      </thead>

                      <tbody>
                        {monthlyDiscounts.map((item) => (
                          <tr
                            key={`${item.buyer_id}-${item.month_start}`}
                            className="border-t border-gray-100 dark:border-gray-800"
                          >
                            <td className="px-3 py-4 font-medium">
                              {new Date(
                                `${item.month_start.slice(0, 10)}T00:00:00`
                              ).toLocaleDateString("bn-BD", {
                                month: "long",
                                year: "numeric",
                              })}
                            </td>

                            <td className="px-3 py-4 text-right">
                              {money(item.monthly_purchase)}
                            </td>

                            <td className="px-3 py-4 text-right font-semibold">
                              {money(item.discount_earned)}
                            </td>

                            <td className="px-3 py-4 text-right text-emerald-600 dark:text-emerald-400">
                              {money(item.discount_paid)}
                            </td>

                            <td className="px-3 py-4 text-right font-bold text-orange-600 dark:text-orange-400">
                              {money(item.discount_remaining)}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </section>

              {/* Purchase History */}

              <section>
                <SectionTitle
                  title="Buyer Transaction History"
                  subtitle="এই Buyer-এর সব Combined Purchase Slip"
                  action={
                    <span className="text-xs text-gray-500 dark:text-gray-400">
                      {buyerSlips.length} টি Slip
                    </span>
                  }
                />

                {detailsLoading ? (
                  <div className="py-12 text-center text-sm text-gray-500">
                    Transaction History লোড হচ্ছে...
                  </div>
                ) : buyerSlips.length === 0 ? (
                  <div className="rounded-xl bg-gray-50 py-12 text-center dark:bg-gray-800">
                    <ShoppingBag
                      size={35}
                      className="mx-auto mb-3 text-gray-300"
                    />

                    <p className="text-sm text-gray-500 dark:text-gray-400">
                      এই Buyer-এর কোনো Purchase Entry পাওয়া যায়নি।
                    </p>
                  </div>
                ) : (
                  <div className="overflow-x-auto rounded-xl border border-gray-100 dark:border-gray-800">
                    <table className="w-full min-w-[850px] text-left text-sm">
                      <thead className="bg-gray-50 dark:bg-gray-800">
                        <tr className="text-xs text-gray-500 dark:text-gray-400">
                          <th className="px-3 py-3 font-semibold">
                            Entry No.
                          </th>
                          <th className="px-3 py-3 font-semibold">Date</th>
                          <th className="px-3 py-3 font-semibold">
                            Seller Details
                          </th>
                          <th className="px-3 py-3 text-right font-semibold">
                            Total Amount
                          </th>
                          <th className="px-3 py-3 text-center font-semibold">
                            Status
                          </th>
                        </tr>
                      </thead>

                      <tbody>
                        {buyerSlips.map((slip) => {
                          const lines = getSellerLines(slip.seller_lines);

                          return (
                            <tr
                              key={slip.entry_id}
                              className="border-t border-gray-100 dark:border-gray-800"
                            >
                              <td className="px-3 py-4 font-semibold text-emerald-600 dark:text-emerald-400">
                                {slip.entry_no}
                              </td>

                              <td className="px-3 py-4 text-gray-500 dark:text-gray-400">
                                {formatDate(slip.entry_date)}
                              </td>

                              <td className="px-3 py-4">
                                <div className="space-y-1">
                                  {lines.map((line, index) => (
                                    <div key={index}>
                                      <p className="font-semibold text-gray-800 dark:text-gray-200">
                                        {line.seller_name || "Seller"}
                                      </p>

                                      <p className="text-xs text-gray-500">
                                        {numeric(line.quantity)} × {money(line.rate)}
                                      </p>
                                    </div>
                                  ))}
                                </div>
                              </td>

                              <td className="px-3 py-4 text-right font-bold">
                                {money(slip.total_amount)}
                              </td>

                              <td className="px-3 py-4 text-center">
                                <span className="inline-flex rounded-full bg-emerald-50 px-3 py-1 text-xs font-semibold text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-400">
                                  {slip.status}
                                </span>
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                )}
              </section>

              {/* Notes */}

              {selectedBuyer.notes && (
                <div className="rounded-xl bg-gray-50 p-4 dark:bg-gray-800">
                  <p className="text-xs font-semibold text-gray-500">
                    Notes
                  </p>

                  <p className="mt-2 text-sm text-gray-700 dark:text-gray-300">
                    {selectedBuyer.notes}
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
