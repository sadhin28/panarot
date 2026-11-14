
import { useEffect, useState } from "react";
import { supabase } from "../lib/supabase";
import {
  Settings as SettingsIcon,
  Building2,
  Percent,
  Receipt,
  Save,
  RefreshCw,
  CheckCircle2,
  AlertCircle,
} from "lucide-react";

type BusinessSettings = {
  id: boolean;
  business_name: string;
  commission_percent: number;
  seller_slip_cost: number;
  buyer_discount_percent: number;
  currency: string;
  timezone: string;
};

const defaultSettings: BusinessSettings = {
  id: true,
  business_name: "আমার পান আরত",
  commission_percent: 10,
  seller_slip_cost: 5,
  buyer_discount_percent: 5,
  currency: "BDT",
  timezone: "Asia/Dhaka",
};

export default function Settings() {
  const [settings, setSettings] =
    useState<BusinessSettings>(defaultSettings);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  const loadSettings = async () => {
    setLoading(true);
    setError("");

    const { data, error } = await supabase
      .from("pan_arot_settings")
      .select("*")
      .eq("id", true)
      .maybeSingle();

    if (error) {
      setError(error.message);
    } else if (data) {
      setSettings({
        id: true,
        business_name: data.business_name ?? defaultSettings.business_name,
        commission_percent: Number(data.commission_percent ?? 10),
        seller_slip_cost: Number(data.seller_slip_cost ?? 5),
        buyer_discount_percent: Number(data.buyer_discount_percent ?? 5),
        currency: data.currency ?? "BDT",
        timezone: data.timezone ?? "Asia/Dhaka",
      });
    }

    setLoading(false);
  };

  useEffect(() => {
    loadSettings();
  }, []);

  const updateField = (
    field: keyof BusinessSettings,
    value: string | number
  ) => {
    setSettings((prev) => ({ ...prev, [field]: value }));
    setMessage("");
    setError("");
  };

  const handleSave = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setSaving(true);
    setMessage("");
    setError("");

    const payload = {
      id: true,
      business_name: settings.business_name.trim(),
      commission_percent: Number(settings.commission_percent),
      seller_slip_cost: Number(settings.seller_slip_cost),
      buyer_discount_percent: Number(settings.buyer_discount_percent),
      currency: settings.currency,
      timezone: settings.timezone,
      updated_at: new Date().toISOString(),
    };

    if (!payload.business_name) {
      setError("ব্যবসার নাম লিখুন।");
      setSaving(false);
      return;
    }

    if (
      payload.commission_percent < 0 ||
      payload.buyer_discount_percent < 0 ||
      payload.seller_slip_cost < 0
    ) {
      setError("কোনো সেটিংসের মান ঋণাত্মক হতে পারবে না।");
      setSaving(false);
      return;
    }

    const { error } = await supabase
      .from("pan_arot_settings")
      .upsert(payload, { onConflict: "id" });

    if (error) {
      setError(error.message);
    } else {
      setMessage("সেটিংস সফলভাবে সংরক্ষণ হয়েছে।");
    }

    setSaving(false);
  };

  if (loading) {
    return (
      <div className="flex min-h-[300px] items-center justify-center">
        <RefreshCw className="mr-2 h-5 w-5 animate-spin text-green-600" />
        <span className="text-sm text-gray-500">সেটিংস লোড হচ্ছে...</span>
      </div>
    );
  }

  const commissionExample = (6000 * Number(settings.commission_percent)) / 100;
  const sellerPayable =
    6000 - commissionExample - Number(settings.seller_slip_cost);

  return (
    <div className="mx-auto w-full max-w-7xl space-y-6 p-4 sm:p-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <div className="flex items-center gap-2">
            <SettingsIcon className="h-6 w-6 text-green-700" />
            <h1 className="text-2xl font-bold text-gray-900">সেটিংস</h1>
          </div>
          <p className="mt-1 text-sm text-gray-500">
            আপনার পান আরতের ব্যবসায়িক সেটিংস নিয়ন্ত্রণ করুন।
          </p>
        </div>

        <button
          type="button"
          onClick={loadSettings}
          className="inline-flex items-center justify-center gap-2 rounded-lg border border-gray-200 bg-white px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50"
        >
          <RefreshCw className="h-4 w-4" />
          রিফ্রেশ
        </button>
      </div>

      {message && (
        <div className="flex items-center gap-2 rounded-lg border border-green-200 bg-green-50 p-3 text-sm text-green-700">
          <CheckCircle2 className="h-5 w-5 shrink-0" />
          {message}
        </div>
      )}

      {error && (
        <div className="flex items-center gap-2 rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-700">
          <AlertCircle className="h-5 w-5 shrink-0" />
          {error}
        </div>
      )}

      <form onSubmit={handleSave} className="space-y-6">
        <section className="rounded-xl border border-gray-200 bg-white p-5 shadow-sm">
          <div className="mb-5 flex items-center gap-3">
            <div className="rounded-lg bg-green-50 p-2">
              <Building2 className="h-5 w-5 text-green-700" />
            </div>
            <div>
              <h2 className="font-semibold text-gray-900">ব্যবসার তথ্য</h2>
              <p className="text-xs text-gray-500">
                আপনার প্রতিষ্ঠানের সাধারণ তথ্য
              </p>
            </div>
          </div>

          <label className="mb-2 block text-sm font-medium text-gray-700">
            ব্যবসার নাম
          </label>
          <input
            type="text"
            value={settings.business_name}
            onChange={(e) => updateField("business_name", e.target.value)}
            placeholder="আপনার আরতের নাম"
            className="w-full rounded-lg border border-gray-300 px-4 py-3 text-sm outline-none focus:border-green-600 focus:ring-2 focus:ring-green-100"
          />
        </section>

        <section className="rounded-xl border border-gray-200 bg-white p-5 shadow-sm">
          <div className="mb-5 flex items-center gap-3">
            <div className="rounded-lg bg-blue-50 p-2">
              <Percent className="h-5 w-5 text-blue-700" />
            </div>
            <div>
              <h2 className="font-semibold text-gray-900">কমিশন ও ডিসকাউন্ট</h2>
              <p className="text-xs text-gray-500">
                Seller commission এবং Buyer monthly discount
              </p>
            </div>
          </div>

          <div className="grid gap-5 sm:grid-cols-2">
            <div>
              <label className="mb-2 block text-sm font-medium text-gray-700">
                Seller Commission (%)
              </label>
              <input
                type="number"
                min="0"
                step="0.01"
                value={settings.commission_percent}
                onChange={(e) =>
                  updateField("commission_percent", Number(e.target.value))
                }
                className="w-full rounded-lg border border-gray-300 px-4 py-3 text-sm outline-none focus:border-green-600 focus:ring-2 focus:ring-green-100"
              />
              <p className="mt-1 text-xs text-gray-500">
                বর্তমানে: প্রতি ৳১,০০০-এ ৳১০০ কমিশন
              </p>
            </div>

            <div>
              <label className="mb-2 block text-sm font-medium text-gray-700">
                Buyer Monthly Discount (%)
              </label>
              <input
                type="number"
                min="0"
                step="0.01"
                value={settings.buyer_discount_percent}
                onChange={(e) =>
                  updateField(
                    "buyer_discount_percent",
                    Number(e.target.value)
                  )
                }
                className="w-full rounded-lg border border-gray-300 px-4 py-3 text-sm outline-none focus:border-green-600 focus:ring-2 focus:ring-green-100"
              />
              <p className="mt-1 text-xs text-gray-500">
                মাসিক কেনাকাটার ওপর Buyer discount
              </p>
            </div>
          </div>
        </section>

        <section className="rounded-xl border border-gray-200 bg-white p-5 shadow-sm">
          <div className="mb-5 flex items-center gap-3">
            <div className="rounded-lg bg-orange-50 p-2">
              <Receipt className="h-5 w-5 text-orange-700" />
            </div>
            <div>
              <h2 className="font-semibold text-gray-900">স্লিপ সেটিংস</h2>
              <p className="text-xs text-gray-500">
                প্রতি Seller slip-এর খরচ
              </p>
            </div>
          </div>

          <div className="max-w-sm">
            <label className="mb-2 block text-sm font-medium text-gray-700">
              Seller Slip Cost (৳)
            </label>
            <input
              type="number"
              min="0"
              step="0.01"
              value={settings.seller_slip_cost}
              onChange={(e) =>
                updateField("seller_slip_cost", Number(e.target.value))
              }
              className="w-full rounded-lg border border-gray-300 px-4 py-3 text-sm outline-none focus:border-green-600 focus:ring-2 focus:ring-green-100"
            />
          </div>
        </section>

        <section className="rounded-xl border border-green-200 bg-green-50 p-5">
          <h2 className="mb-3 font-semibold text-gray-900">
            কমিশনের উদাহরণ
          </h2>
          <p className="mb-4 text-sm text-gray-600">
            Seller-এর মোট পাওনা ৳৬,০০০ হলে বর্তমান সেটিংস অনুযায়ী হিসাব:
          </p>

          <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
            <div className="rounded-lg bg-white p-3">
              <p className="text-xs text-gray-500">মোট টাকা</p>
              <p className="mt-1 text-lg font-bold text-gray-900">
                ৳৬,০০০
              </p>
            </div>
            <div className="rounded-lg bg-white p-3">
              <p className="text-xs text-gray-500">কমিশন + স্লিপ খরচ</p>
              <p className="mt-1 text-lg font-bold text-red-600">
                ৳{(commissionExample + Number(settings.seller_slip_cost)).toLocaleString("en-BD")}
              </p>
            </div>
            <div className="rounded-lg bg-white p-3">
              <p className="text-xs text-gray-500">Seller-এর পাওনা</p>
              <p className="mt-1 text-lg font-bold text-green-700">
                ৳{sellerPayable.toLocaleString("en-BD")}
              </p>
            </div>
          </div>
          <p className="mt-3 text-xs text-gray-500">
            এটি শুধু উদাহরণ; সেটিংস পরিবর্তন করলে হিসাবও পরিবর্তিত হবে।
          </p>
        </section>

        <div className="flex justify-end">
          <button
            type="submit"
            disabled={saving}
            className="inline-flex w-full items-center justify-center gap-2 rounded-lg bg-green-700 px-6 py-3 text-sm font-semibold text-white transition hover:bg-green-800 disabled:cursor-not-allowed disabled:opacity-60 sm:w-auto"
          >
            {saving ? (
              <RefreshCw className="h-4 w-4 animate-spin" />
            ) : (
              <Save className="h-4 w-4" />
            )}
            {saving ? "সংরক্ষণ হচ্ছে..." : "সেটিংস সংরক্ষণ করুন"}
          </button>
        </div>
      </form>
    </div>
  );
}
