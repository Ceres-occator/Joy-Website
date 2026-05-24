'use client'

import { useState, useEffect, useRef } from 'react';
import { createClient } from '@/utils/supabase/client';

interface PaymentSetting {
  id: string;
  provider_name: string;
  account_name: string;
  account_number: string;
  qr_file_path: string | null;
}

export default function AdminPaymentSettingsPage() {
  const supabase = createClient();
  const [settings, setSettings] = useState<PaymentSetting[]>([]);
  const [loading, setLoading] = useState(true);
  const [savingId, setSavingId] = useState<string | null>(null);

  // Form states maps
  const [names, setNames] = useState<Record<string, string>>({});
  const [numbers, setNumbers] = useState<Record<string, string>>({});
  const [qrPreviews, setQrPreviews] = useState<Record<string, string>>({});

  async function loadSettings() {
    setLoading(true);
    const { data } = await supabase.from('payment_settings').select('*').order('id');
    if (data) {
      setSettings(data);
      const initialNames: Record<string, string> = {};
      const initialNumbers: Record<string, string> = {};
      const initialPreviews: Record<string, string> = {};

      for (const item of data) {
        initialNames[item.id] = item.account_name;
        initialNumbers[item.id] = item.account_number;
        if (item.qr_file_path) {
          const { data: urlData } = supabase.storage.from('booking-attachments').getPublicUrl(item.qr_file_path);
          if (urlData?.publicUrl) initialPreviews[item.id] = urlData.publicUrl;
        }
      }
      setNames(initialNames);
      setNumbers(initialNumbers);
      setQrPreviews(initialPreviews);
    }
    setLoading(false);
  }

  useEffect(() => { loadSettings(); }, []);

  const handleQrUpload = async (id: string, file: File) => {
    setSavingId(id);
    try {
      const fileExt = file.name.split('.').pop();
      const filePath = `qr_codes/qr_${id}_${Date.now()}.${fileExt}`;

      // Upload image to storage bucket
      const { error: uploadError } = await supabase.storage
        .from('booking-attachments')
        .upload(filePath, file, { upsert: false, cacheControl: '3600' });

      if (uploadError) throw uploadError;

      // Update row reference pointer mapping
      const { error: dbError } = await supabase
        .from('payment_settings')
        .update({ qr_file_path: filePath, updated_at: new Date() })
        .eq('id', id);

      if (dbError) throw dbError;

      alert("QR code attachment updated successfully!");
      loadSettings();
    } catch (err: any) {
      alert(`File pipeline execution error: ${err.message}`);
    } finally {
      setSavingId(null);
    }
  };

  const handleTextUpdate = async (id: string) => {
    setSavingId(id);
    try {
      const { error } = await supabase
        .from('payment_settings')
        .update({
          account_name: names[id],
          account_number: numbers[id],
          updated_at: new Date()
        })
        .eq('id', id);

      if (error) throw error;
      alert("Account information credentials updated successfully!");
      loadSettings();
    } catch (err: any) {
      alert(`Database save rejection: ${err.message}`);
    } finally {
      setSavingId(null);
    }
  };

  if (loading) return <p className="p-12 text-zinc-400 text-center text-xs italic animate-pulse">Syncing credential gateways...</p>;

  return (
    <section className="space-y-6 max-w-4xl mx-auto animate-fadeIn pb-12">
      <div className="border-b pb-4">
        <p className="text-xs uppercase tracking-[0.3em] text-emerald-600 font-extrabold">System Settings</p>
        <h2 className="text-2xl font-black text-zinc-900 tracking-tight">Manage Payment Gateways</h2>
        <p className="text-xs text-zinc-500 mt-0.5">Modify the official accounts and QR codes displayed to public clients during checkout.</p>
      </div>

      <div className="grid gap-6 md:grid-cols-2">
        {settings.map((gate) => (
          <div key={gate.id} className="bg-white border border-zinc-200 rounded-3xl p-5 shadow-sm space-y-4 relative flex flex-col justify-between">
            <div className="space-y-4">
              <div className="flex items-center justify-between border-b pb-2">
                <h3 className="font-bold text-zinc-900 text-sm">{gate.provider_name}</h3>
                <span className="text-[10px] uppercase font-mono bg-zinc-100 text-zinc-500 px-2 py-0.5 rounded border">ID: {gate.id}</span>
              </div>

              {/* Text configurations inputs */}
              <div className="space-y-3 text-xs">
                <div>
                  <label className="block font-bold text-zinc-700 mb-1">Registered Account Name</label>
                  <input type="text" value={names[gate.id] || ''} onChange={e => setNames(prev => ({ ...prev, [gate.id]: e.target.value }))} className="w-full border rounded-xl bg-zinc-50 px-3 py-2 text-sm focus:outline-none focus:border-emerald-500 font-semibold" />
                </div>
                <div>
                  <label className="block font-bold text-zinc-700 mb-1">Account Number / Mobile phone</label>
                  <input type="text" value={numbers[gate.id] || ''} onChange={e => setNumbers(prev => ({ ...prev, [gate.id]: e.target.value }))} className="w-full border rounded-xl bg-zinc-50 px-3 py-2 text-sm focus:outline-none focus:border-emerald-500 font-mono font-bold" />
                </div>
              </div>

              {/* Dynamic QR image controller wrapper section */}
              <div className="pt-2">
                <label className="block text-xs font-bold text-zinc-700 mb-1.5">Official QR Code Matrix</label>
                <div className="flex items-center gap-4 bg-zinc-50 border p-3 rounded-2xl">
                  <div className="h-20 w-20 bg-white border border-zinc-200 rounded-xl overflow-hidden relative flex items-center justify-center shrink-0 shadow-inner">
                    {qrPreviews[gate.id] ? (
                      <img src={qrPreviews[gate.id]} alt="Dynamic gateway badge" className="h-full w-full object-contain" />
                    ) : (
                      <span className="text-zinc-300 text-xl">🖼️</span>
                    )}
                  </div>
                  <div className="space-y-1">
                    <p className="text-[11px] text-zinc-400 leading-normal">Upload a crisp screenshot of your account's receiving QR code matrix template.</p>
                    <input type="file" accept="image/*" id={`file-${gate.id}`} disabled={savingId !== null} onChange={e => e.target.files?.[0] && handleQrUpload(gate.id, e.target.files[0])} className="hidden" />
                    {/* 🌟 EMERALD GREEN UPLOAD LABEL BUTTON */}
                    <label htmlFor={`file-${gate.id}`} className="inline-block bg-emerald-50 text-emerald-700 border border-emerald-200 px-3 py-1.5 rounded-lg font-bold text-[11px] cursor-pointer hover:bg-emerald-100 transition shadow-sm">
                      ✨ Upload Image
                    </label>
                  </div>
                </div>
              </div>
            </div>

            {/* 🌟 EMERALD GREEN SAVE BUTTON */}
            <button type="button" disabled={savingId !== null} onClick={() => handleTextUpdate(gate.id)} className="w-full bg-emerald-600 text-white text-xs font-bold py-2.5 rounded-xl hover:bg-emerald-700 transition mt-4 uppercase tracking-wider disabled:bg-zinc-200">
              {savingId === gate.id ? 'Updating records...' : 'Save Text Account Data'}
            </button>
          </div>
        ))}
      </div>
    </section>
  );
}