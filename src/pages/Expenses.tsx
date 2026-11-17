
import {
  useCallback,
  useEffect,
  useMemo,
  useState,
  type FormEvent,
} from "react";

import {
  Plus,
  Search,
  Wallet,
  CalendarDays,
  Pencil,
  Trash2,
  X,
  RefreshCw,
  Receipt,
  AlertCircle,
  CheckCircle2,
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
  created_by?: string | null;
};

type ExpenseForm = {
  expense_date: string;
  category: string;
  description: string;
  amount: string;
  payment_method: string;
  reference_no: string;
  notes: string;
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

const getToday = () => {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Dhaka",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date());

  return parts;
};

const money = (value: number) =>
  `৳${Number(value || 0).toLocaleString("en-BD", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;

const createInitialForm = (): ExpenseForm => ({
  expense_date: getToday(),
  category: "অন্যান্য",
  description: "",
  amount: "",
  payment_method: "Cash",
  reference_no: "",
  notes: "",
});

const cardClass =
  "rounded-2xl border border-gray-200 bg-white shadow-sm dark:border-gray-700 dark:bg-gray-900";

const inputClass =
  "mt-2 w-full rounded-xl border border-gray-300 bg-white px-3 py-3 text-sm text-gray-900 outline-none transition placeholder:text-gray-400 focus:border-green-600 focus:ring-2 focus:ring-green-100 dark:border-gray-600 dark:bg-gray-800 dark:text-gray-100 dark:placeholder:text-gray-500 dark:focus:border-green-500 dark:focus:ring-green-900/30";

const labelClass =
  "block text-sm font-medium text-gray-700 dark:text-gray-300";

const mutedClass = "text-gray-500 dark:text-gray-400";

export default function Expenses() {
  const [expenses, setExpenses] = useState<Expense[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  const [search, setSearch] = useState("");
  const [month, setMonth] = useState(getToday().slice(0, 7));

  const [showModal, setShowModal] = useState(false);
  const [editing, setEditing] = useState<string | null>(null);

  const [form, setForm] = useState<ExpenseForm>(createInitialForm);
  const [errorMessage, setErrorMessage] = useState("");
  const [successMessage, setSuccessMessage] = useState("");

  // Load expenses for selected month
  const loadExpenses = useCallback(async () => {
    setLoading(true);
    setErrorMessage("");

    try {
      const [year, monthNumber] = month.split("-").map(Number);

      const lastDay = new Date(year, monthNumber, 0).getDate();

      const startDate = `${month}-01`;
      const endDate = `${month}-${String(lastDay).padStart(2, "0")}`;

      const { data, error } = await supabase
        .from("expenses")
        .select(
          "id, expense_date, category, description, amount, payment_method, reference_no, notes, created_by"
        )
        .gte("expense_date", startDate)
        .lte("expense_date", endDate)
        .order("expense_date", { ascending: false });

      if (error) throw error;

      setExpenses((data ?? []) as Expense[]);
    } catch (error) {
      const message =
        error instanceof Error ? error.message : "খরচ লোড করা যায়নি";

      setErrorMessage(message);
      setExpenses([]);
    } finally {
      setLoading(false);
    }
  }, [month]);

  useEffect(() => {
    void loadExpenses();
  }, [loadExpenses]);

  // Search
  const filtered = useMemo(() => {
    const query = search.trim().toLowerCase();

    if (!query) return expenses;

    return expenses.filter((item) =>
      [
        item.category,
        item.description,
        item.reference_no,
        item.payment_method,
        item.expense_date,
      ].some((value) =>
        String(value ?? "").toLowerCase().includes(query)
      )
    );
  }, [expenses, search]);

  // Monthly total
  const total = useMemo(
    () => expenses.reduce((sum, item) => sum + Number(item.amount || 0), 0),
    [expenses]
  );

  // Today's total
  const todayTotal = useMemo(
    () =>
      expenses
        .filter((item) => item.expense_date === getToday())
        .reduce((sum, item) => sum + Number(item.amount || 0), 0),
    [expenses]
  );

  const openAdd = () => {
    setEditing(null);
    setForm(createInitialForm());
    setErrorMessage("");
    setSuccessMessage("");
    setShowModal(true);
  };

  const openEdit = (item: Expense) => {
    setEditing(item.id);

    setForm({
      expense_date: item.expense_date,
      category: item.category,
      description: item.description ?? "",
      amount: String(item.amount),
      payment_method: item.payment_method ?? "Cash",
      reference_no: item.reference_no ?? "",
      notes: item.notes ?? "",
    });

    setErrorMessage("");
    setSuccessMessage("");
    setShowModal(true);
  };

  const closeModal = () => {
    if (saving) return;

    setShowModal(false);
    setEditing(null);
    setForm(createInitialForm());
    setErrorMessage("");
  };

  // Save or update expense
  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();

    setErrorMessage("");
    setSuccessMessage("");

    const amount = Number(form.amount);

    if (!form.expense_date) {
      setErrorMessage("খরচের তারিখ নির্বাচন করুন।");
      return;
    }

    if (!form.category.trim()) {
      setErrorMessage("খরচের ক্যাটাগরি নির্বাচন করুন।");
      return;
    }

    if (!Number.isFinite(amount) || amount <= 0) {
      setErrorMessage("সঠিক খরচের পরিমাণ লিখুন।");
      return;
    }

    setSaving(true);

    try {
      const {
        data: { user },
        error: authError,
      } = await supabase.auth.getUser();

      if (authError) throw authError;

      if (!user) {
        throw new Error("আপনি লগইন করা নেই। আবার লগইন করুন।");
      }

      const payload = {
        expense_date: form.expense_date,
        category: form.category.trim(),
        description: form.description.trim() || null,
        amount,
        payment_method: form.payment_method,
        reference_no: form.reference_no.trim() || null,
        notes: form.notes.trim() || null,
        updated_at: new Date().toISOString(),
      };

      if (editing) {
        const { error } = await supabase
          .from("expenses")
          .update(payload)
          .eq("id", editing);

        if (error) throw error;

        setSuccessMessage("খরচ সফলভাবে আপডেট হয়েছে।");
      } else {
        const { error } = await supabase.from("expenses").insert({
          ...payload,
          created_by: user.id,
        });

        if (error) throw error;

        setSuccessMessage("খরচ সফলভাবে সংরক্ষণ হয়েছে।");
      }

      setShowModal(false);
      setEditing(null);
      setForm(createInitialForm());

      await loadExpenses();
    } catch (error) {
      const message =
        error instanceof Error ? error.message : "খরচ সংরক্ষণ করা যায়নি";

      setErrorMessage(message);
    } finally {
      setSaving(false);
    }
  };

  // Delete expense
  const removeExpense = async (id: string) => {
    const confirmed = window.confirm("এই খরচটি মুছে ফেলতে চান?");

    if (!confirmed) return;

    setDeletingId(id);
    setErrorMessage("");
    setSuccessMessage("");

    try {
      const { error } = await supabase
        .from("expenses")
        .delete()
        .eq("id", id);

      if (error) throw error;

      setSuccessMessage("খরচের রেকর্ড মুছে ফেলা হয়েছে।");
      await loadExpenses();
    } catch (error) {
      const message =
        error instanceof Error ? error.message : "খরচ মুছে ফেলা যায়নি";

      setErrorMessage(message);
    } finally {
      setDeletingId(null);
    }
  };

  return (
    <div className="min-h-full space-y-6 text-gray-900 transition-colors dark:text-gray-100">
      {/* Header */}
      <div className="rounded-2xl bg-gradient-to-r from-green-700 to-emerald-600 p-6 text-white shadow-sm sm:p-8">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div>
            <p className="text-sm text-green-100">
              ব্যবসার আর্থিক হিসাব
            </p>

            <h1 className="mt-1 text-2xl font-bold sm:text-3xl">
              Expenses
            </h1>

            <p className="mt-2 text-sm text-green-100">
              দৈনিক ব্যবসার খরচ পরিচালনা করুন
            </p>
          </div>

          <button
            type="button"
            onClick={openAdd}
            className="flex items-center gap-2 rounded-xl bg-white px-5 py-3 font-semibold text-green-700 transition hover:bg-green-50"
          >
            <Plus size={18} />
            খরচ যোগ করুন
          </button>
        </div>
      </div>

      {/* Feedback messages */}
      {errorMessage && !showModal && (
        <div className="flex items-start gap-2 rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-700 dark:border-red-900/60 dark:bg-red-950/40 dark:text-red-300">
          <AlertCircle size={18} className="mt-0.5 shrink-0" />
          <span>{errorMessage}</span>
        </div>
      )}

      {successMessage && (
        <div className="flex items-start gap-2 rounded-xl border border-green-200 bg-green-50 p-4 text-sm text-green-700 dark:border-green-900/60 dark:bg-green-950/40 dark:text-green-300">
          <CheckCircle2 size={18} className="mt-0.5 shrink-0" />
          <span>{successMessage}</span>
        </div>
      )}

      {/* Summary cards */}
      <div className="grid gap-4 sm:grid-cols-2">
        <div className={`${cardClass} p-5`}>
          <div className="flex items-center justify-between">
            <p className={`text-sm ${mutedClass}`}>
              এই মাসের মোট খরচ
            </p>

            <div className="rounded-xl bg-red-50 p-2.5 text-red-600 dark:bg-red-950/40 dark:text-red-400">
              <Wallet size={21} />
            </div>
          </div>

          <h2 className="mt-3 text-2xl font-bold text-red-600 dark:text-red-400">
            {money(total)}
          </h2>

          <p className={`mt-1 text-xs ${mutedClass}`}>
            {expenses.length} টি খরচের রেকর্ড
          </p>
        </div>

        <div className={`${cardClass} p-5`}>
          <div className="flex items-center justify-between">
            <p className={`text-sm ${mutedClass}`}>
              আজকের খরচ
            </p>

            <div className="rounded-xl bg-green-50 p-2.5 text-green-600 dark:bg-green-950/40 dark:text-green-400">
              <CalendarDays size={21} />
            </div>
          </div>

          <h2 className="mt-3 text-2xl font-bold text-gray-900 dark:text-gray-100">
            {money(todayTotal)}
          </h2>

          <p className={`mt-1 text-xs ${mutedClass}`}>
            আজকের মোট ব্যয়
          </p>
        </div>
      </div>

      {/* Search and filter */}
      <section className={`${cardClass} space-y-4 p-4 sm:p-5`}>
        <div className="flex flex-col gap-3 sm:flex-row">
          <div className="relative flex-1">
            <Search
              className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400"
              size={18}
            />

            <input
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              placeholder="খরচ খুঁজুন..."
              className={`${inputClass} mt-0 pl-10`}
            />
          </div>

          <input
            type="month"
            value={month}
            onChange={(event) => setMonth(event.target.value)}
            className={`${inputClass} mt-0 sm:w-auto`}
          />

          <button
            type="button"
            onClick={() => void loadExpenses()}
            disabled={loading}
            className="flex items-center justify-center gap-2 rounded-xl border border-gray-300 bg-white px-4 py-3 text-sm font-medium text-gray-700 transition hover:bg-gray-50 disabled:opacity-50 dark:border-gray-600 dark:bg-gray-800 dark:text-gray-200 dark:hover:bg-gray-700"
          >
            <RefreshCw
              size={17}
              className={loading ? "animate-spin" : ""}
            />
            Refresh
          </button>
        </div>

        {/* Expenses table */}
        <div className="overflow-x-auto rounded-xl border border-gray-200 dark:border-gray-700">
          <table className="w-full min-w-[850px] text-left text-sm">
            <thead className="bg-gray-50 text-gray-600 dark:bg-gray-800 dark:text-gray-300">
              <tr>
                <th className="px-4 py-4 font-semibold">তারিখ</th>
                <th className="px-4 py-4 font-semibold">ক্যাটাগরি</th>
                <th className="px-4 py-4 font-semibold">বিবরণ</th>
                <th className="px-4 py-4 font-semibold">পেমেন্ট</th>
                <th className="px-4 py-4 text-right font-semibold">
                  পরিমাণ
                </th>
                <th className="px-4 py-4 text-center font-semibold">
                  Action
                </th>
              </tr>
            </thead>

            <tbody className="divide-y divide-gray-100 dark:divide-gray-700">
              {loading ? (
                <tr>
                  <td
                    colSpan={6}
                    className={`py-12 text-center ${mutedClass}`}
                  >
                    <RefreshCw
                      size={20}
                      className="mx-auto mb-2 animate-spin"
                    />
                    খরচের হিসাব লোড হচ্ছে...
                  </td>
                </tr>
              ) : filtered.length === 0 ? (
                <tr>
                  <td colSpan={6} className="py-12 text-center">
                    <Receipt className="mx-auto mb-2 text-gray-300 dark:text-gray-600" size={32} />
                    <p className={mutedClass}>
                      কোনো খরচ পাওয়া যায়নি
                    </p>
                  </td>
                </tr>
              ) : (
                filtered.map((item) => (
                  <tr
                    key={item.id}
                    className="text-gray-700 transition hover:bg-gray-50 dark:text-gray-300 dark:hover:bg-gray-800/70"
                  >
                    <td className="whitespace-nowrap px-4 py-4">
                      {item.expense_date}
                    </td>

                    <td className="px-4 py-4 font-medium text-gray-800 dark:text-gray-200">
                      {item.category}
                    </td>

                    <td className="px-4 py-4">
                      {item.description || "-"}
                    </td>

                    <td className="px-4 py-4">
                      {item.payment_method || "-"}
                    </td>

                    <td className="whitespace-nowrap px-4 py-4 text-right font-semibold text-red-600 dark:text-red-400">
                      {money(Number(item.amount))}
                    </td>

                    <td className="px-4 py-4">
                      <div className="flex justify-center gap-2">
                        <button
                          type="button"
                          onClick={() => openEdit(item)}
                          title="Edit"
                          className="rounded-lg p-2 text-blue-600 transition hover:bg-blue-50 dark:text-blue-400 dark:hover:bg-blue-950/40"
                        >
                          <Pencil size={16} />
                        </button>

                        <button
                          type="button"
                          onClick={() => void removeExpense(item.id)}
                          disabled={deletingId === item.id}
                          title="Delete"
                          className="rounded-lg p-2 text-red-600 transition hover:bg-red-50 disabled:opacity-50 dark:text-red-400 dark:hover:bg-red-950/40"
                        >
                          {deletingId === item.id ? (
                            <RefreshCw size={16} className="animate-spin" />
                          ) : (
                            <Trash2 size={16} />
                          )}
                        </button>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>

            {!loading && filtered.length > 0 && (
              <tfoot className="border-t border-gray-200 bg-gray-50 dark:border-gray-700 dark:bg-gray-800">
                <tr>
                  <td
                    colSpan={4}
                    className="px-4 py-4 font-bold text-gray-800 dark:text-gray-100"
                  >
                    দেখানো রেকর্ডের মোট
                  </td>

                  <td className="px-4 py-4 text-right font-bold text-red-600 dark:text-red-400">
                    {money(
                      filtered.reduce(
                        (sum, item) => sum + Number(item.amount || 0),
                        0
                      )
                    )}
                  </td>

                  <td />
                </tr>
              </tfoot>
            )}
          </table>
        </div>
      </section>

      {/* Add/Edit Modal */}
      {showModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center overflow-y-auto bg-black/60 p-3 backdrop-blur-sm sm:p-5">
          <form
            onSubmit={handleSubmit}
            className="my-auto max-h-[94vh] w-full max-w-xl space-y-4 overflow-y-auto rounded-2xl border border-gray-200 bg-white p-5 shadow-2xl dark:border-gray-700 dark:bg-gray-900 sm:p-6"
          >
            <div className="flex items-center justify-between">
              <div>
                <h2 className="text-xl font-bold text-gray-900 dark:text-gray-100">
                  {editing ? "খরচ Edit করুন" : "নতুন খরচ যোগ করুন"}
                </h2>

                <p className={`mt-1 text-xs ${mutedClass}`}>
                  খরচের তথ্য পূরণ করে সংরক্ষণ করুন
                </p>
              </div>

              <button
                type="button"
                onClick={closeModal}
                disabled={saving}
                className="rounded-lg p-2 text-gray-500 transition hover:bg-gray-100 dark:text-gray-400 dark:hover:bg-gray-800"
              >
                <X size={21} />
              </button>
            </div>

            {errorMessage && (
              <div className="flex items-start gap-2 rounded-xl border border-red-200 bg-red-50 p-3 text-sm text-red-700 dark:border-red-900/60 dark:bg-red-950/40 dark:text-red-300">
                <AlertCircle size={18} className="mt-0.5 shrink-0" />
                <span>{errorMessage}</span>
              </div>
            )}

            <div className="grid gap-4 sm:grid-cols-2">
              <label className={labelClass}>
                তারিখ
                <input
                  required
                  type="date"
                  value={form.expense_date}
                  onChange={(event) =>
                    setForm((previous) => ({
                      ...previous,
                      expense_date: event.target.value,
                    }))
                  }
                  className={inputClass}
                />
              </label>

              <label className={labelClass}>
                ক্যাটাগরি
                <select
                  required
                  value={form.category}
                  onChange={(event) =>
                    setForm((previous) => ({
                      ...previous,
                      category: event.target.value,
                    }))
                  }
                  className={inputClass}
                >
                  {categories.map((category) => (
                    <option key={category} value={category}>
                      {category}
                    </option>
                  ))}
                </select>
              </label>

              <label className={labelClass}>
                পরিমাণ (৳)
                <input
                  required
                  type="number"
                  min="0.01"
                  step="0.01"
                  value={form.amount}
                  onChange={(event) =>
                    setForm((previous) => ({
                      ...previous,
                      amount: event.target.value,
                    }))
                  }
                  placeholder="0.00"
                  className={inputClass}
                />
              </label>

              <label className={labelClass}>
                পেমেন্ট পদ্ধতি
                <select
                  value={form.payment_method}
                  onChange={(event) =>
                    setForm((previous) => ({
                      ...previous,
                      payment_method: event.target.value,
                    }))
                  }
                  className={inputClass}
                >
                  <option value="Cash">Cash</option>
                  <option value="bKash">bKash</option>
                  <option value="Nagad">Nagad</option>
                  <option value="Bank">Bank</option>
                  <option value="Other">Other</option>
                </select>
              </label>
            </div>

            <label className={labelClass}>
              বিবরণ
              <input
                value={form.description}
                onChange={(event) =>
                  setForm((previous) => ({
                    ...previous,
                    description: event.target.value,
                  }))
                }
                placeholder="খরচের বিবরণ"
                className={inputClass}
              />
            </label>

            <label className={labelClass}>
              Reference No
              <input
                value={form.reference_no}
                onChange={(event) =>
                  setForm((previous) => ({
                    ...previous,
                    reference_no: event.target.value,
                  }))
                }
                placeholder="Reference number (optional)"
                className={inputClass}
              />
            </label>

            <label className={labelClass}>
              নোট
              <textarea
                value={form.notes}
                onChange={(event) =>
                  setForm((previous) => ({
                    ...previous,
                    notes: event.target.value,
                  }))
                }
                rows={3}
                placeholder="অতিরিক্ত তথ্য (ঐচ্ছিক)"
                className={inputClass}
              />
            </label>

            <div className="flex flex-col-reverse gap-3 pt-2 sm:flex-row">
              <button
                type="button"
                onClick={closeModal}
                disabled={saving}
                className="flex-1 rounded-xl border border-gray-300 px-4 py-3 font-semibold text-gray-700 transition hover:bg-gray-50 disabled:opacity-50 dark:border-gray-600 dark:text-gray-200 dark:hover:bg-gray-800"
              >
                বাতিল
              </button>

              <button
                type="submit"
                disabled={saving}
                className="flex flex-1 items-center justify-center gap-2 rounded-xl bg-green-700 px-4 py-3 font-semibold text-white transition hover:bg-green-800 disabled:cursor-not-allowed disabled:opacity-60"
              >
                {saving && <RefreshCw size={17} className="animate-spin" />}

                {saving
                  ? "সংরক্ষণ হচ্ছে..."
                  : editing
                    ? "আপডেট করুন"
                    : "খরচ সংরক্ষণ করুন"}
              </button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
}
