
import { useCallback, useEffect, useMemo, useState } from "react";
import {
  Search,
  RefreshCw,
  Users,
  Store,
  Wallet,
  TrendingUp,
  AlertCircle,
  Download,
  BookOpen,
} from "lucide-react";
import { supabase } from "../lib/supabase";

type BuyerLedger = {
  buyer_id: string;
  buyer_code: string;
  name: string;
  phone: string | null;
  opening_balance: number;
  total_purchases: number;
  total_collected: number;
  current_due: number;
};

type SellerLedger = {
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
};

type Tab = "buyers" | "sellers";

const formatMoney = (value: number | string | null | undefined) => {
  return new Intl.NumberFormat("en-BD", {
    style: "currency",
    currency: "BDT",
    maximumFractionDigits: 2,
  }).format(Number(value || 0));
};

const getBalanceLabel = (value: number) => {
  if (value > 0) return "বকেয়া";
  if (value < 0) return "অগ্রিম";
  return "পরিশোধিত";
};

export default function Ledger() {
  const [activeTab, setActiveTab] = useState<Tab>("buyers");

  const [buyers, setBuyers] = useState<BuyerLedger[]>([]);
  const [sellers, setSellers] = useState<SellerLedger[]>([]);

  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  // =====================================
  // LOAD BUYER AND SELLER LEDGER
  // =====================================

  const loadLedger = useCallback(async () => {
    setLoading(true);
    setError("");

    try {
      const [buyerResponse, sellerResponse] = await Promise.all([
        supabase
          .from("buyer_ledger_summary")
          .select(
            "buyer_id,buyer_code,name,phone,opening_balance,total_purchases,total_collected,current_due"
          )
          .order("name", { ascending: true }),

        supabase
          .from("seller_ledger_summary")
          .select(
            "seller_id,seller_code,name,phone,opening_balance,total_gross,total_commission,total_slip_cost,total_payable,total_paid,current_due"
          )
          .order("name", { ascending: true }),
      ]);

      if (buyerResponse.error) throw buyerResponse.error;
      if (sellerResponse.error) throw sellerResponse.error;

      setBuyers((buyerResponse.data || []) as BuyerLedger[]);
      setSellers((sellerResponse.data || []) as SellerLedger[]);
    } catch (err) {
      console.error("Ledger Error:", err);

      setError(
        err instanceof Error
          ? err.message
          : "Ledger Data Load করা যায়নি।"
      );
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadLedger();
  }, [loadLedger]);

  // =====================================
  // SEARCH
  // =====================================

  const filteredBuyers = useMemo(() => {
    const term = search.toLowerCase().trim();

    return buyers.filter((item) => {
      return (
        item.name?.toLowerCase().includes(term) ||
        item.buyer_code?.toLowerCase().includes(term) ||
        item.phone?.toLowerCase().includes(term)
      );
    });
  }, [buyers, search]);

  const filteredSellers = useMemo(() => {
    const term = search.toLowerCase().trim();

    return sellers.filter((item) => {
      return (
        item.name?.toLowerCase().includes(term) ||
        item.seller_code?.toLowerCase().includes(term) ||
        item.phone?.toLowerCase().includes(term)
      );
    });
  }, [sellers, search]);

  // =====================================
  // SUMMARY
  // =====================================

  const buyerStats = useMemo(() => {
    return {
      total: buyers.length,

      purchases: buyers.reduce(
        (sum, item) => sum + Number(item.total_purchases || 0),
        0
      ),

      collected: buyers.reduce(
        (sum, item) => sum + Number(item.total_collected || 0),
        0
      ),

      due: buyers.reduce(
        (sum, item) =>
          sum + Math.max(Number(item.current_due || 0), 0),
        0
      ),
    };
  }, [buyers]);

  const sellerStats = useMemo(() => {
    return {
      total: sellers.length,

      payable: sellers.reduce(
        (sum, item) => sum + Number(item.total_payable || 0),
        0
      ),

      paid: sellers.reduce(
        (sum, item) => sum + Number(item.total_paid || 0),
        0
      ),

      due: sellers.reduce(
        (sum, item) =>
          sum + Math.max(Number(item.current_due || 0), 0),
        0
      ),

      commission: sellers.reduce(
        (sum, item) => sum + Number(item.total_commission || 0),
        0
      ),
    };
  }, [sellers]);

  // =====================================
  // EXPORT CSV
  // =====================================

  const exportCSV = () => {
    let rows: (string | number)[][];

    if (activeTab === "buyers") {
      rows = [
        [
          "Buyer Code",
          "Buyer Name",
          "Phone",
          "Opening Balance",
          "Total Purchase",
          "Total Collected",
          "Current Due",
        ],

        ...filteredBuyers.map((item) => [
          item.buyer_code,
          item.name,
          item.phone || "",
          Number(item.opening_balance || 0),
          Number(item.total_purchases || 0),
          Number(item.total_collected || 0),
          Number(item.current_due || 0),
        ]),
      ];
    } else {
      rows = [
        [
          "Seller Code",
          "Seller Name",
          "Phone",
          "Opening Balance",
          "Gross",
          "Commission",
          "Slip Cost",
          "Net Payable",
          "Total Paid",
          "Current Due",
        ],

        ...filteredSellers.map((item) => [
          item.seller_code,
          item.name,
          item.phone || "",
          Number(item.opening_balance || 0),
          Number(item.total_gross || 0),
          Number(item.total_commission || 0),
          Number(item.total_slip_cost || 0),
          Number(item.total_payable || 0),
          Number(item.total_paid || 0),
          Number(item.current_due || 0),
        ]),
      ];
    }

    const csv =
      "\uFEFF" +
      rows
        .map((row) =>
          row
            .map(
              (value) =>
                `"${String(value ?? "").replace(/"/g, '""')}"`
            )
            .join(",")
        )
        .join("\n");

    const blob = new Blob([csv], {
      type: "text/csv;charset=utf-8;",
    });

    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");

    link.href = url;
    link.download =
      activeTab === "buyers"
        ? "pan-arot-buyer-ledger.csv"
        : "pan-arot-seller-ledger.csv";

    link.click();
    URL.revokeObjectURL(url);
  };

  // =====================================
  // SUMMARY CARD
  // =====================================

  const StatCard = ({
    title,
    value,
    icon: Icon,
    color,
  }: {
    title: string;
    value: string;
    icon: React.ElementType;
    color: string;
  }) => (
    <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm dark:border-slate-800 dark:bg-slate-900">
      <div className="flex items-center justify-between gap-3">
        <p className="text-sm text-slate-500 dark:text-slate-400">
          {title}
        </p>

        <div className={`rounded-xl p-2 ${color}`}>
          <Icon size={20} />
        </div>
      </div>

      <h3 className="mt-3 break-words text-xl font-bold text-slate-800 dark:text-white">
        {value}
      </h3>
    </div>
  );

  // =====================================
  // PAGE UI
  // =====================================

  return (
    <div className="min-h-screen space-y-6 bg-slate-50 p-4 dark:bg-slate-950 md:p-6">

      {/* HEADER */}

      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <BookOpen className="text-emerald-600" size={25} />

            <h1 className="text-2xl font-bold text-slate-800 dark:text-white">
              Ledger
            </h1>
          </div>

          <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
            Buyer ও Seller-এর সম্পূর্ণ আর্থিক হিসাব
          </p>
        </div>

        <button
          onClick={loadLedger}
          disabled={loading}
          className="flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm font-semibold text-slate-700 shadow-sm hover:bg-slate-100 disabled:opacity-50 dark:border-slate-700 dark:bg-slate-900 dark:text-white dark:hover:bg-slate-800"
        >
          <RefreshCw
            size={17}
            className={loading ? "animate-spin" : ""}
          />
          Refresh
        </button>
      </div>

      {/* TABS */}

      <div className="flex w-full gap-2 rounded-xl bg-slate-200 p-1 dark:bg-slate-800 sm:w-fit">
        <button
          onClick={() => {
            setActiveTab("buyers");
            setSearch("");
          }}
          className={`flex flex-1 items-center justify-center gap-2 rounded-lg px-5 py-3 text-sm font-semibold sm:flex-none ${
            activeTab === "buyers"
              ? "bg-white text-emerald-700 shadow dark:bg-slate-900 dark:text-emerald-400"
              : "text-slate-600 dark:text-slate-300"
          }`}
        >
          <Users size={18} />
          Buyer Ledger
        </button>

        <button
          onClick={() => {
            setActiveTab("sellers");
            setSearch("");
          }}
          className={`flex flex-1 items-center justify-center gap-2 rounded-lg px-5 py-3 text-sm font-semibold sm:flex-none ${
            activeTab === "sellers"
              ? "bg-white text-emerald-700 shadow dark:bg-slate-900 dark:text-emerald-400"
              : "text-slate-600 dark:text-slate-300"
          }`}
        >
          <Store size={18} />
          Seller Ledger
        </button>
      </div>

      {/* BUYER STATS */}

      {activeTab === "buyers" && (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
          <StatCard
            title="মোট Buyer"
            value={String(buyerStats.total)}
            icon={Users}
            color="bg-blue-50 text-blue-600 dark:bg-blue-950"
          />

          <StatCard
            title="মোট ক্রয়"
            value={formatMoney(buyerStats.purchases)}
            icon={TrendingUp}
            color="bg-indigo-50 text-indigo-600 dark:bg-indigo-950"
          />

          <StatCard
            title="মোট আদায়"
            value={formatMoney(buyerStats.collected)}
            icon={Wallet}
            color="bg-emerald-50 text-emerald-600 dark:bg-emerald-950"
          />

          <StatCard
            title="Buyer-এর মোট বকেয়া"
            value={formatMoney(buyerStats.due)}
            icon={AlertCircle}
            color="bg-red-50 text-red-600 dark:bg-red-950"
          />
        </div>
      )}

      {/* SELLER STATS */}

      {activeTab === "sellers" && (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
          <StatCard
            title="মোট Seller"
            value={String(sellerStats.total)}
            icon={Store}
            color="bg-blue-50 text-blue-600 dark:bg-blue-950"
          />

          <StatCard
            title="মোট Net Payable"
            value={formatMoney(sellerStats.payable)}
            icon={TrendingUp}
            color="bg-indigo-50 text-indigo-600 dark:bg-indigo-950"
          />

          <StatCard
            title="Seller-কে পরিশোধ"
            value={formatMoney(sellerStats.paid)}
            icon={Wallet}
            color="bg-emerald-50 text-emerald-600 dark:bg-emerald-950"
          />

          <StatCard
            title="Seller-এর মোট বকেয়া"
            value={formatMoney(sellerStats.due)}
            icon={AlertCircle}
            color="bg-red-50 text-red-600 dark:bg-red-950"
          />
        </div>
      )}

      {/* SEARCH */}

      <div className="flex flex-col gap-3 sm:flex-row">
        <div className="relative flex-1">
          <Search
            size={19}
            className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400"
          />

          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="নাম, ID অথবা মোবাইল নম্বর দিয়ে খুঁজুন..."
            className="w-full rounded-xl border border-slate-200 bg-white py-3 pl-10 pr-4 text-sm text-slate-800 outline-none focus:border-emerald-500 focus:ring-2 focus:ring-emerald-100 dark:border-slate-700 dark:bg-slate-900 dark:text-white dark:focus:ring-emerald-950"
          />
        </div>

        <button
          onClick={exportCSV}
          disabled={loading}
          className="flex items-center justify-center gap-2 rounded-xl bg-emerald-600 px-5 py-3 text-sm font-semibold text-white hover:bg-emerald-700 disabled:opacity-50"
        >
          <Download size={18} />
          Export CSV
        </button>
      </div>

      {/* ERROR */}

      {error && (
        <div className="rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-700 dark:border-red-900 dark:bg-red-950 dark:text-red-300">
          <div className="flex items-start gap-2">
            <AlertCircle size={19} className="mt-0.5 shrink-0" />
            <div>
              <p className="font-semibold">Ledger Error</p>
              <p className="mt-1">{error}</p>
            </div>
          </div>
        </div>
      )}

      {/* TABLE CONTAINER */}

      <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm dark:border-slate-800 dark:bg-slate-900">

        <div className="border-b border-slate-200 p-4 dark:border-slate-800">
          <h2 className="font-bold text-slate-800 dark:text-white">
            {activeTab === "buyers"
              ? "Buyer Account Ledger"
              : "Seller Account Ledger"}
          </h2>

          <p className="mt-1 text-xs text-slate-500">
            মোট{" "}
            {activeTab === "buyers"
              ? filteredBuyers.length
              : filteredSellers.length}{" "}
            জন
          </p>
        </div>

        {loading ? (
          <div className="p-14 text-center text-sm text-slate-500">
            <RefreshCw className="mx-auto mb-3 animate-spin" size={25} />
            Ledger Data Load হচ্ছে...
          </div>
        ) : activeTab === "buyers" ? (

          /* BUYER TABLE */

          filteredBuyers.length === 0 ? (
            <div className="p-14 text-center text-slate-500">
              <Users className="mx-auto mb-3 opacity-40" size={35} />
              কোনো Buyer-এর হিসাব পাওয়া যায়নি।
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full min-w-[850px] text-left text-sm">
                <thead className="bg-slate-50 text-xs text-slate-500 dark:bg-slate-800 dark:text-slate-300">
                  <tr>
                    <th className="px-5 py-4">Buyer Information</th>
                    <th className="px-5 py-4">Opening Balance</th>
                    <th className="px-5 py-4">Total Purchase</th>
                    <th className="px-5 py-4">Total Collected</th>
                    <th className="px-5 py-4 text-right">Current Due</th>
                  </tr>
                </thead>

                <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                  {filteredBuyers.map((item) => {
                    const due = Number(item.current_due || 0);

                    return (
                      <tr
                        key={item.buyer_id}
                        className="hover:bg-slate-50 dark:hover:bg-slate-800/50"
                      >
                        <td className="px-5 py-4">
                          <p className="font-semibold text-slate-800 dark:text-white">
                            {item.name}
                          </p>

                          <p className="mt-1 text-xs text-slate-500">
                            {item.buyer_code}
                            {" · "}
                            {item.phone || "Phone নেই"}
                          </p>
                        </td>

                        <td className="px-5 py-4 text-slate-600 dark:text-slate-300">
                          {formatMoney(item.opening_balance)}
                        </td>

                        <td className="px-5 py-4 font-medium text-slate-700 dark:text-slate-200">
                          {formatMoney(item.total_purchases)}
                        </td>

                        <td className="px-5 py-4 font-medium text-emerald-600">
                          {formatMoney(item.total_collected)}
                        </td>

                        <td className="px-5 py-4 text-right">
                          <p
                            className={`font-bold ${
                              due > 0
                                ? "text-red-600"
                                : due < 0
                                ? "text-blue-600"
                                : "text-emerald-600"
                            }`}
                          >
                            {formatMoney(due)}
                          </p>

                          <p className="mt-1 text-xs text-slate-400">
                            {getBalanceLabel(due)}
                          </p>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )
        ) : (

          /* SELLER TABLE */

          filteredSellers.length === 0 ? (
            <div className="p-14 text-center text-slate-500">
              <Store className="mx-auto mb-3 opacity-40" size={35} />
              কোনো Seller-এর হিসাব পাওয়া যায়নি।
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full min-w-[1100px] text-left text-sm">
                <thead className="bg-slate-50 text-xs text-slate-500 dark:bg-slate-800 dark:text-slate-300">
                  <tr>
                    <th className="px-5 py-4">Seller Information</th>
                    <th className="px-5 py-4">Gross</th>
                    <th className="px-5 py-4">Commission</th>
                    <th className="px-5 py-4">Slip Cost</th>
                    <th className="px-5 py-4">Net Payable</th>
                    <th className="px-5 py-4">Total Paid</th>
                    <th className="px-5 py-4 text-right">Current Due</th>
                  </tr>
                </thead>

                <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                  {filteredSellers.map((item) => {
                    const due = Number(item.current_due || 0);

                    return (
                      <tr
                        key={item.seller_id}
                        className="hover:bg-slate-50 dark:hover:bg-slate-800/50"
                      >
                        <td className="px-5 py-4">
                          <p className="font-semibold text-slate-800 dark:text-white">
                            {item.name}
                          </p>

                          <p className="mt-1 text-xs text-slate-500">
                            {item.seller_code}
                            {" · "}
                            {item.phone || "Phone নেই"}
                          </p>
                        </td>

                        <td className="px-5 py-4">
                          {formatMoney(item.total_gross)}
                        </td>

                        <td className="px-5 py-4 text-orange-600">
                          {formatMoney(item.total_commission)}
                        </td>

                        <td className="px-5 py-4">
                          {formatMoney(item.total_slip_cost)}
                        </td>

                        <td className="px-5 py-4 font-semibold text-slate-800 dark:text-white">
                          {formatMoney(item.total_payable)}
                        </td>

                        <td className="px-5 py-4 text-emerald-600">
                          {formatMoney(item.total_paid)}
                        </td>

                        <td className="px-5 py-4 text-right">
                          <p
                            className={`font-bold ${
                              due > 0
                                ? "text-red-600"
                                : due < 0
                                ? "text-blue-600"
                                : "text-emerald-600"
                            }`}
                          >
                            {formatMoney(due)}
                          </p>

                          <p className="mt-1 text-xs text-slate-400">
                            {getBalanceLabel(due)}
                          </p>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )
        )}
      </div>

      {/* FOOTER NOTE */}

      <div className="rounded-xl border border-blue-100 bg-blue-50 p-4 text-xs leading-6 text-blue-800 dark:border-blue-900 dark:bg-blue-950 dark:text-blue-300">
        <p className="font-semibold">হিসাবের নিয়ম</p>

        <p>
          Buyer Due = Opening Balance + Total Purchase − Total Collected
        </p>

        <p>
          Seller Due = Opening Balance + Total Payable − Total Paid
        </p>

        <p>
          Seller Net Payable = Gross − Commission − Slip Cost
        </p>

        <p className="mt-1">
          এই Page শুধু Ledger Summary View থেকে Data Read করে।
          কোনো Payment বা Transaction পরিবর্তন করে না।
        </p>
      </div>
    </div>
  );
}
