
import { useCallback, useEffect, useMemo, useState } from "react";
import { supabase } from "../lib/supabase";
import {
  ShoppingCart,
  RefreshCw,
  Download,
  Search,
  CalendarDays,
  Users,
  Receipt,
  Wallet,
} from "lucide-react";

type SaleEntry = {
  entry_id: string;
  entry_no: string;
  entry_date: string;
  status: string;
  buyer_id: string;
  buyer_code: string;
  buyer_name: string;
  total_amount: number | string;
  seller_lines: unknown;
};

const money = (value: number) =>
  `৳${value.toLocaleString("en-BD", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;

const today = new Date().toLocaleDateString("en-CA", {
  timeZone: "Asia/Dhaka",
});

export default function Sales() {
  const [sales, setSales] = useState<SaleEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [search, setSearch] = useState("");
  const [fromDate, setFromDate] = useState("");
  const [toDate, setToDate] = useState(today);

  const loadSales = useCallback(async () => {
    setLoading(true);
    setError("");

    const { data, error } = await supabase
      .from("buyer_combined_slips")
      .select("*")
      .order("entry_date", { ascending: false });

    if (error) {
      setError(error.message);
      setSales([]);
    } else {
      setSales((data ?? []) as SaleEntry[]);
    }

    setLoading(false);
  }, []);

  useEffect(() => {
    loadSales();
  }, [loadSales]);

  const filteredSales = useMemo(() => {
    const query = search.trim().toLowerCase();

    return sales.filter((sale) => {
      const matchesSearch =
        !query ||
        sale.entry_no?.toLowerCase().includes(query) ||
        sale.buyer_name?.toLowerCase().includes(query) ||
        sale.buyer_code?.toLowerCase().includes(query);

      const matchesFrom = !fromDate || sale.entry_date >= fromDate;
      const matchesTo = !toDate || sale.entry_date <= toDate;

      return matchesSearch && matchesFrom && matchesTo;
    });
  }, [sales, search, fromDate, toDate]);

  const totals = useMemo(() => {
    return filteredSales.reduce(
      (acc, sale) => {
        acc.amount += Number(sale.total_amount || 0);
        acc.entries += 1;
        acc.buyers.add(sale.buyer_id);
        return acc;
      },
      {
        amount: 0,
        entries: 0,
        buyers: new Set<string>(),
      }
    );
  }, [filteredSales]);

  const exportCSV = () => {
    if (!filteredSales.length) return;

    const headers = [
      "Entry Number",
      "Date",
      "Buyer Code",
      "Buyer Name",
      "Total Amount",
      "Status",
    ];

    const data = filteredSales.map((sale) => [
      sale.entry_no,
      sale.entry_date,
      sale.buyer_code,
      sale.buyer_name,
      Number(sale.total_amount || 0).toFixed(2),
      sale.status,
    ]);

    const csv = [headers, ...data]
      .map((row) =>
        row
          .map((value) => `"${String(value ?? "").replace(/"/g, '""')}"`)
          .join(",")
      )
      .join("\n");

    const blob = new Blob(["\uFEFF" + csv], {
      type: "text/csv;charset=utf-8;",
    });

    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `pan-arot-sales-${today}.csv`;
    link.click();
    URL.revokeObjectURL(url);
  };

  const clearFilters = () => {
    setSearch("");
    setFromDate("");
    setToDate(today);
  };

  return (
    <div className="mx-auto w-full max-w-7xl space-y-6 p-4 sm:p-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <div className="flex items-center gap-2">
            <ShoppingCart className="h-6 w-6 text-green-700" />
            <h1 className="text-2xl font-bold text-gray-900">
              Sales / বিক্রির হিসাব
            </h1>
          </div>
          <p className="mt-1 text-sm text-gray-500">
            Buyer অনুযায়ী দৈনিক পান বিক্রির হিসাব দেখুন।
          </p>
        </div>

        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            onClick={loadSales}
            disabled={loading}
            className="inline-flex items-center gap-2 rounded-lg border border-gray-200 bg-white px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50 disabled:opacity-60"
          >
            <RefreshCw className={`h-4 w-4 ${loading ? "animate-spin" : ""}`} />
            Refresh
          </button>

          <button
            type="button"
            onClick={exportCSV}
            disabled={!filteredSales.length}
            className="inline-flex items-center gap-2 rounded-lg bg-green-700 px-4 py-2 text-sm font-medium text-white hover:bg-green-800 disabled:cursor-not-allowed disabled:opacity-50"
          >
            <Download className="h-4 w-4" />
            CSV Export
          </button>
        </div>
      </div>

      {error && (
        <div className="rounded-lg border border-red-200 bg-red-50 p-4 text-sm text-red-700">
          Sales লোড করতে সমস্যা হয়েছে: {error}
        </div>
      )}

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <div className="rounded-xl border border-gray-200 bg-white p-5 shadow-sm">
          <div className="flex items-center justify-between">
            <p className="text-sm text-gray-500">মোট Sales</p>
            <div className="rounded-lg bg-green-50 p-2 text-green-700">
              <Wallet className="h-5 w-5" />
            </div>
          </div>
          <p className="mt-3 text-2xl font-bold text-gray-900">
            {money(totals.amount)}
          </p>
        </div>

        <div className="rounded-xl border border-gray-200 bg-white p-5 shadow-sm">
          <div className="flex items-center justify-between">
            <p className="text-sm text-gray-500">মোট Entry</p>
            <div className="rounded-lg bg-blue-50 p-2 text-blue-700">
              <Receipt className="h-5 w-5" />
            </div>
          </div>
          <p className="mt-3 text-2xl font-bold text-gray-900">
            {totals.entries.toLocaleString("en-BD")}
          </p>
        </div>

        <div className="rounded-xl border border-gray-200 bg-white p-5 shadow-sm">
          <div className="flex items-center justify-between">
            <p className="text-sm text-gray-500">মোট Buyer</p>
            <div className="rounded-lg bg-purple-50 p-2 text-purple-700">
              <Users className="h-5 w-5" />
            </div>
          </div>
          <p className="mt-3 text-2xl font-bold text-gray-900">
            {totals.buyers.size.toLocaleString("en-BD")}
          </p>
        </div>
      </div>

      <section className="rounded-xl border border-gray-200 bg-white p-4 shadow-sm">
        <div className="mb-4 flex items-center gap-2">
          <CalendarDays className="h-5 w-5 text-green-700" />
          <h2 className="font-semibold text-gray-900">Sales Filter</h2>
        </div>

        <div className="grid grid-cols-1 gap-3 md:grid-cols-3">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Entry No / Buyer খুঁজুন"
              className="w-full rounded-lg border border-gray-300 py-2.5 pl-9 pr-3 text-sm outline-none focus:border-green-600"
            />
          </div>

          <input
            type="date"
            value={fromDate}
            onChange={(e) => setFromDate(e.target.value)}
            className="w-full rounded-lg border border-gray-300 px-3 py-2.5 text-sm outline-none focus:border-green-600"
            aria-label="শুরুর তারিখ"
          />

          <input
            type="date"
            value={toDate}
            onChange={(e) => setToDate(e.target.value)}
            className="w-full rounded-lg border border-gray-300 px-3 py-2.5 text-sm outline-none focus:border-green-600"
            aria-label="শেষ তারিখ"
          />
        </div>

        <div className="mt-3 flex justify-end">
          <button
            type="button"
            onClick={clearFilters}
            className="text-sm font-medium text-green-700 hover:text-green-900"
          >
            Filter Clear
          </button>
        </div>
      </section>

      <section className="overflow-hidden rounded-xl border border-gray-200 bg-white shadow-sm">
        <div className="flex flex-col gap-1 border-b border-gray-100 p-4 sm:flex-row sm:items-center sm:justify-between">
          <h2 className="font-semibold text-gray-900">Sales History</h2>
          <p className="text-xs text-gray-500">
            {filteredSales.length} টি Entry পাওয়া গেছে
          </p>
        </div>

        {loading ? (
          <div className="flex items-center justify-center gap-2 p-12 text-sm text-gray-500">
            <RefreshCw className="h-4 w-4 animate-spin" />
            Sales লোড হচ্ছে...
          </div>
        ) : filteredSales.length === 0 ? (
          <div className="p-12 text-center">
            <ShoppingCart className="mx-auto h-10 w-10 text-gray-300" />
            <p className="mt-3 font-medium text-gray-700">
              কোনো Sales Entry পাওয়া যায়নি
            </p>
            <p className="mt-1 text-sm text-gray-400">
              Search অথবা Date Filter পরিবর্তন করে দেখুন।
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[850px] text-left text-sm">
              <thead className="bg-gray-50 text-xs text-gray-500">
                <tr>
                  <th className="px-4 py-3">Entry No</th>
                  <th className="px-4 py-3">Date</th>
                  <th className="px-4 py-3">Buyer Code</th>
                  <th className="px-4 py-3">Buyer Name</th>
                  <th className="px-4 py-3 text-right">Total Amount</th>
                  <th className="px-4 py-3 text-center">Status</th>
                </tr>
              </thead>

              <tbody className="divide-y divide-gray-100">
                {filteredSales.map((sale) => (
                  <tr
                    key={sale.entry_id}
                    className="transition hover:bg-gray-50"
                  >
                    <td className="whitespace-nowrap px-4 py-3 font-semibold text-green-700">
                      {sale.entry_no}
                    </td>
                    <td className="whitespace-nowrap px-4 py-3 text-gray-600">
                      {sale.entry_date}
                    </td>
                    <td className="px-4 py-3 text-gray-600">
                      {sale.buyer_code}
                    </td>
                    <td className="px-4 py-3 font-medium text-gray-900">
                      {sale.buyer_name}
                    </td>
                    <td className="whitespace-nowrap px-4 py-3 text-right font-semibold text-gray-900">
                      {money(Number(sale.total_amount || 0))}
                    </td>
                    <td className="px-4 py-3 text-center">
                      <span
                        className={`inline-flex rounded-full px-2.5 py-1 text-xs font-medium ${
                          sale.status === "posted"
                            ? "bg-green-50 text-green-700"
                            : "bg-gray-100 text-gray-600"
                        }`}
                      >
                        {sale.status === "posted" ? "Posted" : sale.status}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>

              <tfoot className="bg-green-50">
                <tr>
                  <td
                    colSpan={4}
                    className="px-4 py-3 font-bold text-gray-900"
                  >
                    সর্বমোট
                  </td>
                  <td className="px-4 py-3 text-right font-bold text-green-800">
                    {money(totals.amount)}
                  </td>
                  <td />
                </tr>
              </tfoot>
            </table>
          </div>
        )}
      </section>
    </div>
  );
}
