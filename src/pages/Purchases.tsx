
import { useCallback, useEffect, useMemo, useState, type FormEvent } from "react";
import {
  Plus, Trash2, Save, Printer, Search, Pencil, Eye,
  RefreshCw, X, Users, Truck, CalendarDays, Receipt,
  Calculator, Loader2, UserPlus, CheckCircle2,
} from "lucide-react";
import { supabase } from "../lib/supabase";
import { useAuth } from "../contexts/AuthContext";

type Buyer = {
  id: string;
  buyer_code: string;
  name: string;
  phone: string | null;
  is_active: boolean;
};

type Seller = {
  id: string;
  seller_code: string;
  name: string;
  phone: string | null;
  is_active: boolean;
};

type EntryLine = {
  id?: string;
  seller_id: string;
  quantity: number;
  rate: number;
};

type Entry = {
  entry_id: string;
  entry_no: string;
  entry_date: string;
  status: string;
  buyer_id: string;
  buyer_code: string;
  buyer_name: string;
  total_amount: number;
  seller_lines: any[];
};

type Settings = {
  commission_percent: number;
  seller_slip_cost: number;
  business_name: string;
  buyer_discount_percent: number;
};

const today = () => {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
};

const money = (value: number) =>
  `৳${Number(value || 0).toLocaleString("en-BD", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;

const emptyLine = (): EntryLine => ({
  seller_id: "",
  quantity: 1,
  rate: 0,
});

export default function Purchases() {
  const { user } = useAuth();

  const [buyers, setBuyers] = useState<Buyer[]>([]);
  const [sellers, setSellers] = useState<Seller[]>([]);
  const [entries, setEntries] = useState<Entry[]>([]);
  const [settings, setSettings] = useState<Settings>({
    commission_percent: 10,
    seller_slip_cost: 5,
    business_name: "Pan Arot Pro",
    buyer_discount_percent: 5,
  });

  const [buyerId, setBuyerId] = useState("");
  const [entryDate, setEntryDate] = useState(today());
  const [notes, setNotes] = useState("");
  const [lines, setLines] = useState<EntryLine[]>([emptyLine()]);
  const [editingId, setEditingId] = useState<string | null>(null);

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [search, setSearch] = useState("");
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  const [showPartyModal, setShowPartyModal] = useState(false);
  const [partyType, setPartyType] = useState<"buyer" | "seller">("buyer");
  const [partyName, setPartyName] = useState("");
  const [partyPhone, setPartyPhone] = useState("");
  const [partyAddress, setPartyAddress] = useState("");
  const [partySaving, setPartySaving] = useState(false);

  const [selectedEntry, setSelectedEntry] = useState<Entry | null>(null);

  const loadData = useCallback(async () => {
    setLoading(true);
    setError("");

    try {
      const [
        buyerResult,
        sellerResult,
        entryResult,
        settingResult,
      ] = await Promise.all([
        supabase
          .from("buyers")
          .select("id,buyer_code,name,phone,is_active")
          .eq("is_active", true)
          .order("name"),

        supabase
          .from("sellers")
          .select("id,seller_code,name,phone,is_active")
          .eq("is_active", true)
          .order("name"),

        supabase
          .from("buyer_combined_slips")
          .select("*")
          .order("entry_date", { ascending: false })
          .limit(100),

        supabase
          .from("pan_arot_settings")
          .select("*")
          .eq("id", true)
          .maybeSingle(),
      ]);

      if (buyerResult.error) throw buyerResult.error;
      if (sellerResult.error) throw sellerResult.error;
      if (entryResult.error) throw entryResult.error;

      setBuyers(buyerResult.data || []);
      setSellers(sellerResult.data || []);
      setEntries((entryResult.data || []) as Entry[]);

      if (settingResult.data) {
        setSettings({
          commission_percent: Number(settingResult.data.commission_percent ?? 10),
          seller_slip_cost: Number(settingResult.data.seller_slip_cost ?? 5),
          business_name: settingResult.data.business_name || "Pan Arot Pro",
          buyer_discount_percent: Number(settingResult.data.buyer_discount_percent ?? 5),
        });
      }
    } catch (err: any) {
      setError(err.message || "তথ্য লোড করা যায়নি।");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const updateLine = (index: number, field: keyof EntryLine, value: string) => {
    setLines((previous) =>
      previous.map((line, i) =>
        i === index
          ? {
              ...line,
              [field]:
                field === "seller_id"
                  ? value
                  : Number(value),
            }
          : line
      )
    );
  };

  const addLine = () => setLines((previous) => [...previous, emptyLine()]);

  const removeLine = (index: number) => {
    if (lines.length === 1) {
      setLines([emptyLine()]);
      return;
    }
    setLines((previous) => previous.filter((_, i) => i !== index));
  };

  const calculatedLines = useMemo(() => {
    return lines.map((line) => {
      const gross = Number(line.quantity || 0) * Number(line.rate || 0);
      const commission = gross * settings.commission_percent / 100;
      const net = gross - commission - settings.seller_slip_cost;

      return {
        ...line,
        gross,
        commission,
        slipCost: settings.seller_slip_cost,
        net: Math.max(0, net),
      };
    });
  }, [lines, settings]);

  const totalPurchase = calculatedLines.reduce((sum, line) => sum + line.gross, 0);
  const totalCommission = calculatedLines.reduce((sum, line) => sum + line.commission, 0);
  const totalSlipCost = calculatedLines.reduce((sum, line) => sum + line.slipCost, 0);
  const totalSellerPayable = calculatedLines.reduce((sum, line) => sum + line.net, 0);

  const resetForm = () => {
    setBuyerId("");
    setEntryDate(today());
    setNotes("");
    setLines([emptyLine()]);
    setEditingId(null);
    setError("");
    setSuccess("");
  };

  const handleSave = async (event: FormEvent) => {
    event.preventDefault();
    setError("");
    setSuccess("");

    if (!buyerId) {
      setError("প্রথমে একজন Buyer নির্বাচন করুন।");
      return;
    }

    if (lines.some((line) => !line.seller_id)) {
      setError("প্রতিটি লাইনে Seller নির্বাচন করুন।");
      return;
    }

    if (lines.some((line) => line.quantity <= 0 || line.rate < 0)) {
      setError("বীরার পরিমাণ ০-এর বেশি এবং দর ০ বা তার বেশি হতে হবে।");
      return;
    }

    if (new Set(lines.map((line) => line.seller_id)).size !== lines.length) {
      setError("একই Seller একাধিকবার যোগ করা হয়েছে। একই Seller-এর পরিমাণ এক লাইনে যোগ করুন।");
      return;
    }

    setSaving(true);

    try {
      const payload = lines.map((line) => ({
        seller_id: line.seller_id,
        quantity: line.quantity,
        rate: line.rate,
      }));

      const { data, error: rpcError } = await supabase.rpc(
        "save_pan_daily_entry",
        {
          p_buyer_id: buyerId,
          p_entry_date: entryDate,
          p_lines: payload,
          p_notes: notes || null,
          p_entry_id: editingId,
        }
      );

      if (rpcError) throw rpcError;

      setSuccess(
        editingId
          ? "Pan Entry সফলভাবে আপডেট হয়েছে।"
          : "নতুন Pan Entry সফলভাবে সংরক্ষণ হয়েছে।"
      );

      resetForm();
      await loadData();

      if (data) {
        const { data: savedEntry } = await supabase
          .from("buyer_combined_slips")
          .select("*")
          .eq("entry_id", data)
          .maybeSingle();

        if (savedEntry) setSelectedEntry(savedEntry as Entry);
      }
    } catch (err: any) {
      setError(err.message || "Entry সংরক্ষণ করা যায়নি।");
    } finally {
      setSaving(false);
    }
  };

  const editEntry = async (entry: Entry) => {
    setError("");
    setSuccess("");

    try {
      const { data, error: queryError } = await supabase
        .from("pan_entry_lines")
        .select("id,seller_id,quantity,rate")
        .eq("entry_id", entry.entry_id);

      if (queryError) throw queryError;

      setEditingId(entry.entry_id);
      setBuyerId(entry.buyer_id);
      setEntryDate(entry.entry_date);
      setNotes("");

      setLines(
        (data || []).map((line: any) => ({
          id: line.id,
          seller_id: line.seller_id,
          quantity: Number(line.quantity),
          rate: Number(line.rate),
        }))
      );

      window.scrollTo({ top: 0, behavior: "smooth" });
    } catch (err: any) {
      setError(err.message || "Entry লোড করা যায়নি।");
    }
  };

  const openNewParty = (type: "buyer" | "seller") => {
    setPartyType(type);
    setPartyName("");
    setPartyPhone("");
    setPartyAddress("");
    setShowPartyModal(true);
  };

  const createParty = async (event: FormEvent) => {
    event.preventDefault();

    if (!partyName.trim()) return;

    setPartySaving(true);
    setError("");

    try {
      const table = partyType === "buyer" ? "buyers" : "sellers";

      const { data, error: insertError } = await supabase
        .from(table)
        .insert({
          name: partyName.trim(),
          phone: partyPhone.trim() || null,
          address: partyAddress.trim() || null,
          ...(partyType === "buyer" ? { created_by: user?.id } : { created_by: user?.id }),
        })
        .select("id")
        .single();

      if (insertError) throw insertError;

      await loadData();

      if (partyType === "buyer") {
        setBuyerId(data.id);
      } else {
        const emptyIndex = lines.findIndex((line) => !line.seller_id);
        if (emptyIndex >= 0) {
          updateLine(emptyIndex, "seller_id", data.id);
        } else {
          setLines((previous) => [...previous, { ...emptyLine(), seller_id: data.id }]);
        }
      }

      setShowPartyModal(false);
      setSuccess(`নতুন ${partyType === "buyer" ? "Buyer" : "Seller"} তৈরি হয়েছে।`);
    } catch (err: any) {
      setError(err.message || "নতুন অ্যাকাউন্ট তৈরি করা যায়নি।");
    } finally {
      setPartySaving(false);
    }
  };

  const printDocument = (title: string, content: string) => {
    const printWindow = window.open("", "_blank", "width=900,height=700");

    if (!printWindow) {
      setError("Print Window খুলতে পারেনি। Browser popup অনুমতি দিন।");
      return;
    }

    printWindow.document.write(`
      <!DOCTYPE html>
      <html lang="bn">
      <head>
        <meta charset="UTF-8"/>
        <title>${title}</title>
        <style>
          @import url('https://fonts.googleapis.com/css2?family=Hind+Siliguri:wght@400;500;600;700&display=swap');
          body { font-family: 'Hind Siliguri', sans-serif; padding: 25px; color:#111; }
          h2,h3,p { margin: 5px 0; }
          .center { text-align:center; }
          .muted { color:#555; font-size:13px; }
          table { width:100%; border-collapse:collapse; margin-top:18px; }
          th,td { border:1px solid #ddd; padding:9px; text-align:left; }
          th { background:#f3f4f6; }
          .total { margin-top:18px; text-align:right; line-height:1.8; }
          .footer { margin-top:45px; display:flex; justify-content:space-between; }
          @media print { body { padding:0; } }
        </style>
      </head>
      <body>${content}
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

  const printBuyerSlip = (entry: Entry) => {
    const sellerLines = Array.isArray(entry.seller_lines) ? entry.seller_lines : [];

    const rows = sellerLines.map((line: any, index: number) => `
      <tr>
        <td>${index + 1}</td>
        <td>${line.seller_name || "-"}</td>
        <td>${Number(line.quantity || 0).toLocaleString("en-BD")}</td>
        <td>${money(Number(line.rate || 0))}</td>
        <td>${money(Number(line.gross_amount || 0))}</td>
      </tr>
    `).join("");

    const content = `
      <div class="center">
        <h2>${settings.business_name}</h2>
        <h3>Buyer Purchase Slip</h3>
        <p class="muted">Buyer-এর সম্মিলিত ক্রয় রসিদ</p>
      </div>
      <hr/>
      <p><b>Entry No:</b> ${entry.entry_no}</p>
      <p><b>Date:</b> ${entry.entry_date}</p>
      <p><b>Buyer:</b> ${entry.buyer_name} (${entry.buyer_code})</p>
      <table>
        <thead><tr><th>#</th><th>Seller</th><th>বীরা</th><th>দর</th><th>মোট</th></tr></thead>
        <tbody>${rows}</tbody>
      </table>
      <div class="total">
        <h3>মোট ক্রয়: ${money(Number(entry.total_amount))}</h3>
      </div>
      <div class="footer"><span>Buyer Signature</span><span>Authorized Signature</span></div>
    `;

    printDocument("Buyer Slip", content);
  };

  const printSellerSlips = async (entry: Entry) => {
    try {
      const { data, error: queryError } = await supabase
        .from("seller_individual_slips")
        .select("*")
        .eq("entry_no", entry.entry_no)
        .order("seller_name");

      if (queryError) throw queryError;

      if (!data?.length) {
        setError("এই Entry-এর Seller Slip পাওয়া যায়নি।");
        return;
      }

      const content = data.map((line: any) => `
        <section style="page-break-after:always">
          <div class="center">
            <h2>${settings.business_name}</h2>
            <h3>Seller Payment Slip</h3>
          </div>
          <hr/>
          <p><b>Seller Slip:</b> ${line.seller_slip_no}</p>
          <p><b>Entry No:</b> ${line.entry_no}</p>
          <p><b>Date:</b> ${line.entry_date}</p>
          <p><b>Buyer:</b> ${line.buyer_name} (${line.buyer_code})</p>
          <p><b>Seller:</b> ${line.seller_name} (${line.seller_code})</p>
          <table>
            <tbody>
              <tr><th>বীরার পরিমাণ</th><td>${line.quantity}</td></tr>
              <tr><th>প্রতি বীরার দর</th><td>${money(Number(line.rate))}</td></tr>
              <tr><th>মোট বিক্রয়</th><td>${money(Number(line.gross_amount))}</td></tr>
              <tr><th>কমিশন (${line.commission_percent}%)</th><td>${money(Number(line.commission_amount))}</td></tr>
              <tr><th>স্লিপ খরচ</th><td>${money(Number(line.slip_cost))}</td></tr>
              <tr><th>Seller-এর পাওনা</th><td><b>${money(Number(line.seller_net_amount))}</b></td></tr>
            </tbody>
          </table>
          <div class="footer"><span>Seller Signature</span><span>Authorized Signature</span></div>
        </section>
      `).join("");

      printDocument("Seller Slips", content);
    } catch (err: any) {
      setError(err.message || "Seller Slip তৈরি করা যায়নি।");
    }
  };

  const filteredEntries = entries.filter((entry) => {
    const query = search.toLowerCase();
    return (
      entry.entry_no?.toLowerCase().includes(query) ||
      entry.buyer_name?.toLowerCase().includes(query) ||
      entry.buyer_code?.toLowerCase().includes(query)
    );
  });

  return (
    <div className="space-y-6 pb-10">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white">
            পান এন্ট্রি
          </h1>
          <p className="mt-1 text-sm text-gray-500">
            একজন Buyer-এর জন্য একাধিক Seller-এর পান বিক্রির হিসাব
          </p>
        </div>

        <button
          onClick={resetForm}
          className="flex items-center justify-center gap-2 rounded-xl bg-green-600 px-4 py-3 font-semibold text-white hover:bg-green-700"
        >
          <Plus size={18} /> নতুন এন্ট্রি
        </button>
      </div>

      {error && (
        <div className="flex items-start justify-between gap-3 rounded-xl border border-red-200 bg-red-50 p-3 text-sm text-red-700">
          <span>{error}</span>
          <button onClick={() => setError("")}><X size={18} /></button>
        </div>
      )}

      {success && (
        <div className="flex items-center gap-2 rounded-xl border border-green-200 bg-green-50 p-3 text-sm text-green-700">
          <CheckCircle2 size={18} /> {success}
        </div>
      )}

      <form onSubmit={handleSave} className="space-y-5">
        <section className="rounded-2xl border border-gray-200 bg-white p-4 shadow-sm dark:border-gray-700 dark:bg-gray-900 sm:p-6">
          <div className="mb-5 flex items-center gap-2">
            <Users className="text-green-600" />
            <h2 className="text-lg font-bold text-gray-900 dark:text-white">
              Buyer নির্বাচন
            </h2>
          </div>

          <div className="grid gap-3 sm:grid-cols-[1fr_auto]">
            <select
              value={buyerId}
              onChange={(e) => setBuyerId(e.target.value)}
              required
              className="form-input w-full"
            >
              <option value="">Buyer নির্বাচন করুন</option>
              {buyers.map((buyer) => (
                <option key={buyer.id} value={buyer.id}>
                  {buyer.buyer_code} — {buyer.name}
                  {buyer.phone ? ` (${buyer.phone})` : ""}
                </option>
              ))}
            </select>

            <button
              type="button"
              onClick={() => openNewParty("buyer")}
              className="flex items-center justify-center gap-2 rounded-xl border border-green-600 px-4 py-2.5 font-semibold text-green-700 hover:bg-green-50 dark:text-green-400"
            >
              <UserPlus size={17} /> নতুন Buyer
            </button>
          </div>

          <div className="mt-5 grid gap-3 sm:grid-cols-2">
            <label className="space-y-1.5 text-sm font-medium text-gray-700 dark:text-gray-300">
              <span className="flex items-center gap-2"><CalendarDays size={16}/> এন্ট্রির তারিখ</span>
              <input
                type="date"
                value={entryDate}
                onChange={(e) => setEntryDate(e.target.value)}
                required
                className="form-input w-full"
              />
            </label>

            <label className="space-y-1.5 text-sm font-medium text-gray-700 dark:text-gray-300">
              <span>নোট (ঐচ্ছিক)</span>
              <input
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                placeholder="এন্ট্রি সম্পর্কে কিছু লিখুন"
                className="form-input w-full"
              />
            </label>
          </div>
        </section>

        <section className="rounded-2xl border border-gray-200 bg-white p-4 shadow-sm dark:border-gray-700 dark:bg-gray-900 sm:p-6">
          <div className="mb-5 flex flex-wrap items-center justify-between gap-3">
            <div className="flex items-center gap-2">
              <Truck className="text-green-600" />
              <h2 className="text-lg font-bold text-gray-900 dark:text-white">
                Seller-এর পান বিক্রির তথ্য
              </h2>
            </div>

            <button
              type="button"
              onClick={() => openNewParty("seller")}
              className="flex items-center gap-2 rounded-xl border border-green-600 px-3 py-2 text-sm font-semibold text-green-700 dark:text-green-400"
            >
              <UserPlus size={16} /> নতুন Seller
            </button>
          </div>

          <div className="space-y-4">
            {lines.map((line, index) => {
              const result = calculatedLines[index];

              return (
                <div
                  key={index}
                  className="rounded-xl border border-gray-200 p-3 dark:border-gray-700 sm:p-4"
                >
                  <div className="mb-3 flex items-center justify-between">
                    <h3 className="font-bold text-gray-800 dark:text-white">
                      Seller {index + 1}
                    </h3>
                    <button
                      type="button"
                      onClick={() => removeLine(index)}
                      className="rounded-lg p-2 text-red-500 hover:bg-red-50"
                      title="Seller বাদ দিন"
                    >
                      <Trash2 size={17} />
                    </button>
                  </div>

                  <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
                    <label className="space-y-1.5 text-sm text-gray-600 dark:text-gray-300 lg:col-span-2">
                      Seller-এর নাম
                      <select
                        value={line.seller_id}
                        onChange={(e) => updateLine(index, "seller_id", e.target.value)}
                        required
                        className="form-input w-full"
                      >
                        <option value="">Seller নির্বাচন করুন</option>
                        {sellers.map((seller) => (
                          <option key={seller.id} value={seller.id}>
                            {seller.seller_code} — {seller.name}
                          </option>
                        ))}
                      </select>
                    </label>

                    <label className="space-y-1.5 text-sm text-gray-600 dark:text-gray-300">
                      কত বীরা
                      <input
                        type="number"
                        min="0.001"
                        step="0.001"
                        value={line.quantity}
                        onChange={(e) => updateLine(index, "quantity", e.target.value)}
                        required
                        className="form-input w-full"
                      />
                    </label>

                    <label className="space-y-1.5 text-sm text-gray-600 dark:text-gray-300">
                      প্রতি বীরার দর (৳)
                      <input
                        type="number"
                        min="0"
                        step="0.01"
                        value={line.rate}
                        onChange={(e) => updateLine(index, "rate", e.target.value)}
                        required
                        className="form-input w-full"
                      />
                    </label>
                  </div>

                  <div className="mt-4 grid grid-cols-2 gap-2 rounded-lg bg-gray-50 p-3 dark:bg-gray-800 sm:grid-cols-4">
                    <div>
                      <p className="text-xs text-gray-500">মোট বিক্রয়</p>
                      <p className="font-bold text-gray-900 dark:text-white">{money(result.gross)}</p>
                    </div>
                    <div>
                      <p className="text-xs text-gray-500">কমিশন</p>
                      <p className="font-semibold text-orange-600">{money(result.commission)}</p>
                    </div>
                    <div>
                      <p className="text-xs text-gray-500">স্লিপ খরচ</p>
                      <p className="font-semibold text-gray-700 dark:text-gray-200">{money(result.slipCost)}</p>
                    </div>
                    <div>
                      <p className="text-xs text-gray-500">Seller-এর পাওনা</p>
                      <p className="font-bold text-green-700 dark:text-green-400">{money(result.net)}</p>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>

          <button
            type="button"
            onClick={addLine}
            className="mt-4 flex w-full items-center justify-center gap-2 rounded-xl border-2 border-dashed border-green-300 py-3 font-semibold text-green-700 hover:bg-green-50 dark:border-green-800 dark:text-green-400"
          >
            <Plus size={18} /> আরও Seller যোগ করুন
          </button>
        </section>

        <section className="rounded-2xl border border-green-200 bg-green-50 p-4 dark:border-green-900 dark:bg-green-950/30 sm:p-6">
          <div className="mb-4 flex items-center gap-2">
            <Calculator className="text-green-700 dark:text-green-400" />
            <h2 className="text-lg font-bold text-gray-900 dark:text-white">এন্ট্রির মোট হিসাব</h2>
          </div>

          <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
            <div>
              <p className="text-xs text-gray-500">Buyer-এর মোট ক্রয়</p>
              <p className="mt-1 text-lg font-bold text-gray-900 dark:text-white">{money(totalPurchase)}</p>
            </div>
            <div>
              <p className="text-xs text-gray-500">মোট কমিশন</p>
              <p className="mt-1 text-lg font-bold text-orange-600">{money(totalCommission)}</p>
            </div>
            <div>
              <p className="text-xs text-gray-500">মোট স্লিপ খরচ</p>
              <p className="mt-1 text-lg font-bold text-gray-900 dark:text-white">{money(totalSlipCost)}</p>
            </div>
            <div>
              <p className="text-xs text-gray-500">Seller-দের মোট পাওনা</p>
              <p className="mt-1 text-lg font-bold text-green-700 dark:text-green-400">{money(totalSellerPayable)}</p>
            </div>
          </div>

          <p className="mt-4 text-xs text-gray-500">
            কমিশন: {settings.commission_percent}% · প্রতি Seller স্লিপ খরচ: {money(settings.seller_slip_cost)}
          </p>
        </section>

        <div className="flex flex-col gap-3 sm:flex-row sm:justify-end">
          {editingId && (
            <button
              type="button"
              onClick={resetForm}
              className="rounded-xl border border-gray-300 px-5 py-3 font-semibold text-gray-700 dark:border-gray-600 dark:text-gray-200"
            >
              বাতিল করুন
            </button>
          )}

          <button
            type="submit"
            disabled={saving}
            className="flex items-center justify-center gap-2 rounded-xl bg-green-600 px-6 py-3 font-bold text-white hover:bg-green-700 disabled:opacity-60"
          >
            {saving ? <Loader2 className="animate-spin" size={18} /> : <Save size={18} />}
            {saving ? "সংরক্ষণ হচ্ছে..." : editingId ? "Entry আপডেট করুন" : "Pan Entry Save করুন"}
          </button>
        </div>
      </form>

      <section className="rounded-2xl border border-gray-200 bg-white p-4 shadow-sm dark:border-gray-700 dark:bg-gray-900 sm:p-6">
        <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h2 className="text-lg font-bold text-gray-900 dark:text-white">Pan Entry History</h2>
            <p className="text-sm text-gray-500">সর্বশেষ ১০০টি এন্ট্রি</p>
          </div>

          <div className="flex gap-2">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-3 text-gray-400" size={17} />
              <input
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Entry বা Buyer খুঁজুন"
                className="form-input w-full pl-9"
              />
            </div>
            <button
              type="button"
              onClick={loadData}
              className="rounded-xl border border-gray-300 p-3 text-gray-600 dark:border-gray-700 dark:text-gray-300"
              title="Refresh"
            >
              <RefreshCw size={17} />
            </button>
          </div>
        </div>

        {loading ? (
          <div className="flex justify-center py-10">
            <Loader2 className="animate-spin text-green-600" size={28} />
          </div>
        ) : filteredEntries.length === 0 ? (
          <div className="py-10 text-center text-sm text-gray-500">
            কোনো Pan Entry পাওয়া যায়নি।
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[750px] text-left text-sm">
              <thead>
                <tr className="border-b border-gray-200 text-gray-500 dark:border-gray-700">
                  <th className="px-3 py-3">Entry No</th>
                  <th className="px-3 py-3">তারিখ</th>
                  <th className="px-3 py-3">Buyer</th>
                  <th className="px-3 py-3 text-right">মোট টাকা</th>
                  <th className="px-3 py-3">Status</th>
                  <th className="px-3 py-3 text-right">Action</th>
                </tr>
              </thead>
              <tbody>
                {filteredEntries.map((entry) => (
                  <tr key={entry.entry_id} className="border-b border-gray-100 dark:border-gray-800">
                    <td className="px-3 py-4 font-semibold text-gray-800 dark:text-white">{entry.entry_no}</td>
                    <td className="px-3 py-4 text-gray-600 dark:text-gray-300">{entry.entry_date}</td>
                    <td className="px-3 py-4">
                      <p className="font-semibold text-gray-800 dark:text-white">{entry.buyer_name}</p>
                      <p className="text-xs text-gray-500">{entry.buyer_code}</p>
                    </td>
                    <td className="px-3 py-4 text-right font-bold text-gray-900 dark:text-white">
                      {money(Number(entry.total_amount))}
                    </td>
                    <td className="px-3 py-4">
                      <span className="rounded-full bg-green-100 px-2.5 py-1 text-xs font-semibold text-green-700">
                        {entry.status}
                      </span>
                    </td>
                    <td className="px-3 py-4">
                      <div className="flex justify-end gap-1">
                        <button
                          type="button"
                          onClick={() => setSelectedEntry(entry)}
                          className="rounded-lg p-2 text-blue-600 hover:bg-blue-50"
                          title="Details"
                        >
                          <Eye size={17} />
                        </button>
                        <button
                          type="button"
                          onClick={() => editEntry(entry)}
                          className="rounded-lg p-2 text-green-700 hover:bg-green-50"
                          title="Edit"
                        >
                          <Pencil size={17} />
                        </button>
                        <button
                          type="button"
                          onClick={() => printBuyerSlip(entry)}
                          className="rounded-lg p-2 text-gray-600 hover:bg-gray-100 dark:text-gray-300"
                          title="Buyer Slip Print"
                        >
                          <Printer size={17} />
                        </button>
                        <button
                          type="button"
                          onClick={() => printSellerSlips(entry)}
                          className="rounded-lg p-2 text-orange-600 hover:bg-orange-50"
                          title="Seller Slips Print"
                        >
                          <Receipt size={17} />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      {showPartyModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <form
            onSubmit={createParty}
            className="w-full max-w-md space-y-4 rounded-2xl bg-white p-5 shadow-xl dark:bg-gray-900"
          >
            <div className="flex items-center justify-between">
              <h3 className="text-lg font-bold text-gray-900 dark:text-white">
                নতুন {partyType === "buyer" ? "Buyer" : "Seller"} তৈরি করুন
              </h3>
              <button type="button" onClick={() => setShowPartyModal(false)}>
                <X />
              </button>
            </div>

            <label className="block space-y-1.5 text-sm text-gray-600 dark:text-gray-300">
              নাম *
              <input
                autoFocus
                required
                value={partyName}
                onChange={(e) => setPartyName(e.target.value)}
                className="form-input w-full"
                placeholder="নাম লিখুন"
              />
            </label>

            <label className="block space-y-1.5 text-sm text-gray-600 dark:text-gray-300">
              মোবাইল নম্বর
              <input
                value={partyPhone}
                onChange={(e) => setPartyPhone(e.target.value)}
                className="form-input w-full"
                placeholder="01XXXXXXXXX"
              />
            </label>

            <label className="block space-y-1.5 text-sm text-gray-600 dark:text-gray-300">
              ঠিকানা
              <input
                value={partyAddress}
                onChange={(e) => setPartyAddress(e.target.value)}
                className="form-input w-full"
                placeholder="ঠিকানা লিখুন"
              />
            </label>

            <button
              type="submit"
              disabled={partySaving}
              className="flex w-full items-center justify-center gap-2 rounded-xl bg-green-600 py-3 font-bold text-white disabled:opacity-60"
            >
              {partySaving && <Loader2 className="animate-spin" size={18} />}
              {partySaving ? "তৈরি হচ্ছে..." : "অ্যাকাউন্ট তৈরি করুন"}
            </button>
          </form>
        </div>
      )}

      {selectedEntry && (
        <div className="fixed inset-0 z-50 flex items-center justify-center overflow-y-auto bg-black/50 p-4">
          <div className="my-auto w-full max-w-xl rounded-2xl bg-white p-5 shadow-xl dark:bg-gray-900">
            <div className="mb-4 flex items-center justify-between">
              <div>
                <h3 className="text-lg font-bold text-gray-900 dark:text-white">Entry Details</h3>
                <p className="text-sm text-gray-500">{selectedEntry.entry_no}</p>
              </div>
              <button onClick={() => setSelectedEntry(null)} className="rounded-lg p-2 hover:bg-gray-100 dark:hover:bg-gray-800">
                <X />
              </button>
            </div>

            <div className="space-y-2 text-sm">
              <p><b>Buyer:</b> {selectedEntry.buyer_name} ({selectedEntry.buyer_code})</p>
              <p><b>Date:</b> {selectedEntry.entry_date}</p>
              <p><b>Total:</b> {money(Number(selectedEntry.total_amount))}</p>
            </div>

            <div className="mt-4 space-y-2">
              {(Array.isArray(selectedEntry.seller_lines) ? selectedEntry.seller_lines : []).map((line: any, index: number) => (
                <div key={line.id || index} className="rounded-xl bg-gray-50 p-3 text-sm dark:bg-gray-800">
                  <p className="font-bold text-gray-900 dark:text-white">{line.seller_name}</p>
                  <p className="mt-1 text-gray-500">
                    {line.quantity} বীরা × {money(Number(line.rate))}
                  </p>
                  <p className="mt-1 font-semibold text-green-700 dark:text-green-400">
                    মোট: {money(Number(line.gross_amount))}
                  </p>
                </div>
              ))}
            </div>

            <div className="mt-5 grid grid-cols-2 gap-2">
              <button
                onClick={() => printBuyerSlip(selectedEntry)}
                className="flex items-center justify-center gap-2 rounded-xl bg-green-600 py-3 font-semibold text-white"
              >
                <Printer size={17} /> Buyer Slip
              </button>
              <button
                onClick={() => printSellerSlips(selectedEntry)}
                className="flex items-center justify-center gap-2 rounded-xl bg-gray-800 py-3 font-semibold text-white"
              >
                <Printer size={17} /> Seller Slips
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
