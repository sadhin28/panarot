
import { useCallback, useEffect, useState } from "react";
import { CalendarDays, RefreshCw, Wallet, TrendingUp, Receipt, Users } from "lucide-react";
import { supabase } from "../lib/supabase";

const today = () => new Date().toLocaleDateString("en-CA");
const money = (n: number) => `৳${Number(n || 0).toLocaleString("en-BD", {minimumFractionDigits:2, maximumFractionDigits:2})}`;

type Summary = {
  entry_date: string;
  total_entries: number;
  total_seller_lines: number;
  total_purchase: number;
  total_commission: number;
  total_slip_cost: number;
  total_seller_payable: number;
};

export default function DailyClosing() {
  const [date, setDate] = useState(today());
  const [summary, setSummary] = useState<Summary | null>(null);
  const [buyerCollection, setBuyerCollection] = useState(0);
  const [sellerPayment, setSellerPayment] = useState(0);
  const [expenses, setExpenses] = useState(0);
  const [loading, setLoading] = useState(false);

  const loadClosing = useCallback(async () => {
    setLoading(true);

    const [summaryRes, buyerRes, sellerRes, expenseRes] = await Promise.all([
      supabase.from("pan_daily_summary").select("*").eq("entry_date", date).maybeSingle(),
      supabase.from("buyer_collections").select("amount").eq("payment_date", date),
      supabase.from("seller_payments").select("amount").eq("payment_date", date),
      supabase.from("expenses").select("amount").eq("expense_date", date),
    ]);

    const error = summaryRes.error || buyerRes.error || sellerRes.error || expenseRes.error;

    if (error) {
      alert(error.message);
    } else {
      setSummary(summaryRes.data as Summary | null);
      setBuyerCollection((buyerRes.data || []).reduce((s, x) => s + Number(x.amount), 0));
      setSellerPayment((sellerRes.data || []).reduce((s, x) => s + Number(x.amount), 0));
      setExpenses((expenseRes.data || []).reduce((s, x) => s + Number(x.amount), 0));
    }
    setLoading(false);
  }, [date]);

  useEffect(() => {
    loadClosing();
  }, [loadClosing]);

  const purchase = Number(summary?.total_purchase || 0);
  const commission = Number(summary?.total_commission || 0);
  const slip = Number(summary?.total_slip_cost || 0);
  const payable = Number(summary?.total_seller_payable || 0);
  const cashDifference = buyerCollection - sellerPayment - expenses;

  const Card = ({title, value, icon: Icon, color}: any) => (
    <div className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-2xl p-5">
      <div className="flex justify-between items-center">
        <p className="text-sm text-gray-500">{title}</p>
        <Icon className={color} size={21}/>
      </div>
      <h2 className="text-2xl font-bold mt-3">{money(value)}</h2>
    </div>
  );

  return (
    <div className="space-y-6">
      <div className="rounded-2xl bg-gradient-to-r from-green-700 to-emerald-600 p-6 sm:p-8 text-white">
        <p className="text-green-100 text-sm">দৈনিক হিসাব</p>
        <h1 className="text-2xl sm:text-3xl font-bold mt-1">Daily Closing</h1>
        <p className="text-green-100 text-sm mt-2">দিনের ক্রয়, আদায়, পেমেন্ট ও খরচ মিলিয়ে দেখুন</p>
      </div>

      <div className="bg-white dark:bg-gray-800 border dark:border-gray-700 rounded-2xl p-4 flex flex-col sm:flex-row gap-3 sm:items-center">
        <div className="flex items-center gap-2 text-sm font-semibold"><CalendarDays size={19}/> তারিখ নির্বাচন</div>
        <input type="date" value={date} onChange={(e) => setDate(e.target.value)} className="border dark:border-gray-600 rounded-xl px-4 py-3 bg-transparent"/>
        <button onClick={loadClosing} className="border dark:border-gray-600 rounded-xl px-4 py-3 flex items-center justify-center gap-2"><RefreshCw size={17}/> Refresh</button>
      </div>

      {loading ? <div className="text-center py-12">হিসাব লোড হচ্ছে...</div> : (
        <>
          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
            <Card title="মোট পান ক্রয়" value={purchase} icon={TrendingUp} color="text-green-600"/>
            <Card title="মোট কমিশন" value={commission} icon={Wallet} color="text-blue-600"/>
            <Card title="মোট Slip Cost" value={slip} icon={Receipt} color="text-orange-600"/>
            <Card title="Seller Payable তৈরি" value={payable} icon={Users} color="text-purple-600"/>
            <Card title="Buyer থেকে আদায়" value={buyerCollection} icon={Wallet} color="text-green-600"/>
            <Card title="Seller-কে পরিশোধ" value={sellerPayment} icon={Wallet} color="text-red-600"/>
            <Card title="আজকের Expenses" value={expenses} icon={Receipt} color="text-red-600"/>
          </div>

          <div className="bg-white dark:bg-gray-800 border dark:border-gray-700 rounded-2xl p-5 sm:p-6 space-y-4">
            <h2 className="text-lg font-bold">দৈনিক Closing Summary</h2>
            <div className="flex justify-between border-b dark:border-gray-700 pb-3 text-sm">
              <span className="text-gray-500">মোট Entry</span><strong>{summary?.total_entries || 0}</strong>
            </div>
            <div className="flex justify-between border-b dark:border-gray-700 pb-3 text-sm">
              <span className="text-gray-500">Seller Slip সংখ্যা</span><strong>{summary?.total_seller_lines || 0}</strong>
            </div>
            <div className="flex justify-between border-b dark:border-gray-700 pb-3 text-sm">
              <span className="text-gray-500">Buyer Collection</span><strong className="text-green-600">{money(buyerCollection)}</strong>
            </div>
            <div className="flex justify-between border-b dark:border-gray-700 pb-3 text-sm">
              <span className="text-gray-500">Seller Payment</span><strong className="text-red-600">{money(sellerPayment)}</strong>
            </div>
            <div className="flex justify-between border-b dark:border-gray-700 pb-3 text-sm">
              <span className="text-gray-500">Expenses</span><strong className="text-red-600">{money(expenses)}</strong>
            </div>
            <div className="flex justify-between items-center pt-2">
              <span className="font-bold">Collection − Payment − Expense</span>
              <strong className={`text-xl ${cashDifference >= 0 ? "text-green-600" : "text-red-600"}`}>{money(cashDifference)}</strong>
            </div>
            <p className="text-xs text-gray-500">
              এটি শুধু নির্বাচিত দিনের নগদ প্রবাহের পার্থক্য। এটি প্রকৃত লাভ বা হাতে থাকা নগদ ব্যালেন্স নয়; Opening Balance ও অন্যান্য আয় এখানে অন্তর্ভুক্ত নয়।
            </p>
          </div>
        </>
      )}
    </div>
  );
}
