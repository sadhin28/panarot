
import { useCallback, useEffect, useMemo, useState, type FormEvent } from "react";
import {
  Plus,
  Search,
  Wallet,
  CalendarDays,
  Pencil,
  Trash2,
  X,
  RefreshCw,
} from "lucide-react";
import { supabase } from "../lib/supabase";

type Expense = {
  id: string;
  expense_date: string;
  category: string;
  description: string | null;
  amount: number;
  payment_method: string | null;
  reference_no: string | null;
  notes: string | null;
};

const categories = [
  "দোকান ভাড়া",
  "বিদ্যুৎ বিল",
  "পরিবহন",
  "শ্রমিকের বেতন",
  "চা-নাস্তা",
  "মেরামত",
  "অন্যান্য",
];

const today = () => new Date().toLocaleDateString("en-CA");

const money = (value: number) =>
  `৳${Number(value || 0).toLocaleString("en-BD", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;

const initialForm = {
  expense_date: today(),
  category: "অন্যান্য",
  description: "",
  amount: "",
  payment_method: "Cash",
  reference_no: "",
  notes: "",
};

export default function Expenses() {
  const [expenses, setExpenses] = useState<Expense[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [search, setSearch] = useState("");
  const [month, setMonth] = useState(today().slice(0, 7));
  const [showModal, setShowModal] = useState(false);
  const [editing, setEditing] = useState<string | null>(null);
  const [form, setForm] = useState(initialForm);

  const loadExpenses = useCallback(async () => {
    setLoading(true);

    const start = `${month}-01`;

    const endDate = new Date(
      Number(month.slice(0, 4)),
      Number(month.slice(5, 7)),
      0
    );

    const end = endDate.toLocaleDateString("en-CA");

    const { data, error } = await supabase
      .from("expenses")
      .select("*")
      .gte("expense_date", start)
      .lte("expense_date", end)
      .order("expense_date", { ascending: false });

    if (error) {
      alert(error.message);
    } else {
      setExpenses((data || []) as Expense[]);
    }

    setLoading(false);
  }, [month]);

  useEffect(() => {
    loadExpenses();
  }, [loadExpenses]);

  const filtered = useMemo(() => {
    const q = search.toLowerCase();

    return expenses.filter((item) =>
      [item.category, item.description, item.reference_no].some((v) =>
        String(v || "").toLowerCase().includes(q)
      )
    );
  }, [expenses, search]);

  const total = expenses.reduce(
    (sum, item) => sum + Number(item.amount),
    0
  );

  const openAdd = () => {
    setEditing(null);
    setForm(initialForm);
    setShowModal(true);
  };

  const openEdit = (item: Expense) => {
    setEditing(item.id);

    setForm({
      expense_date: item.expense_date,
      category: item.category,
      description: item.description || "",
      amount: String(item.amount),
      payment_method: item.payment_method || "Cash",
      reference_no: item.reference_no || "",
      notes: item.notes || "",
    });

    setShowModal(true);
  };

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();

    if (Number(form.amount) <= 0) {
      alert("সঠিক খরচের পরিমাণ দিন");
      return;
    }

    setSaving(true);

    const { data: auth } = await supabase.auth.getUser();

    const payload = {
      expense_date: form.expense_date,
      category: form.category,
      description: form.description.trim() || null,
      amount: Number(form.amount),
      payment_method: form.payment_method,
      reference_no: form.reference_no.trim() || null,
      notes: form.notes.trim() || null,
      updated_at: new Date().toISOString(),
    };

    const result = editing
      ? await supabase
          .from("expenses")
          .update(payload)
          .eq("id", editing)
      : await supabase.from("expenses").insert({
          ...payload,
          created_by: auth.user?.id || null,
        });

    if (result.error) {
      alert(result.error.message);
    } else {
      setShowModal(false);
      setForm(initialForm);
      setEditing(null);
      await loadExpenses();
    }

    setSaving(false);
  };

  const removeExpense = async (id: string) => {
    if (!confirm("এই খরচটি মুছে ফেলতে চান?")) return;

    const { error } = await supabase
      .from("expenses")
      .delete()
      .eq("id", id);

    if (error) {
      alert(error.message);
    } else {
      await loadExpenses();
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="rounded-2xl bg-gradient-to-r from-green-700 to-emerald-600 p-6 sm:p-8 text-white">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div>
            <p className="text-green-100 text-sm">
              ব্যবসার আর্থিক হিসাব
            </p>

            <h1 className="text-2xl sm:text-3xl font-bold mt-1">
              Expenses
            </h1>

            <p className="text-green-100 text-sm mt-2">
              দৈনিক ব্যবসার খরচ পরিচালনা করুন
            </p>
          </div>

          <button
            onClick={openAdd}
            className="bg-white text-green-700 rounded-xl px-5 py-3 font-semibold flex items-center gap-2"
          >
            <Plus size={18} />
            খরচ যোগ করুন
          </button>
        </div>
      </div>

      {/* Summary Cards */}
      <div className="grid sm:grid-cols-2 gap-4">
        <div className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-2xl p-5">
          <div className="flex justify-between">
            <p className="text-sm text-gray-500">
              এই মাসের মোট খরচ
            </p>
            <Wallet className="text-red-500" />
          </div>

          <h2 className="text-2xl font-bold mt-3 text-red-600">
            {money(total)}
          </h2>

          <p className="text-xs text-gray-500 mt-1">
            {expenses.length} টি খরচের রেকর্ড
          </p>
        </div>

        <div className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-2xl p-5">
          <div className="flex justify-between">
            <p className="text-sm text-gray-500">
              আজকের খরচ
            </p>
            <CalendarDays className="text-green-600" />
          </div>

          <h2 className="text-2xl font-bold mt-3">
            {money(
              expenses
                .filter((x) => x.expense_date === today())
                .reduce((s, x) => s + Number(x.amount), 0)
            )}
          </h2>

          <p className="text-xs text-gray-500 mt-1">
            আজকের মোট ব্যয়
          </p>
        </div>
      </div>

      {/* Search and Filter */}
      <div className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-2xl p-4 sm:p-5 space-y-4">
        <div className="flex flex-col sm:flex-row gap-3">
          <div className="relative flex-1">
            <Search
              className="absolute left-3 top-3.5 text-gray-400"
              size={18}
            />

            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="খরচ খুঁজুন..."
              className="w-full border dark:border-gray-600 rounded-xl pl-10 pr-4 py-3 bg-transparent outline-none"
            />
          </div>

          <input
            type="month"
            value={month}
            onChange={(e) => setMonth(e.target.value)}
            className="border dark:border-gray-600 rounded-xl px-4 py-3 bg-transparent"
          />

          <button
            onClick={loadExpenses}
            className="border dark:border-gray-600 rounded-xl px-4 py-3 flex items-center justify-center gap-2"
          >
            <RefreshCw size={17} />
            Refresh
          </button>
        </div>

        {/* Expenses Table */}
        <div className="overflow-x-auto">
          <table className="w-full text-sm text-left">
            <thead className="bg-gray-50 dark:bg-gray-700/50 text-gray-500">
              <tr>
                <th className="px-3 py-4">তারিখ</th>
                <th className="px-3 py-4">ক্যাটাগরি</th>
                <th className="px-3 py-4">বিবরণ</th>
                <th className="px-3 py-4">পেমেন্ট</th>
                <th className="px-3 py-4 text-right">পরিমাণ</th>
                <th className="px-3 py-4 text-center">Action</th>
              </tr>
            </thead>

            <tbody className="divide-y dark:divide-gray-700">
              {loading ? (
                <tr>
                  <td colSpan={6} className="text-center py-10">
                    লোড হচ্ছে...
                  </td>
                </tr>
              ) : filtered.length === 0 ? (
                <tr>
                  <td
                    colSpan={6}
                    className="text-center py-10 text-gray-500"
                  >
                    কোনো খরচ পাওয়া যায়নি
                  </td>
                </tr>
              ) : (
                filtered.map((item) => (
                  <tr
                    key={item.id}
                    className="hover:bg-gray-50 dark:hover:bg-gray-700/30"
                  >
                    <td className="px-3 py-4 whitespace-nowrap">
                      {item.expense_date}
                    </td>

                    <td className="px-3 py-4">
                      {item.category}
                    </td>

                    <td className="px-3 py-4">
                      {item.description || "-"}
                    </td>

                    <td className="px-3 py-4">
                      {item.payment_method || "-"}
                    </td>

                    <td className="px-3 py-4 text-right font-semibold text-red-600">
                      {money(item.amount)}
                    </td>

                    <td className="px-3 py-4">
                      <div className="flex justify-center gap-2">
                        <button
                          onClick={() => openEdit(item)}
                          className="p-2 rounded-lg text-blue-600 hover:bg-blue-50"
                        >
                          <Pencil size={16} />
                        </button>

                        <button
                          onClick={() => removeExpense(item.id)}
                          className="p-2 rounded-lg text-red-600 hover:bg-red-50"
                        >
                          <Trash2 size={16} />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Add/Edit Modal */}
      {showModal && (
        <div className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-4">
          <form
            onSubmit={handleSubmit}
            className="bg-white dark:bg-gray-800 w-full max-w-xl max-h-[90vh] overflow-y-auto rounded-2xl p-5 sm:p-6 space-y-4"
          >
            <div className="flex justify-between items-center">
              <h2 className="text-lg font-bold">
                {editing
                  ? "খরচ Edit করুন"
                  : "নতুন খরচ যোগ করুন"}
              </h2>

              <button
                type="button"
                onClick={() => setShowModal(false)}
              >
                <X />
              </button>
            </div>

            <div className="grid sm:grid-cols-2 gap-4">
              <label className="text-sm font-medium">
                তারিখ

                <input
                  required
                  type="date"
                  value={form.expense_date}
                  onChange={(e) =>
                    setForm({
                      ...form,
                      expense_date: e.target.value,
                    })
                  }
                  className="mt-2 w-full border dark:border-gray-600 rounded-xl px-3 py-3 bg-transparent"
                />
              </label>

              <label className="text-sm font-medium">
                ক্যাটাগরি

                <select
                  value={form.category}
                  onChange={(e) =>
                    setForm({
                      ...form,
                      category: e.target.value,
                    })
                  }
                  className="mt-2 w-full border dark:border-gray-600 rounded-xl px-3 py-3 bg-transparent"
                >
                  {categories.map((c) => (
                    <option key={c}>{c}</option>
                  ))}
                </select>
              </label>

              <label className="text-sm font-medium">
                পরিমাণ (৳)

                <input
                  required
                  type="number"
                  min="0.01"
                  step="0.01"
                  value={form.amount}
                  onChange={(e) =>
                    setForm({
                      ...form,
                      amount: e.target.value,
                    })
                  }
                  className="mt-2 w-full border dark:border-gray-600 rounded-xl px-3 py-3 bg-transparent"
                  placeholder="0.00"
                />
              </label>

              <label className="text-sm font-medium">
                পেমেন্ট পদ্ধতি

                <select
                  value={form.payment_method}
                  onChange={(e) =>
                    setForm({
                      ...form,
                      payment_method: e.target.value,
                    })
                  }
                  className="mt-2 w-full border dark:border-gray-600 rounded-xl px-3 py-3 bg-transparent"
                >
                  <option>Cash</option>
                  <option>bKash</option>
                  <option>Nagad</option>
                  <option>Bank</option>
                  <option>Other</option>
                </select>
              </label>
            </div>

            <label className="block text-sm font-medium">
              বিবরণ

              <input
                value={form.description}
                onChange={(e) =>
                  setForm({
                    ...form,
                    description: e.target.value,
                  })
                }
                className="mt-2 w-full border dark:border-gray-600 rounded-xl px-3 py-3 bg-transparent"
                placeholder="খরচের বিবরণ"
              />
            </label>

            <label className="block text-sm font-medium">
              Reference No

              <input
                value={form.reference_no}
                onChange={(e) =>
                  setForm({
                    ...form,
                    reference_no: e.target.value,
                  })
                }
                className="mt-2 w-full border dark:border-gray-600 rounded-xl px-3 py-3 bg-transparent"
              />
            </label>

            <label className="block text-sm font-medium">
              নোট

              <textarea
                value={form.notes}
                onChange={(e) =>
                  setForm({
                    ...form,
                    notes: e.target.value,
                  })
                }
                rows={2}
                className="mt-2 w-full border dark:border-gray-600 rounded-xl px-3 py-3 bg-transparent"
              />
            </label>

            <button
              disabled={saving}
              className="w-full bg-green-600 hover:bg-green-700 disabled:opacity-50 text-white rounded-xl py-3 font-semibold"
            >
              {saving
                ? "সংরক্ষণ হচ্ছে..."
                : editing
                  ? "আপডেট করুন"
                  : "খরচ সংরক্ষণ করুন"}
            </button>
          </form>
        </div>
      )}
    </div>
  );
}
