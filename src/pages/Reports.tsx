
import { useCallback, useEffect, useMemo, useState } from "react";
import { supabase } from "../lib/supabase";
import {
  RefreshCw,
  Download,
  CalendarDays,
  FileBarChart,
  ShoppingBasket,
  Percent,
  Receipt,
  Wallet,
  Search,
} from "lucide-react";

type DailySummary = {
  entry_date: string;
  total_entries: number;
  total_seller_lines: number;
  total_purchase: string | number;
  total_commission: string | number;
  total_slip_cost: string | number;
  total_seller_payable: string | number;
};

type Period = "daily" | "monthly" | "yearly";

const money = (value: number) =>
  `৳${value.toLocaleString("en-BD", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;

const number = (value: string | number | null | undefined) =>
  Number(value ?? 0);

const today = new Date().toLocaleDateString("en-CA", {
  timeZone: "Asia/Dhaka",
});

export default function Reports() {
  const [rows, setRows] = useState<DailySummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [period, setPeriod] = useState<Period>("daily");
  const [selectedDate, setSelectedDate] = useState(today);
  const [selectedMonth, setSelectedMonth] = useState(today.slice(0, 7));
  const [selectedYear, setSelectedYear] = useState(today.slice(0, 4));
  const [search, setSearch] = useState("");

  const loadReports = useCallback(async () => {
    setLoading(true);
    setError("");

    const { data, error } = await supabase
      .from("pan_daily_summary")
      .select("*")
      .order("entry_date", { ascending: false });

    if (error) {
      setError(error.message);
      setRows([]);
    } else {
      setRows((data ?? []) as DailySummary[]);
    }

    setLoading(false);
  }, []);

  useEffect(() => {
    loadReports();
  }, [loadReports]);

  const filteredRows = useMemo(() => {
    return rows.filter((row) => {
      if (period === "daily") return row.entry_date === selectedDate;
      if (period === "monthly")
        return row.entry_date.startsWith(selectedMonth);
      return row.entry_date.startsWith(selectedYear);
    });
  }, [rows, period, selectedDate, selectedMonth, selectedYear]);

  const totals = useMemo(() => {
    return filteredRows.reduce(
      (acc, row) => ({
        entries: acc.entries + number(row.total_entries),
        slips: acc.slips + number(row.total_seller_lines),
        purchase: acc.purchase + number(row.total_purchase),
        commission: acc.commission + number(row.total_commission),
        slipCost: acc.slipCost + number(row.total_slip_cost),
        payable: acc.payable + number(row.total_seller_payable),
      }),
      {
        entries: 0,
        slips: 0,
        purchase: 0,
        commission: 0,
        slipCost: 0,
        payable: 0,
      }
    );
  }, [filteredRows]);

  const visibleRows = useMemo(() => {
    const query = search.trim().toLowerCase();
    if (!query) return filteredRows;

    return filteredRows.filter((row) =>
      row.entry_date.toLowerCase().includes(query)
    );
  }, [filteredRows, search]);

  const periodLabel =
    period === "daily"
      ? selectedDate
      : period === "monthly"
        ? selectedMonth
        : selectedYear;

  const exportCSV = () => {
    if (!filteredRows.length) return;

    const headers = [
      "Date",
      "Total Entries",
      "Seller Slips",
      "Total Purchase",
      "Commission",
      "Slip Cost",
      "Seller Payable",
    ];

    const csvRows = filteredRows.map((row) => [
      row.entry_date,
      row.total_entries,
      row.total_seller_lines,
      number(row.total_purchase).toFixed(2),
      number(row.total_commission).toFixed(2),
      number(row.total_slip_cost).toFixed(2),
      number(row.total_seller_payable).toFixed(2),
    ]);

    const csv = [headers, ...csvRows]
      .map((line) => line.map((value) => `"${String(value).replace(/"/g, '""')}"`).join(","))
      .join("\n");

    const blob = new Blob(["\uFEFF" + csv], {
      type: "text/csv;charset=utf-8;",
    });

    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `pan-arot-report-${periodLabel}.csv`;
    link.click();
    URL.revokeObjectURL(url);
  };

  const cards = [
    {
      title: "মোট Purchase",
      value: money(totals.purchase),
      icon: ShoppingBasket,
      color: "bg-blue-50 text-blue-700",
    },
    {
      title: "মোট Commission",
      value: money(totals.commission),
      icon: Percent,
      color: "bg-purple-50 text-purple-700",
    },
    {
      title: "Slip Cost",
      value: money(totals.slipCost),
      icon: Receipt,
      color: "bg-orange-50 text-orange-700",
    },
    {
      title: "Seller Payable",
      value: money(totals.payable),
      icon: Wallet,
      color: "bg-green-50 text-green-700",
    },
  ];

  return (
    <div className="mx-auto w-full max-w-7xl space-y-6 p-4 sm:p-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <div className="flex items-center gap-2">
            <FileBarChart className="h-6 w-6 text-green-700" />
            <h1 className="text-2xl font-bold text-gray-900">রিপোর্ট</h1>
          </div>
          <p className="mt-1 text-sm text-gray-500">
            আপনার পান আরতের দৈনিক, মাসিক ও বার্ষিক হিসাব।
          </p>
        </div>

        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            onClick={loadReports}
            disabled={loading}
            className="inline-flex items-center gap-2 rounded-lg border border-gray-200 bg-white px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50 disabled:opacity-60"
          >
            <RefreshCw className={`h-4 w-4 ${loading ? "animate-spin" : ""}`} />
            রিফ্রেশ
          </button>

          <button
            type="button"
            onClick={exportCSV}
            disabled={!filteredRows.length}
            className="inline-flex items-center gap-2 rounded-lg bg-green-700 px-4 py-2 text-sm font-medium text-white hover:bg-green-800 disabled:cursor-not-allowed disabled:opacity-50"
          >
            <Download className="h-4 w-4" />
            CSV Export
          </button>
        </div>
      </div>

      {error && (
        <div className="rounded-lg border border-red-200 bg-red-50 p-4 text-sm text-red-700">
          রিপোর্ট লোড করতে সমস্যা হয়েছে: {error}
        </div>
      )}

      <section className="rounded-xl border border-gray-200 bg-white p-4 shadow-sm">
        <div className="mb-4 flex items-center gap-2">
          <CalendarDays className="h-5 w-5 text-green-700" />
          <h2 className="font-semibold text-gray-900">রিপোর্টের সময় নির্বাচন</h2>
        </div>

        <div className="flex flex-wrap gap-2">
          {([
            ["daily", "দৈনিক"],
            ["monthly", "মাসিক"],
            ["yearly", "বার্ষিক"],
          ] as [Period, string][]).map(([value, label]) => (
            <button
              key={value}
              type="button"
              onClick={() => setPeriod(value)}
              className={`rounded-lg px-5 py-2.5 text-sm font-medium transition ${
                period === value
                  ? "bg-green-700 text-white"
                  : "bg-gray-100 text-gray-600 hover:bg-gray-200"
              }`}
            >
              {label}
            </button>
          ))}
        </div>

        <div className="mt-4 max-w-xs">
          {period === "daily" && (
            <input
              type="date"
              value={selectedDate}
              onChange={(e) => setSelectedDate(e.target.value)}
              className="w-full rounded-lg border border-gray-300 px-3 py-2.5 text-sm outline-none focus:border-green-600"
            />
          )}

          {period === "monthly" && (
            <input
              type="month"
              value={selectedMonth}
              onChange={(e) => setSelectedMonth(e.target.value)}
              className="w-full rounded-lg border border-gray-300 px-3 py-2.5 text-sm outline-none focus:border-green-600"
            />
          )}

          {period === "yearly" && (
            <select
              value={selectedYear}
              onChange={(e) => setSelectedYear(e.target.value)}
              className="w-full rounded-lg border border-gray-300 px-3 py-2.5 text-sm outline-none focus:border-green-600"
            >
              {Array.from({ length: 10 }, (_, i) =>
                String(Number(today.slice(0, 4)) - i)
              ).map((year) => (
                <option key={year} value={year}>
                  {year}
                </option>
              ))}
            </select>
          )}
        </div>
      </section>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {cards.map((card) => {
          const Icon = card.icon;
          return (
            <div
              key={card.title}
              className="rounded-xl border border-gray-200 bg-white p-5 shadow-sm"
            >
              <div className="flex items-center justify-between">
                <p className="text-sm text-gray-500">{card.title}</p>
                <div className={`rounded-lg p-2 ${card.color}`}>
                  <Icon className="h-5 w-5" />
                </div>
              </div>
              <p className="mt-3 text-xl font-bold text-gray-900">
                {card.value}
              </p>
            </div>
          );
        })}
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <div className="rounded-xl border border-gray-200 bg-white p-5 shadow-sm">
          <p className="text-sm text-gray-500">মোট Entry</p>
          <p className="mt-2 text-2xl font-bold text-gray-900">
            {totals.entries.toLocaleString("en-BD")}
          </p>
        </div>
        <div className="rounded-xl border border-gray-200 bg-white p-5 shadow-sm">
          <p className="text-sm text-gray-500">মোট Seller Slip</p>
          <p className="mt-2 text-2xl font-bold text-gray-900">
            {totals.slips.toLocaleString("en-BD")}
          </p>
        </div>
      </div>

      <section className="overflow-hidden rounded-xl border border-gray-200 bg-white shadow-sm">
        <div className="flex flex-col gap-3 border-b border-gray-100 p-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h2 className="font-semibold text-gray-900">বিস্তারিত রিপোর্ট</h2>
            <p className="mt-1 text-xs text-gray-500">
              নির্বাচিত সময়: {periodLabel}
            </p>
          </div>

          <div className="relative w-full sm:max-w-xs">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="তারিখ দিয়ে খুঁজুন..."
              className="w-full rounded-lg border border-gray-200 py-2 pl-9 pr-3 text-sm outline-none focus:border-green-600"
            />
          </div>
        </div>

        {loading ? (
          <div className="flex items-center justify-center gap-2 p-12 text-sm text-gray-500">
            <RefreshCw className="h-4 w-4 animate-spin" />
            রিপোর্ট লোড হচ্ছে...
          </div>
        ) : visibleRows.length === 0 ? (
          <div className="p-12 text-center">
            <FileBarChart className="mx-auto h-10 w-10 text-gray-300" />
            <p className="mt-3 font-medium text-gray-700">
              কোনো রিপোর্ট পাওয়া যায়নি
            </p>
            <p className="mt-1 text-sm text-gray-400">
              অন্য তারিখ বা সময় নির্বাচন করে দেখুন।
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[850px] text-left text-sm">
              <thead className="bg-gray-50 text-xs uppercase text-gray-500">
                <tr>
                  <th className="px-4 py-3">তারিখ</th>
                  <th className="px-4 py-3 text-center">Entry</th>
                  <th className="px-4 py-3 text-center">Slip</th>
                  <th className="px-4 py-3 text-right">Purchase</th>
                  <th className="px-4 py-3 text-right">Commission</th>
                  <th className="px-4 py-3 text-right">Slip Cost</th>
                  <th className="px-4 py-3 text-right">Seller Payable</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {visibleRows.map((row) => (
                  <tr key={row.entry_date} className="hover:bg-gray-50">
                    <td className="whitespace-nowrap px-4 py-3 font-medium text-gray-800">
                      {row.entry_date}
                    </td>
                    <td className="px-4 py-3 text-center">
                      {number(row.total_entries)}
                    </td>
                    <td className="px-4 py-3 text-center">
                      {number(row.total_seller_lines)}
                    </td>
                    <td className="whitespace-nowrap px-4 py-3 text-right font-medium">
                      {money(number(row.total_purchase))}
                    </td>
                    <td className="whitespace-nowrap px-4 py-3 text-right text-purple-700">
                      {money(number(row.total_commission))}
                    </td>
                    <td className="whitespace-nowrap px-4 py-3 text-right text-orange-700">
                      {money(number(row.total_slip_cost))}
                    </td>
                    <td className="whitespace-nowrap px-4 py-3 text-right font-semibold text-green-700">
                      {money(number(row.total_seller_payable))}
                    </td>
                  </tr>
                ))}
              </tbody>
              <tfoot className="bg-green-50 font-bold text-gray-900">
                <tr>
                  <td className="px-4 py-3">সর্বমোট</td>
                  <td className="px-4 py-3 text-center">
                    {totals.entries}
                  </td>
                  <td className="px-4 py-3 text-center">
                    {totals.slips}
                  </td>
                  <td className="px-4 py-3 text-right">
                    {money(totals.purchase)}
                  </td>
                  <td className="px-4 py-3 text-right">
                    {money(totals.commission)}
                  </td>
                  <td className="px-4 py-3 text-right">
                    {money(totals.slipCost)}
                  </td>
                  <td className="px-4 py-3 text-right text-green-700">
                    {money(totals.payable)}
                  </td>
                </tr>
              </tfoot>
            </table>
          </div>
        )}
      </section>
    </div>
  );
}
