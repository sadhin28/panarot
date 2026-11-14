import {
  useCallback,
  useEffect,
  useMemo,
  useState,
  type FormEvent,
  type ReactNode,
} from "react";

import {
  ArrowDownLeft,
  ArrowUpRight,
  Banknote,
  CalendarDays,
  CheckCircle2,
  Clock,
  History,
  Loader2,
  Printer,
  RefreshCw,
  Search,
  Wallet,
  Gift,
} from "lucide-react";

import { supabase } from "../lib/supabase";

type Tab = "buyer" | "seller" | "discount";

type Buyer = {
  buyer_id: string;
  buyer_code: string;
  name: string;
  phone: string | null;
  opening_balance: number;
  total_purchases: number;
  total_collected: number;
  current_due: number;
};

type Seller = {
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

type MonthlyDiscount = {
  buyer_id: string;
  buyer_code: string;
  name: string;
  month_start: string;
  monthly_purchase: number;
  discount_percent: number;
  discount_earned: number;
  discount_paid: number;
  discount_remaining: number;
};

type Payment = {
  id: string;
  receipt_no: string;
  party_id: string;
  party_type: "buyer" | "seller" | "discount";
  party_name: string;
  payment_type: string;
  amount: number;
  payment_date: string;
  payment_method: string;
  reference_no: string | null;
  notes: string | null;
  created_at: string;
};

const money = (value: number | string | null | undefined) =>
  `৳${Number(value || 0).toLocaleString("en-BD", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;

const today = () => {
  const date = new Date();
  const offset = date.getTimezoneOffset();

  return new Date(date.getTime() - offset * 60000)
    .toISOString()
    .slice(0, 10);
};

const methodLabels: Record<string, string> = {
  cash: "নগদ",
  bank: "ব্যাংক",
  bkash: "বিকাশ",
  nagad: "নগদ (Nagad)",
  rocket: "রকেট",
  other: "অন্যান্য",
};

const formatMonth = (value: string) =>
  new Date(`${value}T00:00:00`).toLocaleDateString("bn-BD", {
    year: "numeric",
    month: "long",
  });

export default function Payments() {
  const [activeTab, setActiveTab] = useState<Tab>("buyer");

  const [buyers, setBuyers] = useState<Buyer[]>([]);
  const [sellers, setSellers] = useState<Seller[]>([]);
  const [discountRows, setDiscountRows] = useState<MonthlyDiscount[]>([]);
  const [payments, setPayments] = useState<Payment[]>([]);

  const [buyerId, setBuyerId] = useState("");
  const [sellerId, setSellerId] = useState("");
  const [discountBuyerId, setDiscountBuyerId] = useState("");
  const [discountMonth, setDiscountMonth] = useState("");

  const [amount, setAmount] = useState("");
  const [paymentDate, setPaymentDate] = useState(today());
  const [method, setMethod] = useState("cash");
  const [referenceNo, setReferenceNo] = useState("");
  const [notes, setNotes] = useState("");

  const [search, setSearch] = useState("");
  const [historySearch, setHistorySearch] = useState("");

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  // =========================================
  // LOAD DATA FROM SUPABASE
  // =========================================

  const loadData = useCallback(async () => {
    setLoading(true);
    setError("");

    try {
      const [
        buyerResult,
        sellerResult,
        discountResult,
        buyerPaymentsResult,
        sellerPaymentsResult,
        discountPaymentsResult,
      ] = await Promise.all([
        supabase
          .from("buyer_ledger_summary")
          .select("*")
          .order("name", { ascending: true }),

        supabase
          .from("seller_ledger_summary")
          .select("*")
          .order("name", { ascending: true }),

        supabase
          .from("buyer_monthly_discount_summary")
          .select("*")
          .order("month_start", { ascending: false }),

        supabase
          .from("buyer_collections")
          .select(
            "id, receipt_no, buyer_id, amount, payment_date, payment_method, reference_no, notes, created_at"
          )
          .order("payment_date", { ascending: false })
          .order("created_at", { ascending: false })
          .limit(200),

        supabase
          .from("seller_payments")
          .select(
            "id, receipt_no, seller_id, amount, payment_date, payment_method, reference_no, notes, created_at"
          )
          .order("payment_date", { ascending: false })
          .order("created_at", { ascending: false })
          .limit(200),

        supabase
          .from("buyer_discount_payments")
          .select(
            "id, receipt_no, buyer_id, month_start, amount, payment_date, payment_method, reference_no, notes, created_at"
          )
          .order("payment_date", { ascending: false })
          .order("created_at", { ascending: false })
          .limit(200),
      ]);

      if (buyerResult.error) throw buyerResult.error;
      if (sellerResult.error) throw sellerResult.error;
      if (discountResult.error) throw discountResult.error;
      if (buyerPaymentsResult.error) throw buyerPaymentsResult.error;
      if (sellerPaymentsResult.error) throw sellerPaymentsResult.error;
      if (discountPaymentsResult.error) throw discountPaymentsResult.error;

      const buyerData = (buyerResult.data || []) as Buyer[];
      const sellerData = (sellerResult.data || []) as Seller[];
      const discountData = (discountResult.data || []) as MonthlyDiscount[];

      setBuyers(buyerData);
      setSellers(sellerData);
      setDiscountRows(discountData);

      const buyerMap = new Map(
        buyerData.map((item) => [item.buyer_id, item.name])
      );

      const sellerMap = new Map(
        sellerData.map((item) => [item.seller_id, item.name])
      );

      const buyerPayments: Payment[] = (
        buyerPaymentsResult.data || []
      ).map((row: any) => ({
        id: row.id,
        receipt_no: row.receipt_no,
        party_id: row.buyer_id,
        party_type: "buyer",
        party_name: buyerMap.get(row.buyer_id) || "অজানা Buyer",
        payment_type: "Buyer থেকে গ্রহণ",
        amount: Number(row.amount || 0),
        payment_date: row.payment_date,
        payment_method: row.payment_method,
        reference_no: row.reference_no,
        notes: row.notes,
        created_at: row.created_at,
      }));

      const sellerPayments: Payment[] = (
        sellerPaymentsResult.data || []
      ).map((row: any) => ({
        id: row.id,
        receipt_no: row.receipt_no,
        party_id: row.seller_id,
        party_type: "seller",
        party_name: sellerMap.get(row.seller_id) || "অজানা Seller",
        payment_type: "Seller-কে প্রদান",
        amount: Number(row.amount || 0),
        payment_date: row.payment_date,
        payment_method: row.payment_method,
        reference_no: row.reference_no,
        notes: row.notes,
        created_at: row.created_at,
      }));

      const discountPayments: Payment[] = (
        discountPaymentsResult.data || []
      ).map((row: any) => ({
        id: row.id,
        receipt_no: row.receipt_no,
        party_id: row.buyer_id,
        party_type: "discount",
        party_name: buyerMap.get(row.buyer_id) || "অজানা Buyer",
        payment_type: `মাসিক Discount প্রদান (${formatMonth(
          row.month_start
        )})`,
        amount: Number(row.amount || 0),
        payment_date: row.payment_date,
        payment_method: row.payment_method,
        reference_no: row.reference_no,
        notes: row.notes,
        created_at: row.created_at,
      }));

      setPayments(
        [
          ...buyerPayments,
          ...sellerPayments,
          ...discountPayments,
        ].sort(
          (a, b) =>
            new Date(b.payment_date).getTime() -
              new Date(a.payment_date).getTime() ||
            new Date(b.created_at).getTime() -
              new Date(a.created_at).getTime()
        )
      );
    } catch (err) {
      console.error("Payment data loading error:", err);

      setError(
        err instanceof Error
          ? err.message
          : "ডেটা লোড করা যায়নি। আবার চেষ্টা করুন।"
      );
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadData();
  }, [loadData]);

  // =========================================
  // SELECTED DATA
  // =========================================

  const selectedBuyer = useMemo(
    () => buyers.find((buyer) => buyer.buyer_id === buyerId),
    [buyers, buyerId]
  );

  const selectedSeller = useMemo(
    () => sellers.find((seller) => seller.seller_id === sellerId),
    [sellers, sellerId]
  );

  const selectedDiscount = useMemo(
    () =>
      discountRows.find(
        (row) =>
          row.buyer_id === discountBuyerId &&
          row.month_start === discountMonth
      ),
    [discountRows, discountBuyerId, discountMonth]
  );

  const discountOptions = useMemo(
    () =>
      discountRows.filter(
        (row, index, array) =>
          array.findIndex(
            (item) =>
              item.buyer_id === row.buyer_id &&
              item.month_start === row.month_start
          ) === index
      ),
    [discountRows]
  );

  // =========================================
  // DASHBOARD TOTALS
  // =========================================

  const totalBuyerDue = buyers.reduce(
    (sum, buyer) => sum + Number(buyer.current_due || 0),
    0
  );

  const totalSellerDue = sellers.reduce(
    (sum, seller) => sum + Number(seller.current_due || 0),
    0
  );

  const todayPayments = payments.filter(
    (payment) => payment.payment_date === today()
  );

  const todayTotal = todayPayments.reduce(
    (sum, payment) => sum + Number(payment.amount || 0),
    0
  );

  // =========================================
  // SEARCH
  // =========================================

  const filteredParties = useMemo(() => {
    const list =
      activeTab === "buyer"
        ? buyers
        : activeTab === "seller"
          ? sellers
          : buyers;

    const keyword = search.trim().toLowerCase();

    if (!keyword) return list;

    return list.filter((item) => {
      const code =
        "buyer_code" in item ? item.buyer_code : item.seller_code;

      return (
        item.name.toLowerCase().includes(keyword) ||
        String(code || "").toLowerCase().includes(keyword) ||
        String(item.phone || "").toLowerCase().includes(keyword)
      );
    });
  }, [activeTab, buyers, sellers, search]);

  const filteredPayments = useMemo(() => {
    const keyword = historySearch.trim().toLowerCase();

    if (!keyword) return payments;

    return payments.filter(
      (payment) =>
        payment.party_name.toLowerCase().includes(keyword) ||
        payment.receipt_no.toLowerCase().includes(keyword) ||
        String(payment.reference_no || "")
          .toLowerCase()
          .includes(keyword) ||
        payment.payment_type.toLowerCase().includes(keyword)
    );
  }, [payments, historySearch]);

  // =========================================
  // RESET FORM
  // =========================================

  const resetForm = () => {
    setAmount("");
    setPaymentDate(today());
    setMethod("cash");
    setReferenceNo("");
    setNotes("");
  };

  // =========================================
  // SAVE PAYMENT
  // =========================================

  const handleSubmit = async (
    event: FormEvent<HTMLFormElement>
  ) => {
    event.preventDefault();

    setError("");
    setSuccess("");

    const numericAmount = Number(amount);

    if (!Number.isFinite(numericAmount) || numericAmount <= 0) {
      setError("সঠিক Payment Amount লিখুন।");
      return;
    }

    if (activeTab === "buyer" && !buyerId) {
      setError("একজন Buyer নির্বাচন করুন।");
      return;
    }

    if (activeTab === "seller" && !sellerId) {
      setError("একজন Seller নির্বাচন করুন।");
      return;
    }

    if (activeTab === "discount" && !selectedDiscount) {
      setError("যে Buyer-এর Discount দেবেন, তার মাস নির্বাচন করুন।");
      return;
    }

    const due =
      activeTab === "buyer"
        ? Number(selectedBuyer?.current_due || 0)
        : activeTab === "seller"
          ? Number(selectedSeller?.current_due || 0)
          : Number(selectedDiscount?.discount_remaining || 0);

    if (numericAmount > due + 0.001) {
      setError(
        `Payment Amount বকেয়ার চেয়ে বেশি হতে পারবে না। বকেয়া: ${money(
          due
        )}`
      );
      return;
    }

    setSaving(true);

    try {
      let result;

      // Buyer Payment
      if (activeTab === "buyer") {
        result = await supabase.rpc("receive_buyer_payment", {
          p_buyer_id: buyerId,
          p_amount: numericAmount,
          p_payment_date: paymentDate,
          p_payment_method: method,
          p_reference_no: referenceNo.trim() || null,
          p_notes: notes.trim() || null,
        });
      }

      // Seller Payment
      else if (activeTab === "seller") {
        result = await supabase.rpc("pay_pan_seller", {
          p_seller_id: sellerId,
          p_amount: numericAmount,
          p_payment_date: paymentDate,
          p_payment_method: method,
          p_reference_no: referenceNo.trim() || null,
          p_notes: notes.trim() || null,
          p_entry_line_id: null,
        });
      }

      // Monthly Discount Payment
      else {
        result = await supabase.rpc(
          "pay_buyer_monthly_discount",
          {
            p_buyer_id: discountBuyerId,
            p_month_start: discountMonth,
            p_amount: numericAmount,
            p_payment_date: paymentDate,
            p_payment_method: method,
            p_reference_no: referenceNo.trim() || null,
            p_notes: notes.trim() || null,
          }
        );
      }

      if (result.error) {
        throw result.error;
      }

      setSuccess(
        activeTab === "buyer"
          ? "Buyer-এর Payment সফলভাবে গ্রহণ করা হয়েছে।"
          : activeTab === "seller"
            ? "Seller-এর Payment সফলভাবে প্রদান করা হয়েছে।"
            : "Buyer-এর Monthly Discount Payment সংরক্ষণ হয়েছে।"
      );

      resetForm();

      await loadData();
    } catch (err) {
      console.error("Payment save error:", err);

      setError(
        err instanceof Error
          ? err.message
          : "Payment সংরক্ষণ করা যায়নি। আবার চেষ্টা করুন।"
      );
    } finally {
      setSaving(false);
    }
  };

  // =========================================
  // PRINT RECEIPT
  // =========================================

  const printReceipt = (payment: Payment) => {
    const escapeHtml = (value: string) =>
      value.replace(/[&<>"']/g, (char) => {
        const entities: Record<string, string> = {
          "&": "&amp;",
          "<": "&lt;",
          ">": "&gt;",
          '"': "&quot;",
          "'": "&#39;",
        };

        return entities[char];
      });

    const receiptWindow = window.open(
      "",
      "_blank",
      "width=700,height=750"
    );

    if (!receiptWindow) {
      setError("Receipt খুলতে পপ-আপ অনুমতি দিন।");
      return;
    }

    receiptWindow.document.write(`
      <!DOCTYPE html>
      <html lang="bn">
      <head>
        <meta charset="UTF-8" />
        <title>Payment Receipt - ${escapeHtml(
          payment.receipt_no
        )}</title>

        <style>
          body {
            font-family: Arial, sans-serif;
            padding: 35px;
            color: #222;
          }

          .receipt {
            max-width: 600px;
            margin: auto;
            border: 1px solid #ddd;
            padding: 28px;
          }

          h2 {
            text-align: center;
            margin-bottom: 5px;
          }

          .sub {
            text-align: center;
            color: #666;
            margin-bottom: 28px;
          }

          .amount {
            font-size: 26px;
            font-weight: bold;
            text-align: center;
            padding: 22px;
            background: #f0fdf4;
            margin: 20px 0;
          }

          .row {
            display: flex;
            justify-content: space-between;
            gap: 20px;
            padding: 12px 0;
            border-bottom: 1px solid #eee;
          }

          .label {
            color: #666;
          }

          .footer {
            text-align: center;
            margin-top: 35px;
            color: #777;
            font-size: 12px;
          }

          @media print {
            body {
              padding: 0;
            }

            .receipt {
              border: none;
            }
          }
        </style>
      </head>

      <body>
        <div class="receipt">
          <h2>Pan Arot Pro</h2>

          <div class="sub">Payment Receipt</div>

          <div class="amount">
            ${money(payment.amount)}
          </div>

          <div class="row">
            <span class="label">Receipt No.</span>
            <strong>${escapeHtml(payment.receipt_no)}</strong>
          </div>

          <div class="row">
            <span class="label">ধরন</span>
            <strong>${escapeHtml(payment.payment_type)}</strong>
          </div>

          <div class="row">
            <span class="label">নাম</span>
            <strong>${escapeHtml(payment.party_name)}</strong>
          </div>

          <div class="row">
            <span class="label">তারিখ</span>
            <strong>${escapeHtml(payment.payment_date)}</strong>
          </div>

          <div class="row">
            <span class="label">Method</span>
            <strong>
              ${escapeHtml(
                methodLabels[payment.payment_method] ||
                  payment.payment_method
              )}
            </strong>
          </div>

          <div class="row">
            <span class="label">Reference</span>
            <strong>${escapeHtml(
              payment.reference_no || "N/A"
            )}</strong>
          </div>

          <div class="row">
            <span class="label">Notes</span>
            <strong>${escapeHtml(payment.notes || "N/A")}</strong>
          </div>

          <div class="footer">
            ধন্যবাদ। আবার আসবেন।
          </div>
        </div>

        <script>
          window.onload = () => window.print();
        </script>
      </body>
      </html>
    `);

    receiptWindow.document.close();
  };

  // =========================================
  // STAT CARD
  // =========================================

  const statCard = (
    title: string,
    value: string,
    icon: ReactNode,
    color: string
  ) => (
    <div className="rounded-2xl border border-gray-200 bg-white p-4 shadow-sm dark:border-gray-800 dark:bg-gray-900">
      <div className="flex items-center justify-between gap-3">
        <div>
          <p className="text-sm text-gray-500 dark:text-gray-400">
            {title}
          </p>

          <p className="mt-2 text-xl font-bold text-gray-900 dark:text-white">
            {value}
          </p>
        </div>

        <div className={`rounded-xl p-3 ${color}`}>
          {icon}
        </div>
      </div>
    </div>
  );

  const tabs: {
    id: Tab;
    label: string;
    icon: ReactNode;
  }[] = [
    {
      id: "buyer",
      label: "Buyer থেকে গ্রহণ",
      icon: <ArrowDownLeft size={17} />,
    },
    {
      id: "seller",
      label: "Seller-কে প্রদান",
      icon: <ArrowUpRight size={17} />,
    },
    {
      id: "discount",
      label: "Discount প্রদান",
      icon: <Gift size={17} />,
    },
  ];

  // =========================================
  // PAGE UI
  // =========================================

  return (
    <div className="space-y-6 p-4 md:p-6">

      {/* PAGE HEADER */}

      <div className="flex flex-col justify-between gap-3 sm:flex-row sm:items-center">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white">
            পেমেন্ট ম্যানেজমেন্ট
          </h1>

          <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
            Buyer থেকে টাকা গ্রহণ, Seller-কে টাকা প্রদান এবং Monthly Discount পরিশোধ করুন।
          </p>
        </div>

        <button
          type="button"
          onClick={() => void loadData()}
          disabled={loading}
          className="inline-flex items-center justify-center gap-2 rounded-xl border border-gray-200 bg-white px-4 py-2.5 text-sm font-medium text-gray-700 hover:bg-gray-50 disabled:opacity-50 dark:border-gray-700 dark:bg-gray-900 dark:text-gray-200 dark:hover:bg-gray-800"
        >
          <RefreshCw
            size={16}
            className={loading ? "animate-spin" : ""}
          />

          Refresh
        </button>
      </div>

      {/* ERROR MESSAGE */}

      {error && (
        <div className="rounded-xl border border-red-200 bg-red-50 p-3 text-sm text-red-700 dark:border-red-900 dark:bg-red-950/40 dark:text-red-300">
          {error}
        </div>
      )}

      {/* SUCCESS MESSAGE */}

      {success && (
        <div className="flex items-center gap-2 rounded-xl border border-green-200 bg-green-50 p-3 text-sm text-green-700 dark:border-green-900 dark:bg-green-950/40 dark:text-green-300">
          <CheckCircle2 size={18} />
          {success}
        </div>
      )}

      {/* STAT CARDS */}

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-3">

        {statCard(
          "Buyer-এর মোট বকেয়া",
          money(totalBuyerDue),
          <ArrowDownLeft className="text-blue-600" size={22} />,
          "bg-blue-50 dark:bg-blue-950"
        )}

        {statCard(
          "Seller-এর মোট পাওনা",
          money(totalSellerDue),
          <ArrowUpRight className="text-orange-600" size={22} />,
          "bg-orange-50 dark:bg-orange-950"
        )}

        {statCard(
          "আজকের মোট Payment",
          money(todayTotal),
          <Wallet className="text-green-600" size={22} />,
          "bg-green-50 dark:bg-green-950"
        )}

      </div>

      {/* MAIN CONTENT */}

      <div className="grid grid-cols-1 gap-6 xl:grid-cols-5">

        {/* PAYMENT FORM */}

        <section className="space-y-5 rounded-2xl border border-gray-200 bg-white p-5 shadow-sm dark:border-gray-800 dark:bg-gray-900 xl:col-span-2">

          <div>
            <h2 className="text-lg font-bold text-gray-900 dark:text-white">
              নতুন Payment
            </h2>

            <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
              Payment-এর ধরন নির্বাচন করে তথ্য পূরণ করুন।
            </p>
          </div>

          {/* TABS */}

          <div className="grid grid-cols-1 gap-1 rounded-xl bg-gray-100 p-1 dark:bg-gray-800">

            {tabs.map((tab) => (
              <button
                key={tab.id}
                type="button"
                onClick={() => {
                  setActiveTab(tab.id);
                  setError("");
                  setSuccess("");
                  setAmount("");
                }}
                className={`flex items-center justify-center gap-2 rounded-lg px-3 py-2.5 text-sm font-semibold ${
                  activeTab === tab.id
                    ? "bg-white text-green-700 shadow-sm dark:bg-gray-700 dark:text-green-300"
                    : "text-gray-600 dark:text-gray-300"
                }`}
              >
                {tab.icon}
                {tab.label}
              </button>
            ))}

          </div>

          {/* FORM */}

          <form onSubmit={handleSubmit} className="space-y-4">

            {/* BUYER SELECT */}

            {activeTab === "buyer" && (
              <div>
                <label className="mb-1.5 block text-sm font-medium text-gray-700 dark:text-gray-300">
                  Buyer নির্বাচন করুন *
                </label>

                <select
                  value={buyerId}
                  onChange={(e) => setBuyerId(e.target.value)}
                  required
                  className="w-full rounded-xl border border-gray-300 bg-white px-3 py-3 text-sm outline-none focus:border-green-500 dark:border-gray-700 dark:bg-gray-800 dark:text-white"
                >
                  <option value="">
                    Buyer নির্বাচন করুন
                  </option>

                  {buyers.map((buyer) => (
                    <option
                      key={buyer.buyer_id}
                      value={buyer.buyer_id}
                    >
                      {buyer.buyer_code} — {buyer.name}
                    </option>
                  ))}
                </select>

                {selectedBuyer && (
                  <div className="mt-2 rounded-xl bg-blue-50 p-3 text-sm dark:bg-blue-950/40">

                    <div className="flex justify-between gap-2">
                      <span>মোট কেনাকাটা</span>
                      <strong>{money(selectedBuyer.total_purchases)}</strong>
                    </div>

                    <div className="mt-1 flex justify-between gap-2">
                      <span>জমা দিয়েছেন</span>
                      <strong>{money(selectedBuyer.total_collected)}</strong>
                    </div>

                    <div className="mt-2 flex justify-between gap-2 border-t border-blue-200 pt-2 dark:border-blue-900">
                      <strong>বর্তমান বকেয়া</strong>
                      <strong className="text-blue-700 dark:text-blue-300">
                        {money(selectedBuyer.current_due)}
                      </strong>
                    </div>

                  </div>
                )}
              </div>
            )}

            {/* SELLER SELECT */}

            {activeTab === "seller" && (
              <div>
                <label className="mb-1.5 block text-sm font-medium text-gray-700 dark:text-gray-300">
                  Seller নির্বাচন করুন *
                </label>

                <select
                  value={sellerId}
                  onChange={(e) => setSellerId(e.target.value)}
                  required
                  className="w-full rounded-xl border border-gray-300 bg-white px-3 py-3 text-sm outline-none focus:border-green-500 dark:border-gray-700 dark:bg-gray-800 dark:text-white"
                >
                  <option value="">
                    Seller নির্বাচন করুন
                  </option>

                  {sellers.map((seller) => (
                    <option
                      key={seller.seller_id}
                      value={seller.seller_id}
                    >
                      {seller.seller_code} — {seller.name}
                    </option>
                  ))}
                </select>

                {selectedSeller && (
                  <div className="mt-2 rounded-xl bg-orange-50 p-3 text-sm dark:bg-orange-950/40">

                    <div className="flex justify-between gap-2">
                      <span>মোট বিক্রি</span>
                      <strong>{money(selectedSeller.total_gross)}</strong>
                    </div>

                    <div className="mt-1 flex justify-between gap-2">
                      <span>মোট কমিশন</span>
                      <strong>{money(selectedSeller.total_commission)}</strong>
                    </div>

                    <div className="mt-1 flex justify-between gap-2">
                      <span>ইতিমধ্যে পরিশোধ</span>
                      <strong>{money(selectedSeller.total_paid)}</strong>
                    </div>

                    <div className="mt-2 flex justify-between gap-2 border-t border-orange-200 pt-2 dark:border-orange-900">
                      <strong>বর্তমান পাওনা</strong>
                      <strong className="text-orange-700 dark:text-orange-300">
                        {money(selectedSeller.current_due)}
                      </strong>
                    </div>

                  </div>
                )}
              </div>
            )}

            {/* DISCOUNT SELECT */}

            {activeTab === "discount" && (
              <div className="space-y-3">

                <div>
                  <label className="mb-1.5 block text-sm font-medium text-gray-700 dark:text-gray-300">
                    Buyer ও মাস নির্বাচন করুন *
                  </label>

                  <select
                    value={
                      discountRows.some(
                        (row) =>
                          row.buyer_id === discountBuyerId &&
                          row.month_start === discountMonth
                      )
                        ? `${discountBuyerId}|${discountMonth}`
                        : ""
                    }
                    onChange={(e) => {
                      const [id, month] = e.target.value.split("|");

                      setDiscountBuyerId(id || "");
                      setDiscountMonth(month || "");
                    }}
                    required
                    className="w-full rounded-xl border border-gray-300 bg-white px-3 py-3 text-sm outline-none focus:border-green-500 dark:border-gray-700 dark:bg-gray-800 dark:text-white"
                  >
                    <option value="">
                      Buyer-এর মাস নির্বাচন করুন
                    </option>

                    {discountOptions.map((row) => (
                      <option
                        key={`${row.buyer_id}-${row.month_start}`}
                        value={`${row.buyer_id}|${row.month_start}`}
                      >
                        {row.buyer_code} — {row.name} — {formatMonth(row.month_start)}
                      </option>
                    ))}
                  </select>
                </div>

                {selectedDiscount ? (
                  <div className="rounded-xl bg-purple-50 p-3 text-sm dark:bg-purple-950/40">

                    <div className="flex justify-between gap-2">
                      <span>মাসিক কেনাকাটা</span>
                      <strong>{money(selectedDiscount.monthly_purchase)}</strong>
                    </div>

                    <div className="mt-1 flex justify-between gap-2">
                      <span>
                        Discount ({selectedDiscount.discount_percent}%)
                      </span>
                      <strong>{money(selectedDiscount.discount_earned)}</strong>
                    </div>

                    <div className="mt-1 flex justify-between gap-2">
                      <span>আগে পরিশোধ</span>
                      <strong>{money(selectedDiscount.discount_paid)}</strong>
                    </div>

                    <div className="mt-2 flex justify-between gap-2 border-t border-purple-200 pt-2 dark:border-purple-900">
                      <strong>বাকি Discount</strong>
                      <strong className="text-purple-700 dark:text-purple-300">
                        {money(selectedDiscount.discount_remaining)}
                      </strong>
                    </div>

                  </div>
                ) : (
                  <p className="rounded-xl bg-gray-50 p-3 text-sm text-gray-500 dark:bg-gray-800">
                    এই Buyer-এর জন্য কোনো Monthly Discount Summary পাওয়া যায়নি।
                  </p>
                )}

              </div>
            )}

            {/* AMOUNT */}

            <div>
              <label className="mb-1.5 block text-sm font-medium text-gray-700 dark:text-gray-300">
                Payment Amount (৳) *
              </label>

              <input
                type="number"
                min="0.01"
                step="0.01"
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
                required
                placeholder="টাকার পরিমাণ লিখুন"
                className="w-full rounded-xl border border-gray-300 bg-white px-3 py-3 text-sm outline-none focus:border-green-500 dark:border-gray-700 dark:bg-gray-800 dark:text-white"
              />

              {activeTab === "buyer" && selectedBuyer && (
                <button
                  type="button"
                  onClick={() =>
                    setAmount(
                      String(Math.max(0, selectedBuyer.current_due))
                    )
                  }
                  className="mt-1 text-xs font-medium text-blue-600 hover:underline dark:text-blue-400"
                >
                  সম্পূর্ণ বকেয়া বসান
                </button>
              )}

              {activeTab === "seller" && selectedSeller && (
                <button
                  type="button"
                  onClick={() =>
                    setAmount(
                      String(Math.max(0, selectedSeller.current_due))
                    )
                  }
                  className="mt-1 text-xs font-medium text-orange-600 hover:underline dark:text-orange-400"
                >
                  সম্পূর্ণ পাওনা বসান
                </button>
              )}

              {activeTab === "discount" && selectedDiscount && (
                <button
                  type="button"
                  onClick={() =>
                    setAmount(
                      String(
                        Math.max(
                          0,
                          selectedDiscount.discount_remaining
                        )
                      )
                    )
                  }
                  className="mt-1 text-xs font-medium text-purple-600 hover:underline dark:text-purple-400"
                >
                  সম্পূর্ণ Discount বসান
                </button>
              )}
            </div>

            {/* DATE */}

            <div>
              <label className="mb-1.5 block text-sm font-medium text-gray-700 dark:text-gray-300">
                Payment Date *
              </label>

              <input
                type="date"
                value={paymentDate}
                onChange={(e) => setPaymentDate(e.target.value)}
                required
                className="w-full rounded-xl border border-gray-300 bg-white px-3 py-3 text-sm outline-none focus:border-green-500 dark:border-gray-700 dark:bg-gray-800 dark:text-white"
              />
            </div>

            {/* METHOD */}

            <div>
              <label className="mb-1.5 block text-sm font-medium text-gray-700 dark:text-gray-300">
                Payment Method *
              </label>

              <select
                value={method}
                onChange={(e) => setMethod(e.target.value)}
                className="w-full rounded-xl border border-gray-300 bg-white px-3 py-3 text-sm outline-none focus:border-green-500 dark:border-gray-700 dark:bg-gray-800 dark:text-white"
              >
                <option value="cash">নগদ টাকা (Cash)</option>
                <option value="bank">Bank Transfer</option>
                <option value="bkash">bKash</option>
                <option value="nagad">Nagad</option>
                <option value="rocket">Rocket</option>
                <option value="other">অন্যান্য</option>
              </select>
            </div>

            {/* REFERENCE */}

            <div>
              <label className="mb-1.5 block text-sm font-medium text-gray-700 dark:text-gray-300">
                Transaction / Reference No.
              </label>

              <input
                type="text"
                value={referenceNo}
                onChange={(e) => setReferenceNo(e.target.value)}
                placeholder="ঐচ্ছিক"
                className="w-full rounded-xl border border-gray-300 bg-white px-3 py-3 text-sm outline-none focus:border-green-500 dark:border-gray-700 dark:bg-gray-800 dark:text-white"
              />
            </div>

            {/* NOTES */}

            <div>
              <label className="mb-1.5 block text-sm font-medium text-gray-700 dark:text-gray-300">
                Notes
              </label>

              <textarea
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                rows={2}
                placeholder="অতিরিক্ত তথ্য (ঐচ্ছিক)"
                className="w-full resize-none rounded-xl border border-gray-300 bg-white px-3 py-3 text-sm outline-none focus:border-green-500 dark:border-gray-700 dark:bg-gray-800 dark:text-white"
              />
            </div>

            {/* SUBMIT */}

            <button
              type="submit"
              disabled={saving || loading}
              className="flex w-full items-center justify-center gap-2 rounded-xl bg-green-600 px-4 py-3 font-semibold text-white transition hover:bg-green-700 disabled:cursor-not-allowed disabled:opacity-60"
            >
              {saving ? (
                <>
                  <Loader2 size={18} className="animate-spin" />
                  সংরক্ষণ হচ্ছে...
                </>
              ) : (
                <>
                  <Banknote size={18} />

                  {activeTab === "buyer"
                    ? "টাকা গ্রহণ নিশ্চিত করুন"
                    : activeTab === "seller"
                      ? "টাকা প্রদান নিশ্চিত করুন"
                      : "Discount প্রদান নিশ্চিত করুন"}
                </>
              )}
            </button>

          </form>
        </section>

        {/* DUE LIST */}

        <section className="space-y-5 rounded-2xl border border-gray-200 bg-white p-5 shadow-sm dark:border-gray-800 dark:bg-gray-900 xl:col-span-3">

          <div className="flex flex-col justify-between gap-3 sm:flex-row sm:items-center">

            <div>
              <h2 className="text-lg font-bold text-gray-900 dark:text-white">
                {activeTab === "buyer"
                  ? "Buyer-এর বকেয়া তালিকা"
                  : activeTab === "seller"
                    ? "Seller-এর পাওনা তালিকা"
                    : "Buyer-এর Discount তালিকা"}
              </h2>

              <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
                নাম বা ID দিয়ে খুঁজুন।
              </p>
            </div>

            <div className="relative">
              <Search
                size={17}
                className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400"
              />

              <input
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="নাম বা ID খুঁজুন"
                className="w-full rounded-xl border border-gray-300 bg-white py-2.5 pl-9 pr-3 text-sm outline-none focus:border-green-500 dark:border-gray-700 dark:bg-gray-800 dark:text-white sm:w-56"
              />
            </div>

          </div>

          {loading ? (
            <div className="flex justify-center py-12 text-gray-500">
              <Loader2 className="animate-spin" />
            </div>
          ) : activeTab === "discount" ? (

            /* DISCOUNT TABLE */

            <div className="overflow-x-auto">
              <table className="w-full min-w-[520px] text-left text-sm">

                <thead>
                  <tr className="border-b border-gray-200 text-xs text-gray-500 dark:border-gray-700">
                    <th className="px-3 py-3">Buyer / মাস</th>
                    <th className="px-3 py-3 text-right">Discount</th>
                    <th className="px-3 py-3 text-right">বাকি</th>
                    <th className="px-3 py-3 text-right">Action</th>
                  </tr>
                </thead>

                <tbody>
                  {discountRows
                    .filter((row) => {
                      const q = search.trim().toLowerCase();

                      return (
                        !q ||
                        row.name.toLowerCase().includes(q) ||
                        row.buyer_code.toLowerCase().includes(q)
                      );
                    })
                    .map((row) => (
                      <tr
                        key={`${row.buyer_id}-${row.month_start}`}
                        className="border-b border-gray-100 last:border-0 dark:border-gray-800"
                      >
                        <td className="px-3 py-3">
                          <p className="font-semibold text-gray-900 dark:text-white">
                            {row.name}
                          </p>

                          <p className="text-xs text-gray-500">
                            {row.buyer_code} · {formatMonth(row.month_start)}
                          </p>
                        </td>

                        <td className="px-3 py-3 text-right">
                          {money(row.discount_earned)}
                        </td>

                        <td className="px-3 py-3 text-right font-semibold text-purple-700 dark:text-purple-300">
                          {money(row.discount_remaining)}
                        </td>

                        <td className="px-3 py-3 text-right">
                          <button
                            type="button"
                            disabled={Number(row.discount_remaining) <= 0}
                            onClick={() => {
                              setDiscountBuyerId(row.buyer_id);
                              setDiscountMonth(row.month_start);
                              setAmount(
                                String(row.discount_remaining)
                              );

                              window.scrollTo({
                                top: 0,
                                behavior: "smooth",
                              });
                            }}
                            className="rounded-lg bg-green-50 px-3 py-1.5 text-xs font-semibold text-green-700 hover:bg-green-100 disabled:opacity-40 dark:bg-green-950/40 dark:text-green-300"
                          >
                            Payment
                          </button>
                        </td>
                      </tr>
                    ))}

                  {discountRows.length === 0 && (
                    <tr>
                      <td
                        colSpan={4}
                        className="px-3 py-10 text-center text-gray-500"
                      >
                        কোনো Monthly Discount Summary পাওয়া যায়নি।
                      </td>
                    </tr>
                  )}

                </tbody>
              </table>
            </div>

          ) : (

            /* BUYER / SELLER TABLE */

            <div className="overflow-x-auto">
              <table className="w-full min-w-[520px] text-left text-sm">

                <thead>
                  <tr className="border-b border-gray-200 text-xs text-gray-500 dark:border-gray-700">
                    <th className="px-3 py-3 font-semibold">
                      নাম / ID
                    </th>

                    <th className="px-3 py-3 text-right font-semibold">
                      {activeTab === "buyer"
                        ? "কেনাকাটা"
                        : "মোট পাওনা"}
                    </th>

                    <th className="px-3 py-3 text-right font-semibold">
                      বকেয়া
                    </th>

                    <th className="px-3 py-3 text-right font-semibold">
                      Action
                    </th>
                  </tr>
                </thead>

                <tbody>
                  {filteredParties.map((party) => {
                    const isBuyer = activeTab === "buyer";

                    const code = isBuyer
                      ? (party as Buyer).buyer_code
                      : (party as Seller).seller_code;

                    const due = Number(party.current_due || 0);

                    const total = isBuyer
                      ? (party as Buyer).total_purchases
                      : (party as Seller).total_payable;

                    const id = isBuyer
                      ? (party as Buyer).buyer_id
                      : (party as Seller).seller_id;

                    return (
                      <tr
                        key={id}
                        className="border-b border-gray-100 last:border-0 dark:border-gray-800"
                      >
                        <td className="px-3 py-3">
                          <p className="font-semibold text-gray-900 dark:text-white">
                            {party.name}
                          </p>

                          <p className="text-xs text-gray-500">
                            {code}
                          </p>
                        </td>

                        <td className="px-3 py-3 text-right text-gray-700 dark:text-gray-300">
                          {money(total)}
                        </td>

                        <td className="px-3 py-3 text-right">
                          <span className="font-semibold text-red-600 dark:text-red-400">
                            {money(due)}
                          </span>
                        </td>

                        <td className="px-3 py-3 text-right">
                          <button
                            type="button"
                            onClick={() => {
                              if (isBuyer) {
                                setBuyerId(id);
                              } else {
                                setSellerId(id);
                              }

                              setAmount(
                                due > 0 ? String(due) : ""
                              );

                              setError("");
                              setSuccess("");

                              window.scrollTo({
                                top: 0,
                                behavior: "smooth",
                              });
                            }}
                            disabled={due <= 0}
                            className="rounded-lg bg-green-50 px-3 py-1.5 text-xs font-semibold text-green-700 hover:bg-green-100 disabled:cursor-not-allowed disabled:opacity-40 dark:bg-green-950/40 dark:text-green-300"
                          >
                            Payment
                          </button>
                        </td>
                      </tr>
                    );
                  })}

                  {filteredParties.length === 0 && (
                    <tr>
                      <td
                        colSpan={4}
                        className="px-3 py-10 text-center text-gray-500"
                      >
                        কোনো তথ্য পাওয়া যায়নি।
                      </td>
                    </tr>
                  )}

                </tbody>
              </table>
            </div>
          )}

        </section>
      </div>

      {/* PAYMENT HISTORY */}

      <section className="overflow-hidden rounded-2xl border border-gray-200 bg-white shadow-sm dark:border-gray-800 dark:bg-gray-900">

        <div className="flex flex-col justify-between gap-3 border-b border-gray-200 p-5 dark:border-gray-800 sm:flex-row sm:items-center">

          <div>
            <div className="flex items-center gap-2">
              <History size={19} className="text-green-600" />

              <h2 className="text-lg font-bold text-gray-900 dark:text-white">
                Payment History
              </h2>
            </div>

            <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
              তিন ধরনের Payment Table থেকে সর্বশেষ রেকর্ড।
            </p>
          </div>

          <div className="relative">
            <Search
              size={17}
              className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400"
            />

            <input
              value={historySearch}
              onChange={(e) => setHistorySearch(e.target.value)}
              placeholder="নাম / Receipt / Reference খুঁজুন"
              className="w-full rounded-xl border border-gray-300 bg-white py-2.5 pl-9 pr-3 text-sm outline-none focus:border-green-500 dark:border-gray-700 dark:bg-gray-800 dark:text-white sm:w-72"
            />
          </div>

        </div>

        {loading ? (
          <div className="flex justify-center py-12 text-gray-500">
            <Loader2 className="animate-spin" />
          </div>
        ) : (

          <div className="overflow-x-auto">
            <table className="w-full min-w-[850px] text-left text-sm">

              <thead className="bg-gray-50 text-xs text-gray-500 dark:bg-gray-800/70">
                <tr>
                  <th className="px-5 py-3">তারিখ</th>
                  <th className="px-5 py-3">Receipt / নাম</th>
                  <th className="px-5 py-3">ধরন</th>
                  <th className="px-5 py-3">Method</th>
                  <th className="px-5 py-3 text-right">Amount</th>
                  <th className="px-5 py-3 text-right">Print</th>
                </tr>
              </thead>

              <tbody>
                {filteredPayments.map((payment) => (
                  <tr
                    key={`${payment.party_type}-${payment.id}`}
                    className="border-t border-gray-100 dark:border-gray-800"
                  >
                    <td className="px-5 py-3 text-gray-600 dark:text-gray-300">
                      <span className="inline-flex items-center gap-2">
                        <CalendarDays size={15} />
                        {payment.payment_date}
                      </span>
                    </td>

                    <td className="px-5 py-3 font-medium text-gray-900 dark:text-white">
                      {payment.party_name}

                      <p className="text-xs font-normal text-gray-500">
                        {payment.receipt_no} ·{" "}
                        {payment.reference_no || "Reference নেই"}
                      </p>
                    </td>

                    <td className="px-5 py-3">
                      <span
                        className={`rounded-full px-2.5 py-1 text-xs font-semibold ${
                          payment.party_type === "buyer"
                            ? "bg-blue-50 text-blue-700 dark:bg-blue-950 dark:text-blue-300"
                            : payment.party_type === "seller"
                              ? "bg-orange-50 text-orange-700 dark:bg-orange-950 dark:text-orange-300"
                              : "bg-purple-50 text-purple-700 dark:bg-purple-950 dark:text-purple-300"
                        }`}
                      >
                        {payment.payment_type}
                      </span>
                    </td>

                    <td className="px-5 py-3 text-gray-600 dark:text-gray-300">
                      {methodLabels[payment.payment_method] ||
                        payment.payment_method}
                    </td>

                    <td className="px-5 py-3 text-right font-bold text-gray-900 dark:text-white">
                      {money(payment.amount)}
                    </td>

                    <td className="px-5 py-3 text-right">
                      <button
                        type="button"
                        onClick={() => printReceipt(payment)}
                        className="inline-flex items-center gap-1.5 rounded-lg border border-gray-200 px-3 py-1.5 text-xs font-semibold text-gray-700 hover:bg-gray-50 dark:border-gray-700 dark:text-gray-200 dark:hover:bg-gray-800"
                      >
                        <Printer size={14} />
                        Print
                      </button>
                    </td>
                  </tr>
                ))}

                {filteredPayments.length === 0 && (
                  <tr>
                    <td
                      colSpan={6}
                      className="px-5 py-10 text-center text-gray-500"
                    >
                      এখনো কোনো Payment History নেই।
                    </td>
                  </tr>
                )}

              </tbody>
            </table>
          </div>
        )}

      </section>

      <div className="flex items-center gap-2 text-xs text-gray-500 dark:text-gray-400">
        <Clock size={14} />
        Payment সংরক্ষণের পর Buyer ও Seller-এর Ledger Summary রিফ্রেশ হবে।
      </div>

    </div>
  );
}