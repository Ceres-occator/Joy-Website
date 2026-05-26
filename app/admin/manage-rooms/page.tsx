'use client'

import { useState, useEffect } from 'react';
import { createClient } from '@/utils/supabase/client';

interface Location {
  id: string;
  name: string;
  address: string | null;
  image_url: string | null;
}

interface Villa {
  id: string;
  location_id: string;
  name: string;
  description: string | null;
  image_url: string | null;
  inclusions: string[];
  category_type: string[];
}

interface Package {
  id: string;
  villa_id: string;
  name: 'venue_only' | 'with_catering' | 'accommodation_only';
  excess_pax_rate: number;
}

interface RateTier {
  id: string;
  package_id: string;
  base_pax: number;
  time_of_day: 'day' | 'evening';
  day_group: 'weekday' | 'weekend_holiday';
  price: number;
}

export default function ManageRoomsPage() {
  const supabase = createClient();

  const [locations, setLocations] = useState<Location[]>([]);
  const [villas, setVillas] = useState<Villa[]>([]);
  const [packages, setPackages] = useState<Package[]>([]);
  const [rateTiers, setRateTiers] = useState<RateTier[]>([]);

  const [selectedLocation, setSelectedLocation] = useState<Location | null>(null);
  const [selectedVilla, setSelectedVilla] = useState<Villa | null>(null);
  const [selectedPackage, setSelectedPackage] = useState<Package | null>(null);

  const [loading, setLoading] = useState<boolean>(true);
  const [uploading, setUploading] = useState<boolean>(false);
  const [activeForm, setActiveForm] = useState<'location' | 'villa' | 'rate_tier' | null>(null);
  const [editTargetId, setEditTargetId] = useState<string | null>(null);

  // Form Fields Buffers
  const [locName, setLocName] = useState('');
  const [locAddress, setLocAddress] = useState('');
  const [locImage, setLocImage] = useState('');

  const [villaName, setVillaName] = useState('');
  const [villaDesc, setVillaDesc] = useState('');
  const [villaImage, setVillaImage] = useState('');
  const [villaInclusions, setVillaInclusions] = useState<string[]>([]);
  const [villaCategories, setVillaCategories] = useState<string[]>([]);
  const [newInclusionItem, setNewInclusionItem] = useState('');

  // EMBEDDED PACKAGES STRUCTURAL STATE BUFFERS
  const [pkgCateringActive, setPkgCateringActive] = useState(true);
  const [pkgCateringRate, setPkgCateringRate] = useState<number>(300);
  const [pkgVenueActive, setPkgVenueActive] = useState(false);
  const [pkgVenueRate, setPkgVenueRate] = useState<number>(300);
  const [pkgAccomActive, setPkgAccomActive] = useState(false);
  const [pkgAccomRate, setPkgAccomRate] = useState<number>(400);

  const [tierBasePax, setTierBasePax] = useState<number>(50);
  const [tierTimeSlot, setTierTimeSlot] = useState<'day' | 'evening'>('day');
  const [tierDayGroup, setTierDayGroup] = useState<'weekday' | 'weekend_holiday'>('weekday');
  const [tierPrice, setTierPrice] = useState<number>(0);

  async function loadInitialData() {
    setLoading(true);
    const { data: locData } = await supabase.from('locations').select('*').order('name');
    const { data: vilData } = await supabase.from('villas').select('*').order('name');
    if (locData) setLocations(locData);
    if (vilData) setVillas(vilData);
    setLoading(false);
  }

  useEffect(() => { loadInitialData(); }, []);

  useEffect(() => {
    if (!selectedVilla || !selectedVilla.id) {
      setPackages([]);
      setSelectedPackage(null);
      return;
    }
    async function loadPackagesAndRates() {
      const { data: pkgData } = await supabase.from('packages').select('*').eq('villa_id', selectedVilla!.id);
      if (pkgData) {
        setPackages(pkgData);
        if (pkgData.length > 0) setSelectedPackage(pkgData[0]);
        else setSelectedPackage(null);
      }
    }
    loadPackagesAndRates();
  }, [selectedVilla]);

  useEffect(() => {
    if (!selectedPackage || !selectedPackage.id) {
      setRateTiers([]);
      return;
    }
    async function loadTiers() {
      const { data: tierData } = await supabase.from('rate_tiers').select('*').eq('package_id', selectedPackage!.id).order('base_pax');
      if (tierData) setRateTiers(tierData);
    }
    loadTiers();
  }, [selectedPackage]);

  const handleImageUpload = async (e: React.ChangeEvent<HTMLInputElement>, targetFolder: 'locations' | 'villas') => {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploading(true);
    try {
      const extension = file.name.split('.').pop();
      const relativeStoragePath = `${targetFolder}/asset_${Date.now()}.${extension}`;
      const { error } = await supabase.storage.from('property-listings').upload(relativeStoragePath, file);
      if (error) throw error;

      const { data: urlData } = supabase.storage.from('property-listings').getPublicUrl(relativeStoragePath);
      if (targetFolder === 'locations') setLocImage(urlData.publicUrl);
      if (targetFolder === 'villas') setVillaImage(urlData.publicUrl);
    } catch (err: any) {
      alert(`Upload failure: ${err.message}`);
    } finally { setUploading(false); }
  };

  const saveLocation = async (e: React.FormEvent) => {
    e.preventDefault();
    const payload = { name: locName, address: locAddress, image_url: locImage || null };
    if (editTargetId) {
      const { data } = await supabase.from('locations').update(payload).eq('id', editTargetId).select();
      if (data) setLocations(prev => prev.map(l => l.id === editTargetId ? data[0] : l));
    } else {
      const { data } = await supabase.from('locations').insert([payload]).select();
      if (data) setLocations(prev => [...prev, data[0]]);
    }
    closeFormModal();
  };

  const deleteLocation = async (id: string) => {
    if (!confirm("Purge branch? All child dimensions drop.")) return;
    await supabase.from('locations').delete().eq('id', id);
    setLocations(prev => prev.filter(l => l.id !== id));
    if (selectedLocation?.id === id) setSelectedLocation(null);
  };

  const saveVilla = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedLocation) return;

    setLoading(true);
    const bodyPayload = {
      villaId: editTargetId,
      locationId: selectedLocation.id,
      name: villaName,
      description: villaDesc,
      imageUrl: villaImage,
      inclusions: villaInclusions,
      categoryType: villaCategories,
      pkgCateringActive, pkgCateringRate,
      pkgVenueActive, pkgVenueRate,
      pkgAccomActive, pkgAccomRate
    };

    try {
      const res = await fetch('/api/admin/villas', {
        method: editTargetId ? 'PUT' : 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(bodyPayload)
      });
      if (res.ok) {
        alert("Villa specifications and database package items successfully synchronized!");
        closeFormModal();
        loadInitialData();
      } else {
        const err = await res.json();
        alert(`Failed saving entity: ${err.error}`);
      }
    } catch (err) {
      console.error(err);
    } finally { setLoading(false); }
  };

  const deleteVilla = async (id: string) => {
    if (!confirm("Delete villa listing row?")) return;
    await supabase.from('villas').delete().eq('id', id);
    setVillas(prev => prev.filter(v => v.id !== id));
    if (selectedVilla?.id === id) setSelectedVilla(null);
  };

  const saveRateTier = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedPackage) return;
    const payload = { package_id: selectedPackage.id, base_pax: Number(tierBasePax), time_of_day: tierTimeSlot, day_group: tierDayGroup, price: Number(tierPrice) };
    const { data } = await supabase.from('rate_tiers').insert([payload]).select();
    if (data) setRateTiers(prev => [...prev, data[0]]);
    closeFormModal();
  };

  const deleteRateTier = async (id: string) => {
    await supabase.from('rate_tiers').delete().eq('id', id);
    setRateTiers(prev => prev.filter(t => t.id !== id));
  };

  const addInclusionChip = () => {
    if (!newInclusionItem.trim()) return;
    setVillaInclusions(prev => [...prev, newInclusionItem.trim()]);
    setNewInclusionItem('');
  };

  const toggleCategoryCheck = (cat: string) => {
    setVillaCategories(prev => prev.includes(cat) ? prev.filter(c => c !== cat) : [...prev, cat]);
  };

  const applyPreset = (presetType: 'events_only' | 'accommodation_only' | 'combo_all') => {
    if (presetType === 'events_only') {
      setVillaCategories(['Events']);
      setPkgCateringActive(true);
      setPkgCateringRate(300);
      setPkgVenueActive(true);
      setPkgVenueRate(300);
      setPkgAccomActive(false);
    } else if (presetType === 'accommodation_only') {
      setVillaCategories(['Accommodation']);
      setPkgCateringActive(false);
      setPkgVenueActive(false);
      setPkgAccomActive(true);
      setPkgAccomRate(400);
    } else if (presetType === 'combo_all') {
      setVillaCategories(['Events', 'Accommodation']);
      setPkgCateringActive(true);
      setPkgCateringRate(300);
      setPkgVenueActive(true);
      setPkgVenueRate(300);
      setPkgAccomActive(true);
      setPkgAccomRate(400);
    }
  };

  const openNewLocationForm = () => {
    setEditTargetId(null); setLocName(''); setLocAddress(''); setLocImage(''); setActiveForm('location');
  };

  const openEditLocationForm = (loc: Location) => {
    setEditTargetId(loc.id); setLocName(loc.name); setLocAddress(loc.address || ''); setLocImage(loc.image_url || ''); setActiveForm('location');
  };

  const openNewVillaForm = () => {
    setEditTargetId(null); setVillaName(''); setVillaDesc(''); setVillaImage(''); setVillaInclusions([]); setVillaCategories([]);
    setPkgCateringActive(true); setPkgCateringRate(300); setPkgVenueActive(false); setPkgVenueRate(300); setPkgAccomActive(false); setPkgAccomRate(400);
    setActiveForm('villa');
  };

  const openEditVillaForm = async (vil: Villa) => {
    setEditTargetId(vil.id); setVillaName(vil.name); setVillaDesc(vil.description || ''); setVillaImage(vil.image_url || ''); setVillaInclusions(vil.inclusions || []); setVillaCategories(vil.category_type || []);
    
    setPkgCateringActive(false); setPkgVenueActive(false); setPkgAccomActive(false);
    const { data: existingPackages } = await supabase.from('packages').select('*').eq('villa_id', vil.id);
    if (existingPackages) {
      existingPackages.forEach(p => {
        if (p.name === 'with_catering') { setPkgCateringActive(true); setPkgCateringRate(p.excess_pax_rate); }
        if (p.name === 'venue_only') { setPkgVenueActive(true); setPkgVenueRate(p.excess_pax_rate); }
        if (p.name === 'accommodation_only') { setPkgAccomActive(true); setPkgAccomRate(p.excess_pax_rate); }
      });
    }
    setActiveForm('villa');
  };

  const openNewRateTierForm = () => {
    setEditTargetId(null); setTierBasePax(50); setTierTimeSlot('day'); setTierDayGroup('weekday'); setTierPrice(0); setActiveForm('rate_tier');
  };

  const closeFormModal = () => { setActiveForm(null); setEditTargetId(null); };

  const filteredVillas = villas.filter(v => selectedLocation ? v.location_id === selectedLocation.id : false);

  return (
    <section className="space-y-6 max-w-6xl mx-auto animate-fadeIn pb-12">
      
      <div className="flex flex-col gap-1 border-b border-zinc-200 pb-4">
        <p className="text-xs uppercase tracking-[0.3em] text-emerald-600 font-extrabold">Manage Properties</p>
        <h2 className="text-2xl font-black text-zinc-900 tracking-tight">Property Management Board</h2>
      </div>

      {/* BRANCHES LIST COMPONENT */}
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <div>
            <h3 className="text-xs font-black text-zinc-400 uppercase tracking-widest">📍 Layer 1: Regional Clusters</h3>
          </div>
          <button onClick={openNewLocationForm} className="bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs px-3.5 py-2 rounded-xl shadow-sm transition">+ Add Branch Location</button>
        </div>

        <div className="grid gap-4 sm:grid-cols-3">
          {locations.map((loc) => (
            <div 
              key={loc.id} 
              onClick={() => { setSelectedLocation(loc); setSelectedVilla(null); }}
              className={`rounded-2xl border p-4 cursor-pointer transition flex flex-col justify-between space-y-3 shadow-sm ${selectedLocation?.id === loc.id ? 'border-emerald-600 bg-white ring-2 ring-emerald-600/10' : 'border-zinc-200 bg-zinc-50 hover:bg-white'}`}
            >
              <div className="flex gap-3">
                {loc.image_url && <img src={loc.image_url} className="w-12 h-12 rounded-xl object-cover border" alt="Profile" />}
                <div>
                  <h4 className="font-bold text-zinc-900 text-sm">{loc.name}</h4>
                  <p className="text-xs text-zinc-400 truncate max-w-[180px]">{loc.address || 'N/A'}</p>
                </div>
              </div>
              <div className="flex items-center justify-end space-x-1 pt-2 border-t text-[11px] font-bold">
                <button onClick={(e) => { e.stopPropagation(); openEditLocationForm(loc); }} className="text-zinc-600 hover:bg-zinc-100 px-2 py-1 rounded-lg">Edit</button>
                <button onClick={(e) => { e.stopPropagation(); deleteLocation(loc.id); }} className="text-red-600 hover:bg-red-50 px-2 py-1 rounded-lg">Remove</button>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* VILLAS PROFILE COMPONENT GRID */}
      {selectedLocation && (
        <div className="space-y-3 pt-4 border-t animate-slideUp">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="text-xs font-black text-zinc-400 uppercase tracking-widest">🏡 Layer 2: Villa Sub-Estates inside <span className="text-zinc-900 underline font-black">{selectedLocation.name}</span></h3>
            </div>
            <button onClick={openNewVillaForm} className="bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs px-3.5 py-2 rounded-xl shadow-sm transition">+ Add Villa Listing</button>
          </div>

          {filteredVillas.length === 0 ? (
            <div className="p-8 border border-dashed rounded-2xl text-center text-xs text-zinc-400 bg-zinc-50 italic">No villas mapped inside this branch yet.</div>
          ) : (
            <div className="grid gap-4 sm:grid-cols-2">
              {filteredVillas.map((vil) => (
                <div 
                  key={vil.id} 
                  onClick={() => setSelectedVilla(vil)}
                  className={`rounded-3xl border p-5 cursor-pointer transition flex flex-col justify-between min-h-[150px] shadow-sm ${selectedVilla?.id === vil.id ? 'border-emerald-600 bg-white ring-2 ring-emerald-600/5' : 'border-zinc-200 bg-zinc-50/50 hover:bg-white'}`}
                >
                  <div className="flex gap-4">
                    {vil.image_url && <img src={vil.image_url} className="w-16 h-16 rounded-xl object-cover border" alt="Villa" />}
                    <div className="space-y-1 flex-1">
                      <div className="flex flex-wrap gap-1">
                        {vil.category_type?.map(c => <span key={c} className="text-[8px] font-extrabold uppercase bg-emerald-50 border border-emerald-100 text-emerald-700 px-1.5 py-0.2 rounded">{c}</span>)}
                      </div>
                      <h4 className="font-bold text-zinc-900 text-base">{vil.name}</h4>
                      <p className="text-xs text-zinc-500 line-clamp-2 leading-relaxed">{vil.description}</p>
                    </div>
                  </div>
                  <div className="flex items-center justify-end space-x-1 pt-3 border-t mt-4 text-xs font-bold">
                    <button onClick={(e) => { e.stopPropagation(); openEditVillaForm(vil); }} className="text-zinc-600 hover:bg-zinc-100 px-3 py-1.5 rounded-xl">Edit Config & Packages</button>
                    <button onClick={(e) => { e.stopPropagation(); deleteVilla(vil.id); }} className="text-red-600 hover:bg-red-50 px-3 py-1.5 rounded-xl">Delete</button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* RATES BRACKETS MANAGEMENT MATRIX COMPONENT */}
      {selectedVilla && (
        <div className="grid gap-6 md:grid-cols-[240px_1fr] pt-6 border-t animate-slideUp">
          <div className="space-y-3">
            <h4 className="text-xs font-black text-zinc-400 uppercase tracking-widest">📦 Layer 3: Configured Packages</h4>
            <div className="space-y-1.5">
              {packages.map((pkg) => (
                <div 
                  key={pkg.id}
                  onClick={() => setSelectedPackage(pkg)}
                  className={`p-3 rounded-xl border text-xs cursor-pointer transition flex flex-col justify-between ${selectedPackage?.id === pkg.id ? 'bg-zinc-900 text-white border-zinc-900 shadow-sm' : 'bg-white border-zinc-200 text-zinc-700 hover:bg-zinc-50'}`}
                >
                  <p className="font-bold uppercase tracking-wide text-[10px]">{pkg.name.replace('_', ' ')}</p>
                  <p className="text-[11px] mt-0.5 opacity-80">Surcharge: ₱{pkg.excess_pax_rate}/Head</p>
                </div>
              ))}
            </div>
          </div>

          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <div>
                <h4 className="text-xs font-black text-zinc-400 uppercase tracking-widest">📊 Layer 4: Numerical Rate Brackets Matrix</h4>
              </div>
              {selectedPackage && (
                <button onClick={openNewRateTierForm} className="bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs px-3 py-1.5 rounded-xl transition shadow-sm">+ Create Rate Tier</button>
              )}
            </div>

            {!selectedPackage ? (
              <div className="p-12 text-center text-xs text-zinc-400 bg-zinc-50 rounded-2xl border">Select a package from the column rail directory.</div>
            ) : rateTiers.length === 0 ? (
              <div className="p-12 text-center text-xs text-zinc-400 bg-zinc-50 rounded-2xl border border-dashed">No base brackets found for this package. Create a tier above.</div>
            ) : (
              <div className="bg-white rounded-2xl border overflow-hidden shadow-sm">
                <table className="w-full text-left text-xs text-zinc-600">
                  <thead className="bg-zinc-50 font-bold border-b text-[10px] text-zinc-400 uppercase">
                    <tr>
                      <th className="p-3">Max Cap Base</th>
                      <th className="p-3">Schedule Slot</th>
                      <th className="p-3">Day Class</th>
                      <th className="p-3">Base Price</th>
                      <th className="p-3 text-right">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-zinc-100">
                    {rateTiers.map((tier) => (
                      <tr key={tier.id} className="hover:bg-zinc-50/50">
                        <td className="p-3 font-bold text-zinc-900">{tier.base_pax} Guests Limit</td>
                        <td className="p-3 uppercase font-semibold text-zinc-500">⏳ {tier.time_of_day}</td>
                        <td className="p-3">
                          <span className={`px-2 py-0.5 rounded border text-[9px] font-bold uppercase ${tier.day_group === 'weekday' ? 'bg-zinc-50 text-zinc-500' : 'bg-purple-50 text-purple-700 border-purple-200'}`}>{tier.day_group.replace('_', ' ')}</span>
                        </td>
                        <td className="p-3 font-mono font-bold text-emerald-600 text-sm">₱{Number(tier.price).toLocaleString()}</td>
                        <td className="p-3 text-right">
                          <button onClick={() => deleteRateTier(tier.id)} className="text-red-500 font-bold hover:underline">Delete</button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>
      )}

      {/* MODAL INPUT WORKSPACE OVERLAYS */}
      {activeForm && (
        <div className="fixed inset-0 bg-zinc-950/60 backdrop-blur-sm z-50 flex items-center justify-center p-4 animate-fadeIn" onClick={closeFormModal}>
          <div className="bg-white rounded-3xl p-6 max-w-lg w-full space-y-4 shadow-2xl border text-xs" onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between border-b pb-3">
              <h3 className="font-bold text-zinc-900 text-base uppercase">⚙️ Modify Infrastructure Parameter Settings</h3>
              <button onClick={closeFormModal} className="text-zinc-400 text-sm">✕</button>
            </div>

            {activeForm === 'location' && (
              <form onSubmit={saveLocation} className="space-y-4">
                <div><label className="block font-bold mb-1">Branch Name</label><input type="text" required value={locName} onChange={e => setLocName(e.target.value)} className="w-full border rounded-xl bg-zinc-50 px-3 py-2 text-sm" /></div>
                <div><label className="block font-bold mb-1">Physical Address</label><input type="text" value={locAddress} onChange={e => setLocAddress(e.target.value)} className="w-full border rounded-xl bg-zinc-50 px-3 py-2 text-sm" /></div>
                <div>
                  <label className="block font-bold mb-1">Cover Picture</label>
                  <input type="file" accept="image/*" onChange={e => handleImageUpload(e, 'locations')} className="w-full text-zinc-500 file:mr-3 file:py-1 file:px-3 file:rounded-xl file:border-0 file:bg-zinc-900 file:text-white file:font-bold file:cursor-pointer" />
                </div>
                <button type="submit" disabled={uploading} className="w-full bg-emerald-600 hover:bg-emerald-700 text-white font-bold py-2.5 rounded-xl transition mt-2 text-xs uppercase tracking-wider">Save Branch Location</button>
              </form>
            )}

            {activeForm === 'villa' && (
              <form onSubmit={saveVilla} className="space-y-4 max-h-[80vh] overflow-y-auto pr-1">
                
                {/* QUICK CONFIGURATION PRESETS TOOLBAR */}
                <div className="bg-zinc-50 border p-3 rounded-2xl space-y-1.5">
                  <span className="block text-[10px] font-black text-zinc-400 uppercase tracking-widest">⚡ Quick Package Config Presets</span>
                  <div className="flex flex-wrap gap-1.5">
                    <button type="button" onClick={() => applyPreset('events_only')} className="bg-white hover:bg-emerald-50 text-emerald-700 border border-zinc-200 hover:border-emerald-300 font-bold px-2.5 py-1.5 rounded-xl text-[10px] transition">🎭 Standard Events</button>
                    <button type="button" onClick={() => applyPreset('accommodation_only')} className="bg-white hover:bg-emerald-50 text-emerald-700 border border-zinc-200 hover:border-emerald-300 font-bold px-2.5 py-1.5 rounded-xl text-[10px] transition">🏡 Full Overnight Stay</button>
                    <button type="button" onClick={() => applyPreset('combo_all')} className="bg-emerald-50 hover:bg-emerald-100 border border-emerald-200 text-emerald-800 font-black px-2.5 py-1.5 rounded-xl text-[10px] transition">🚀 All-Inclusive Combo</button>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div><label className="block font-bold mb-1">Villa Estate Name</label><input type="text" required value={villaName} onChange={e => setVillaName(e.target.value)} className="w-full border rounded-xl bg-zinc-50 px-3 py-2 text-sm" /></div>
                  <div>
                    <label className="block font-bold mb-1">Media Profile Banner</label>
                    <input type="file" accept="image/*" onChange={e => handleImageUpload(e, 'villas')} className="w-full text-zinc-400 file:py-1 file:px-2 file:rounded-lg file:border-0 file:bg-zinc-900 file:text-white" />
                  </div>
                </div>

                <div><label className="block font-bold mb-1">Marketing Description</label><textarea rows={2} value={villaDesc} onChange={e => setVillaDesc(e.target.value)} className="w-full border rounded-xl bg-zinc-50 px-3 py-2 text-sm" /></div>

                <div className="grid grid-cols-2 gap-4 border p-3 rounded-2xl bg-zinc-50/50">
                  <div>
                    <label className="block font-black text-zinc-400 uppercase text-[9px] tracking-wider mb-1.5">1. Purpose Category Options</label>
                    <div className="space-y-2 font-bold text-zinc-700">
                      {['Events', 'Accommodation'].map(cat => (
                        <label key={cat} className="flex items-center space-x-2 cursor-pointer"><input type="checkbox" checked={villaCategories.includes(cat)} onChange={() => toggleCategoryCheck(cat)} className="accent-emerald-600" /><span>{cat}</span></label>
                      ))}
                    </div>
                  </div>

                  <div>
                    <label className="block font-black text-zinc-400 uppercase text-[9px] tracking-wider mb-1">2. Core Features Checklist</label>
                    {/* 🌟 RESPONSE ARCHITECTURE FIX: Shifted from narrow single line row flex wrapper to screen fluid explicit col grids */}
                    <div className="grid grid-cols-1 sm:grid-cols-[1fr_auto] gap-2">
                      <input 
                        type="text" 
                        value={newInclusionItem} 
                        onChange={e => setNewInclusionItem(e.target.value)} 
                        placeholder="e.g., Free Pool access" 
                        className="w-full border rounded-xl bg-white px-3 py-1.5 focus:outline-none focus:border-zinc-900 text-xs font-semibold" 
                      />
                      <button 
                        type="button" 
                        onClick={addInclusionChip} 
                        className="w-full sm:w-auto bg-zinc-900 text-white font-bold px-4 py-2 rounded-xl hover:bg-zinc-800 transition text-xs whitespace-nowrap"
                      >
                        Append Item
                      </button>
                    </div>
                    <div className="flex flex-wrap gap-1 mt-2.5 max-h-[70px] overflow-y-auto border p-1.5 rounded-xl bg-white shadow-inner">
                      {villaInclusions.map((inc, i) => <span key={i} className="bg-zinc-100 border text-[9px] font-bold px-1.5 py-0.5 rounded text-zinc-600">✓ {inc}</span>)}
                    </div>
                  </div>
                </div>

                <div className="space-y-2 border-t pt-3">
                  <label className="block font-black text-emerald-600 uppercase text-[10px] tracking-widest">📦 Relational Database Packages Framework Setup</label>
                  <div className="space-y-2.5 font-semibold bg-emerald-950/5 border border-emerald-100 p-3.5 rounded-2xl">
                    
                    {/* PACKAGE A: WITH CATERING */}
                    <div className="flex items-center justify-between gap-4">
                      <label className="flex items-center space-x-2 cursor-pointer shrink-0 w-32"><input type="checkbox" checked={pkgCateringActive} onChange={e => setPkgCateringActive(e.target.checked)} className="accent-emerald-600" /><span className="text-zinc-900 font-bold uppercase text-[10px]">Catering Support</span></label>
                      {pkgCateringActive && (
                        <div className="flex items-center gap-1.5 animate-fadeIn"><span className="text-zinc-400 text-[11px]">Excess Head Surcharge:</span><input type="number" value={pkgCateringRate} onChange={e => setPkgCateringRate(Number(e.target.value))} className="border rounded-lg bg-white px-2 py-1 w-20 font-mono font-bold text-center text-emerald-700" /><span className="text-zinc-400 font-mono">PHP</span></div>
                      )}
                    </div>

                    {/* PACKAGE B: VENUE ONLY */}
                    <div className="flex items-center justify-between gap-4 border-t pt-2 border-emerald-100/50">
                      <label className="flex items-center space-x-2 cursor-pointer shrink-0 w-32"><input type="checkbox" checked={pkgVenueActive} onChange={e => setPkgVenueActive(e.target.checked)} className="accent-emerald-600" /><span className="text-zinc-900 font-bold uppercase text-[10px]">Venue Only</span></label>
                      {pkgVenueActive && (
                        <div className="flex items-center gap-1.5 animate-fadeIn"><span className="text-zinc-400 text-[11px]">Excess Head Surcharge:</span><input type="number" value={pkgVenueRate} onChange={e => setPkgVenueRate(Number(e.target.value))} className="border rounded-lg bg-white px-2 py-1 w-20 font-mono font-bold text-center text-emerald-700" /><span className="text-zinc-400 font-mono">PHP</span></div>
                      )}
                    </div>

                    {/* PACKAGE C: ACCOMMODATION ONLY */}
                    <div className="flex items-center justify-between gap-4 border-t pt-2 border-emerald-100/50">
                      <label className="flex items-center space-x-2 cursor-pointer shrink-0 w-32"><input type="checkbox" checked={pkgAccomActive} onChange={e => setPkgAccomActive(e.target.checked)} className="accent-emerald-600" /><span className="text-zinc-900 font-bold uppercase text-[10px]">Accommodation Only</span></label>
                      {pkgAccomActive && (
                        <div className="flex items-center gap-1.5 animate-fadeIn"><span className="text-zinc-400 text-[11px]">Excess Head Surcharge:</span><input type="number" value={pkgAccomRate} onChange={e => setPkgAccomRate(Number(e.target.value))} className="border rounded-lg bg-white px-2 py-1 w-20 font-mono font-bold text-center text-emerald-700" /><span className="text-zinc-400 font-mono">PHP</span></div>
                      )}
                    </div>
                  </div>
                </div>

                <button type="submit" className="w-full bg-emerald-600 text-white font-bold py-3 rounded-xl hover:bg-emerald-700 transition mt-2 shadow-sm uppercase tracking-wider text-xs">Save Property & Packages Deck</button>
              </form>
            )}

            {activeForm === 'rate_tier' && (
              <form onSubmit={saveRateTier} className="space-y-4">
                <div className="grid grid-cols-2 gap-3">
                  <div><label className="block font-bold mb-1">Base Pax Cap</label><input type="number" required value={tierBasePax} onChange={e => setTierBasePax(Number(e.target.value))} className="w-full border rounded-xl bg-zinc-50 px-3 py-2 text-sm font-mono font-bold" /></div>
                  <div><label className="block font-bold mb-1">Time Slot Window</label><select value={tierTimeSlot} onChange={e => setTierTimeSlot(e.target.value as any)} className="w-full border rounded-xl bg-zinc-50 px-3 py-2 text-sm font-bold"><option value="day">Day Frame Slot</option><option value="evening">Evening Frame Slot</option></select></div>
                </div>
                <div><label className="block font-bold mb-1">Calendar Day Type Class</label><select value={tierDayGroup} onChange={e => setTierDayGroup(e.target.value as any)} className="w-full border rounded-xl bg-zinc-50 px-3 py-2 text-sm font-bold"><option value="weekday">Standard Weekday</option><option value="weekend_holiday">Weekend / Holiday Schedule</option></select></div>
                <div><label className="block font-bold mb-1">Baseline Rent Cost (₱)</label><input type="number" required value={tierPrice} onChange={e => setTierPrice(Number(e.target.value))} className="w-full border rounded-xl bg-zinc-50 px-3 py-2.5 font-mono font-bold text-emerald-600 text-sm" /></div>
                <button type="submit" className="w-full bg-emerald-600 hover:bg-emerald-700 text-white font-bold py-2.5 rounded-xl transition mt-2 text-xs uppercase tracking-wider">Commit Rate Tier Matrix</button>
              </form>
            )}

          </div>
        </div>
      )}

    </section>
  );
}