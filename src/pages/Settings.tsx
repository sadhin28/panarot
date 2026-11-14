
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
  const [isDark, setIsDark] = useState(
    () =>
      typeof document !== "undefined" &&
      document.documentElement.classList.contains("dark")
  );

  // Detect global theme changes
  useEffect(() => {
    const observer = new MutationObserver(() => {
      setIsDark(
        document.documentElement.classList.contains("dark")
      );
    });

    observer.observe(document.documentElement, {
      attributes: true,
      attributeFilter: ["class"],
    });

    return () => observer.disconnect();
  }, []);

  const dark = isDark;

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
      payload.commission_percent > 100 ||
      payload.buyer_discount_percent < 0 ||
      payload.buyer_discount_percent > 100 ||
      payload.seller_slip_cost < 0 ||
      !Number.isFinite(payload.commission_percent) ||
      !Number.isFinite(payload.buyer_discount_percent) ||
      !Number.isFinite(payload.seller_slip_cost)
    ) {
      setError("সঠিক সেটিংসের মান লিখুন। পার্সেন্টেজ ০ থেকে ১০০-এর মধ্যে হতে হবে।");
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

  const commissionExample =
    (6000 * Number(settings.commission_percent)) / 100;

  const sellerPayable =
    6000 - commissionExample - Number(settings.seller_slip_cost);

  const inputClass = `
    w-full rounded-xl border px-4 py-3 text-sm outline-none
    transition-all duration-200
    ${
      dark
        ? "border-gray-700 bg-gray-900 text-gray-100 placeholder:text-gray-500 focus:border-green-500 focus:ring-2 focus:ring-green-500/20"
        : "border-gray-300 bg-white text-gray-900 placeholder:text-gray-400 focus:border-green-600 focus:ring-2 focus:ring-green-100"
    }
  `;

  const cardClass = `
    rounded-2xl border p-5 shadow-sm transition-colors duration-200
    ${
      dark
        ? "border-gray-800 bg-gray-900"
        : "border-gray-200 bg-white"
    }
  `;

  const headingClass = dark
    ? "text-gray-100"
    : "text-gray-900";

  const mutedClass = dark
    ? "text-gray-400"
    : "text-gray-500";

  const labelClass = dark
    ? "text-gray-300"
    : "text-gray-700";

  if (loading) {
    return (
      <div className={`flex min-h-[300px] items-center justify-center ${
        dark ? "text-gray-300" : "text-gray-600"
      }`}>
        <RefreshCw className="mr-2 h-5 w-5 animate-spin text-green-600" />
        <span className="text-sm">সেটিংস লোড হচ্ছে...</span>
      </div>
    );
  }

  return (
    <div className={`mx-auto min-h-screen w-full max-w-7xl space-y-6 p-4 transition-colors duration-200 sm:p-6 ${
      dark ? "bg-gray-950" : "bg-gray-50"
    }`}>

      {/* Header */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <div className="flex items-center gap-2">
            <SettingsIcon className="h-6 w-6 text-green-600" />
            <h1 className={`text-2xl font-bold ${headingClass}`}>
              সেটিংস
            </h1>
          </div>

          <p className={`mt-1 text-sm ${mutedClass}`}>
            আপনার পান আরতের ব্যবসায়িক সেটিংস নিয়ন্ত্রণ করুন।
          </p>
        </div>

        <button
          type="button"
          onClick={loadSettings}
          className={`inline-flex items-center justify-center gap-2 rounded-xl border px-4 py-2.5 text-sm font-medium transition ${
            dark
              ? "border-gray-700 bg-gray-900 text-gray-300 hover:bg-gray-800"
              : "border-gray-200 bg-white text-gray-700 hover:bg-gray-100"
          }`}
        >
          <RefreshCw className="h-4 w-4" />
          রিফ্রেশ
        </button>
      </div>

      {/* Success Message */}
      {message && (
        <div className={`flex items-center gap-2 rounded-xl border p-3 text-sm ${
          dark
            ? "border-green-900 bg-green-950/50 text-green-400"
            : "border-green-200 bg-green-50 text-green-700"
        }`}>
          <CheckCircle2 className="h-5 w-5 shrink-0" />
          {message}
        </div>
      )}

      {/* Error Message */}
      {error && (
        <div className={`flex items-center gap-2 rounded-xl border p-3 text-sm ${
          dark
            ? "border-red-900 bg-red-950/50 text-red-400"
            : "border-red-200 bg-red-50 text-red-700"
        }`}>
          <AlertCircle className="h-5 w-5 shrink-0" />
          {error}
        </div>
      )}

      <form onSubmit={handleSave} className="space-y-6">

        {/* Business Information */}
        <section className={cardClass}>
          <div className="mb-5 flex items-center gap-3">
            <div className={`rounded-xl p-3 ${
              dark ? "bg-green-950" : "bg-green-50"
            }`}>
              <Building2 className="h-5 w-5 text-green-600" />
            </div>

            <div>
              <h2 className={`font-semibold ${headingClass}`}>
                ব্যবসার তথ্য
              </h2>
              <p className={`text-xs ${mutedClass}`}>
                আপনার প্রতিষ্ঠানের সাধারণ তথ্য
              </p>
            </div>
          </div>

          <label className={`mb-2 block text-sm font-medium ${labelClass}`}>
            ব্যবসার নাম
          </label>

          <input
            type="text"
            value={settings.business_name}
            onChange={(e) =>
              updateField("business_name", e.target.value)
            }
            placeholder="আপনার আরতের নাম"
            className={inputClass}
          />
        </section>

        {/* Commission & Discount */}
        <section className={cardClass}>
          <div className="mb-5 flex items-center gap-3">
            <div className={`rounded-xl p-3 ${
              dark ? "bg-blue-950" : "bg-blue-50"
            }`}>
              <Percent className="h-5 w-5 text-blue-500" />
            </div>

            <div>
              <h2 className={`font-semibold ${headingClass}`}>
                কমিশন ও ডিসকাউন্ট
              </h2>
              <p className={`text-xs ${mutedClass}`}>
                Seller commission এবং Buyer monthly discount
              </p>
            </div>
          </div>

          <div className="grid gap-5 sm:grid-cols-2">
            <div>
              <label className={`mb-2 block text-sm font-medium ${labelClass}`}>
                Seller Commission (%)
              </label>

              <input
                type="number"
                min="0"
                max="100"
                step="0.01"
                value={settings.commission_percent}
                onChange={(e) =>
                  updateField("commission_percent", Number(e.target.value))
                }
                className={inputClass}
              />

              <p className={`mt-2 text-xs ${mutedClass}`}>
                বর্তমানে: প্রতি ৳১,০০০-এ ৳১০০ কমিশন
              </p>
            </div>

            <div>
              <label className={`mb-2 block text-sm font-medium ${labelClass}`}>
                Buyer Monthly Discount (%)
              </label>

              <input
                type="number"
                min="0"
                max="100"
                step="0.01"
                value={settings.buyer_discount_percent}
                onChange={(e) =>
                  updateField(
                    "buyer_discount_percent",
                    Number(e.target.value)
                  )
                }
                className={inputClass}
              />

              <p className={`mt-2 text-xs ${mutedClass}`}>
                মাসিক কেনাকাটার ওপর Buyer discount
              </p>
            </div>
          </div>
        </section>

        {/* Slip Settings */}
        <section className={cardClass}>
          <div className="mb-5 flex items-center gap-3">
            <div className={`rounded-xl p-3 ${
              dark ? "bg-orange-950" : "bg-orange-50"
            }`}>
              <Receipt className="h-5 w-5 text-orange-500" />
            </div>

            <div>
              <h2 className={`font-semibold ${headingClass}`}>
                স্লিপ সেটিংস
              </h2>
              <p className={`text-xs ${mutedClass}`}>
                প্রতি Seller slip-এর খরচ
              </p>
            </div>
          </div>

          <div className="max-w-sm">
            <label className={`mb-2 block text-sm font-medium ${labelClass}`}>
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
              className={inputClass}
            />
          </div>
        </section>

        {/* Commission Example */}
        <section className={`rounded-2xl border p-5 ${
          dark
            ? "border-green-900 bg-green-950/30"
            : "border-green-200 bg-green-50"
        }`}>
          <h2 className={`mb-3 font-semibold ${headingClass}`}>
            কমিশনের উদাহরণ
          </h2>

          <p className={`mb-4 text-sm ${mutedClass}`}>
            Seller-এর মোট পাওনা ৳৬,০০০ হলে বর্তমান সেটিংস অনুযায়ী হিসাব:
          </p>

          <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
            <div className={`rounded-xl p-4 ${
              dark ? "bg-gray-900" : "bg-white"
            }`}>
              <p className={`text-xs ${mutedClass}`}>
                মোট টাকা
              </p>
              <p className={`mt-2 text-xl font-bold ${headingClass}`}>
                ৳৬,০০০
              </p>
            </div>

            <div className={`rounded-xl p-4 ${
              dark ? "bg-gray-900" : "bg-white"
            }`}>
              <p className={`text-xs ${mutedClass}`}>
                কমিশন + স্লিপ খরচ
              </p>
              <p className="mt-2 text-xl font-bold text-red-500">
                ৳{(commissionExample + Number(settings.seller_slip_cost)).toLocaleString("en-BD")}
              </p>
            </div>

            <div className={`rounded-xl p-4 ${
              dark ? "bg-gray-900" : "bg-white"
            }`}>
              <p className={`text-xs ${mutedClass}`}>
                Seller-এর পাওনা
              </p>
              <p className={`mt-2 text-xl font-bold ${
                sellerPayable >= 0 ? "text-green-500" : "text-red-500"
              }`}>
                ৳{sellerPayable.toLocaleString("en-BD")}
              </p>
            </div>
          </div>

          <p className={`mt-3 text-xs ${mutedClass}`}>
            এটি শুধু উদাহরণ; সেটিংস পরিবর্তন করলে হিসাবও পরিবর্তিত হবে।
          </p>
        </section>

        {/* Save Button */}
        <div className="flex justify-end">
          <button
            type="submit"
            disabled={saving}
            className="inline-flex w-full items-center justify-center gap-2 rounded-xl bg-green-700 px-6 py-3 text-sm font-semibold text-white shadow-sm transition hover:bg-green-800 disabled:cursor-not-allowed disabled:opacity-60 sm:w-auto"
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
