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

  // 🗂️ Core Datasets
  const [locations, setLocations] = useState<Location[]>([]);
  const [villas, setVillas] = useState<Villa[]>([]);
  const [packages, setPackages] = useState<Package[]>([]);
  const [rateTiers, setRateTiers] = useState<RateTier[]>([]);

  // 📍 Navigation Focus Context Tracker
  const [selectedLocation, setSelectedLocation] = useState<Location | null>(null);
  const [selectedVilla, setSelectedVilla] = useState<Villa | null>(null);
  const [selectedPackage, setSelectedPackage] = useState<Package | null>(null);

  // 🛠️ UI Interactive Controls & Loaders
  const [loading, setLoading] = useState<boolean>(true);
  const [uploading, setUploading] = useState<boolean>(false);
  
  // 📝 Active Modals / Forms Payload State
  const [activeForm, setActiveForm] = useState<'location' | 'villa' | 'package' | 'rate_tier' | null>(null);
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

  const [pkgName, setPkgName] = useState<'venue_only' | 'with_catering' | 'accommodation_only'>('venue_only');
  const [pkgExcessPax, setPkgExcessPax] = useState<number>(0);

  const [tierBasePax, setTierBasePax] = useState<number>(50);
  const [tierTimeSlot, setTierTimeSlot] = useState<'day' | 'evening'>('day');
  const [tierDayGroup, setTierDayGroup] = useState<'weekday' | 'weekend_holiday'>('weekday');
  const [tierPrice, setTierPrice] = useState<number>(0);

  // Synchronize base configuration logs on initialization mount
  useEffect(() => {
    async function loadInitialData() {
      setLoading(true);
      const { data: locData } = await supabase.from('locations').select('*').order('name');
      const { data: vilData } = await supabase.from('villas').select('*').order('name');
      if (locData) setLocations(locData);
      if (vilData) setVillas(vilData);
      setLoading(false);
    }
    loadInitialData();
  }, []);

    // Sync lower-tier dependencies context drawers dynamically
  // 🛠️ FIX 1: Safe Guard for Packages Fetching (Lines 96 - 114)
  useEffect(() => {
    // Early return if no villa has been selected by the manager yet
    if (!selectedVilla || !selectedVilla.id) {
      setPackages([]);
      setSelectedPackage(null);
      return;
    }

    async function loadPackagesAndRates() {
      // TypeScript now knows selectedVilla is 100% NOT null here! ✅
      const { data: pkgData } = await supabase
        .from('packages')
        .select('*')
        .eq('villa_id', selectedVilla.id);

      if (pkgData) {
        setPackages(pkgData);
        if (pkgData.length > 0) {
          setSelectedPackage(pkgData[0]);
        } else {
          setSelectedPackage(null);
        }
      }
    }
    loadPackagesAndRates();
  }, [selectedVilla]);


  // 🛠️ FIX 2: Safe Guard for Rate Tiers Fetching (Lines 116 - 128)
  useEffect(() => {
    // Early return if no package has been highlighted or exists yet
    if (!selectedPackage || !selectedPackage.id) {
      setRateTiers([]);
      return;
    }

    async function loadTiers() {
      // TypeScript now knows selectedPackage is 100% NOT null here! ✅
      const { data: tierData } = await supabase
        .from('rate_tiers')
        .select('*')
        .eq('package_id', selectedPackage.id)
        .order('base_pax');

      if (tierData) setRateTiers(tierData);
    }
    loadTiers();
  }, [selectedPackage]);

  // 📁 Direct Storage Bucket Image Upload Pipeline
  const handleImageUpload = async (e: React.ChangeEvent<HTMLInputElement>, targetFolder: 'locations' | 'villas') => {
    const file = e.target.files?.[0];
    if (!file) return;

    setUploading(true);
    try {
      const extension = file.name.split('.').pop();
      const uniqueFileName = `${targetFolder}_asset_${Date.now()}.${extension}`;
      const relativeStoragePath = `${targetFolder}/${uniqueFileName}`;

      const { error: uploadError } = await supabase.storage
        .from('property-listings')
        .upload(relativeStoragePath, file);

      if (uploadError) throw uploadError;

      const { data: publicUrlData } = supabase.storage
        .from('property-listings')
        .getPublicUrl(relativeStoragePath);

      if (targetFolder === 'locations') setLocImage(publicUrlData.publicUrl);
      if (targetFolder === 'villas') setVillaImage(publicUrlData.publicUrl);

    } catch (err: any) {
      alert(`Asset storage upload failure: ${err.message}`);
    } finally {
      setUploading(false);
    }
  };

  // 📍 CRUD Operations: Locations
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
    if (!confirm("Are you sure you want to delete this location? All nested villas and rate metrics will be purged permanently.")) return;
    await supabase.from('locations').delete().eq('id', id);
    setLocations(prev => prev.filter(l => l.id !== id));
    if (selectedLocation?.id === id) setSelectedLocation(null);
  };

// 🏡 CRUD Operations: Villas
  const saveVilla = async (e: React.FormEvent) => {
    e.preventDefault();
    
    // 🛡️ Safe check to confirm a branch location is selected
    if (!selectedLocation || !selectedLocation.id) {
      alert("Please select a location branch before creating a villa.");
      return;
    }

    const targetLocationId = selectedLocation.id;

    const payload = {
      location_id: targetLocationId,
      name: villaName,
      description: villaDesc,
      image_url: villaImage || null,
      inclusions: villaInclusions,
      category_type: villaCategories
    };

    if (editTargetId) {
      const { data } = await supabase.from('villas').update(payload).eq('id', editTargetId).select();
      if (data) setVillas(prev => prev.map(v => v.id === editTargetId ? data[0] : v));
    } else {
      const { data } = await supabase.from('villas').insert([payload]).select();
      if (data) setVillas(prev => [...prev, data[0]]);
    }
    closeFormModal();
  };

  const deleteVilla = async (id: string) => {
    if (!confirm("Delete this villa listing entry? All relational pricing frameworks will instantly drop.")) return;
    await supabase.from('villas').delete().eq('id', id);
    setVillas(prev => prev.filter(v => v.id !== id));
    
    // 🛡️ Safe check using optional chaining to prevent null reference crash
    if (selectedVilla?.id === id) setSelectedVilla(null);
  };

  // 📦 CRUD Operations: Packages
  const savePackage = async (e: React.FormEvent) => {
    e.preventDefault();
    
    // 🛡️ Safe check to confirm a villa is selected
    if (!selectedVilla || !selectedVilla.id) {
      alert("Please select a villa before managing packages.");
      return;
    }

    const targetVillaId = selectedVilla.id;

    const payload = { 
      villa_id: targetVillaId, 
      name: pkgName, 
      excess_pax_rate: Number(pkgExcessPax) 
    };

    if (editTargetId) {
      const { data } = await supabase.from('packages').update(payload).eq('id', editTargetId).select();
      if (data) setPackages(prev => prev.map(p => p.id === editTargetId ? data[0] : p));
    } else {
      const { data } = await supabase.from('packages').insert([payload]).select();
      if (data) setPackages(prev => [...prev, data[0]]);
    }
    closeFormModal();
  };

  const deletePackage = async (id: string) => {
    if (!confirm("Delete this package selection template? All underlying numerical tiers will collapse.")) return;
    
    // Fire the delete request to your Supabase engine
    await supabase.from('packages').delete().eq('id', id);
    
    // Update local state dynamically to clear the UI view row
    setPackages(prev => prev.filter(p => p.id !== id));
    setSelectedPackage(null);
  };

  // 📊 CRUD Operations: Rate Tiers
  const saveRateTier = async (e: React.FormEvent) => {
    e.preventDefault();
    
    // 🛡️ Safe check to confirm a package subtype is selected
    if (!selectedPackage || !selectedPackage.id) {
      alert("Please select a package before managing rate tiers.");
      return;
    }

    const targetPackageId = selectedPackage.id;

    const payload = {
      package_id: targetPackageId,
      base_pax: Number(tierBasePax),
      time_of_day: tierTimeSlot,
      day_group: tierDayGroup,
      price: Number(tierPrice)
    };

    if (editTargetId) {
      const { data } = await supabase.from('rate_tiers').update(payload).eq('id', editTargetId).select();
      if (data) setRateTiers(prev => prev.map(t => t.id === editTargetId ? data[0] : t));
    } else {
      const { data } = await supabase.from('rate_tiers').insert([payload]).select();
      if (data) setRateTiers(prev => [...prev, data[0]]);
    }
    closeFormModal();
  };

  const deleteRateTier = async (id: string) => {
    await supabase.from('rate_tiers').delete().eq('id', id);
    setRateTiers(prev => prev.filter(t => t.id !== id));
  };

  // 🛠️ Auxiliary Field Appenders
  const addInclusionChip = () => {
    if (!newInclusionItem.trim()) return;
    setVillaInclusions(prev => [...prev, newInclusionItem.trim()]);
    setNewInclusionItem('');
  };

  const toggleCategoryCheck = (cat: string) => {
    setVillaCategories(prev => 
      prev.includes(cat) ? prev.filter(c => c !== cat) : [...prev, cat]
    );
  };

  // 🧹 Modals Window Lifecycle Cleaner
  const openNewLocationForm = () => {
    setEditTargetId(null); setLocName(''); setLocAddress(''); setLocImage(''); setActiveForm('location');
  };

  const openEditLocationForm = (loc: Location) => {
    setEditTargetId(loc.id); setLocName(loc.name); setLocAddress(loc.address || ''); setLocImage(loc.image_url || ''); setActiveForm('location');
  };

  const openNewVillaForm = () => {
    setEditTargetId(null); setVillaName(''); setVillaDesc(''); setVillaImage(''); setVillaInclusions([]); setVillaCategories([]); setActiveForm('villa');
  };

  const openEditVillaForm = (vil: Villa) => {
    setEditTargetId(vil.id); setVillaName(vil.name); setVillaDesc(vil.description || ''); setVillaImage(vil.image_url || ''); setVillaInclusions(vil.inclusions || []); setVillaCategories(vil.category_type || []); setActiveForm('villa');
  };

  const openNewPackageForm = () => {
    setEditTargetId(null); setPkgName('venue_only'); setPkgExcessPax(0); setActiveForm('package');
  };

  const openNewRateTierForm = () => {
    setEditTargetId(null); setTierBasePax(50); setTierTimeSlot('day'); setTierDayGroup('weekday'); setTierPrice(0); setActiveForm('rate_tier');
  };

  const closeFormModal = () => {
    setActiveForm(null); setEditTargetId(null);
  };

  const filteredVillas = villas.filter(v => selectedLocation ? v.location_id === selectedLocation.id : false);

  if (loading) return <p className="p-12 text-zinc-400 italic text-center text-xs animate-pulse">Loading property relational structural models...</p>;

  return (
    <section className="space-y-6 max-w-6xl mx-auto animate-fadeIn pb-12">
      
      {/* Dynamic Module Intro Section */}
      <div className="flex flex-col gap-1 border-b border-zinc-200 pb-4">
        <p className="text-xs uppercase tracking-[0.3em] text-zinc-500 sm:text-sm">Manage Properties</p>
        <h2 className="text-2xl font-semibold text-zinc-900 sm:text-3xl">Property Infrastructure Deck</h2>
      </div>

      {/* ======================================================== */}
      {/* SECTION 1: REGIONAL BRANCH LOCATIONS DECK MODULE         */}
      {/* ======================================================== */}
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <div>
            <h3 className="text-sm font-bold text-zinc-400 uppercase tracking-wider">📍 Layer 1: Operational Branches</h3>
            <p className="text-xs text-zinc-500">Select an office hub location to unlock its local villa clusters below.</p>
          </div>
          <button onClick={openNewLocationForm} className="bg-zinc-900 hover:bg-zinc-800 text-white font-bold text-xs px-3.5 py-2 rounded-xl transition shadow-sm">+ Add Branch Location</button>
        </div>

        <div className="grid gap-4 sm:grid-cols-3">
          {locations.map((loc) => (
            <div 
              key={loc.id} 
              onClick={() => { setSelectedLocation(loc); setSelectedVilla(null); }}
              className={`rounded-2xl border p-4 cursor-pointer transition-all flex flex-col justify-between space-y-3 shadow-sm ${selectedLocation?.id === loc.id ? 'border-zinc-900 bg-white ring-2 ring-zinc-900/10' : 'border-zinc-200 bg-zinc-50 hover:bg-white'}`}
            >
              <div className="flex gap-3">
                {loc.image_url && <img src={loc.image_url} className="w-12 h-12 rounded-xl object-cover bg-zinc-100 border" alt="Asset profile" />}
                <div>
                  <h4 className="font-bold text-zinc-900 text-sm">{loc.name}</h4>
                  <p className="text-xs text-zinc-400 line-clamp-1">{loc.address || 'No address provided'}</p>
                </div>
              </div>

              <div className="flex items-center justify-end space-x-1 pt-2 border-t border-zinc-100">
                <button onClick={(e) => { e.stopPropagation(); openEditLocationForm(loc); }} className="text-[11px] font-bold text-zinc-600 hover:bg-zinc-100 px-2 py-1 rounded-lg">Edit</button>
                <button onClick={(e) => { e.stopPropagation(); deleteLocation(loc.id); }} className="text-[11px] font-bold text-red-600 hover:bg-red-50 px-2 py-1 rounded-lg">Remove</button>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* ======================================================== */}
      {/* SECTION 2: VILLAS LISTINGS CONFIGURATOR (DRILL DOWN)       */}
      {/* ======================================================== */}
      {selectedLocation && (
        <div className="space-y-3 pt-4 border-t border-zinc-200 animate-slideUp">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="text-sm font-bold text-zinc-900">🏡 Villa Profiles inside: <span className="underline font-black">{selectedLocation.name}</span></h3>
              <p className="text-xs text-zinc-400">Configure villa categories, structural specifications, and view profiles.</p>
            </div>
            <button onClick={openNewVillaForm} className="bg-zinc-900 hover:bg-zinc-800 text-white font-bold text-xs px-3.5 py-2 rounded-xl transition shadow-sm">+ Add Villa Estate</button>
          </div>

          {filteredVillas.length === 0 ? (
            <div className="p-8 border border-dashed rounded-2xl text-center text-xs text-zinc-400 bg-zinc-50/50 italic">No villas mapped inside this branch yet. Create your first listing above!</div>
          ) : (
            <div className="grid gap-4 sm:grid-cols-2">
              {filteredVillas.map((vil) => (
                <div 
                  key={vil.id} 
                  onClick={() => setSelectedVilla(vil)}
                  className={`rounded-3xl border p-5 cursor-pointer transition-all flex flex-col justify-between min-h-[160px] shadow-sm ${selectedVilla?.id === vil.id ? 'border-zinc-900 bg-white ring-2 ring-zinc-900/5' : 'border-zinc-200 bg-zinc-50/50 hover:bg-white'}`}
                >
                  <div className="flex gap-4">
                    {vil.image_url && <img src={vil.image_url} className="w-20 h-20 rounded-2xl object-cover border bg-white shadow-inner" alt="Villa core profile" />}
                    <div className="space-y-1 flex-1">
                      <div className="flex flex-wrap gap-1">
                        {vil.category_type?.map(c => <span key={c} className="text-[9px] font-extrabold uppercase bg-zinc-900 text-white px-1.5 py-0.5 rounded-md">{c}</span>)}
                      </div>
                      <h4 className="font-bold text-zinc-900 text-base">{vil.name}</h4>
                      <p className="text-xs text-zinc-500 line-clamp-2 leading-relaxed">{vil.description}</p>
                    </div>
                  </div>

                  {/* Badges Inclusion Lists Preview Row */}
                  <div className="flex flex-wrap gap-1 mt-3">
                    {vil.inclusions?.slice(0, 3).map((inc, i) => <span key={i} className="text-[10px] bg-zinc-100 text-zinc-600 px-2 py-0.5 rounded-lg border max-w-[180px] truncate">✓ {inc}</span>)}
                    {vil.inclusions?.length > 3 && <span className="text-[10px] text-zinc-400 font-bold self-center px-1">+{vil.inclusions.length - 3} more</span>}
                  </div>

                  <div className="flex items-center justify-end space-x-1 pt-3 border-t border-zinc-100 mt-4">
                    <button onClick={(e) => { e.stopPropagation(); openEditVillaForm(vil); }} className="text-xs font-bold text-zinc-600 hover:bg-zinc-100 px-3 py-1.5 rounded-xl">Edit Specifications</button>
                    <button onClick={(e) => { e.stopPropagation(); deleteVilla(vil.id); }} className="text-xs font-bold text-red-600 hover:bg-red-50 px-3 py-1.5 rounded-xl">Purge Listing</button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* ======================================================== */}
      {/* SECTION 3: RATES & PACKAGE PRICING GRID LAYOUT DRILL      */}
      {/* ======================================================== */}
      {selectedVilla && (
        <div className="grid gap-6 md:grid-cols-[250px_1fr] pt-6 border-t border-zinc-200 animate-slideUp">
          
          {/* Package Column Filters */}
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <h4 className="text-xs font-black text-zinc-400 uppercase tracking-widest">📦 Package Sub-Types</h4>
              <button onClick={openNewPackageForm} className="text-[11px] font-black text-emerald-600 hover:underline">+ Add</button>
            </div>
            
            <div className="space-y-1.5">
              {packages.map((pkg) => (
                <div 
                  key={pkg.id}
                  onClick={() => setSelectedPackage(pkg)}
                  className={`p-3 rounded-xl border text-xs cursor-pointer transition-all flex flex-col justify-between group relative ${selectedPackage?.id === pkg.id ? 'bg-zinc-900 text-white border-zinc-900 shadow-sm' : 'bg-white border-zinc-200 text-zinc-700 hover:bg-zinc-50'}`}
                >
                  <div>
                    <p className="font-bold uppercase tracking-wide text-[10px]">{pkg.name.replace('_', ' ')}</p>
                    <p className="text-[11px] mt-0.5 opacity-80">Excess: ₱{pkg.excess_pax_rate}/Head</p>
                  </div>
                  <button 
                    onClick={(e) => { e.stopPropagation(); deletePackage(pkg.id); }}
                    className="absolute top-2 right-2 hidden group-hover:block text-[10px] text-red-500 hover:text-red-700 bg-red-50 rounded p-1"
                  >
                    ✕
                  </button>
                </div>
              ))}
            </div>
          </div>

          {/* Rate Tiers Layout Grid Block Output Data */}
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <div>
                <h4 className="text-xs font-black text-zinc-400 uppercase tracking-widest">📊 Bracket Matrix Rate Tiers</h4>
                <p className="text-xs text-zinc-500">Live operational rates mapped to time frames and passenger tiers.</p>
              </div>
              {selectedPackage && (
                <button onClick={openNewRateTierForm} className="bg-zinc-950 hover:bg-zinc-800 text-white font-bold text-xs px-3 py-1.5 rounded-xl transition shadow-sm">+ Create Rate Tier Block</button>
              )}
            </div>

            {!selectedPackage ? (
              <div className="p-12 text-center text-xs text-zinc-400 italic bg-zinc-50 rounded-3xl border">Configure or choose a package layer block on the left sidebar profile directory.</div>
            ) : rateTiers.length === 0 ? (
              <div className="p-12 text-center text-xs text-zinc-400 italic bg-zinc-50 rounded-3xl border border-dashed">No pricing matrix records configured for this specific package slot yet.</div>
            ) : (
              <div className="bg-white rounded-2xl border border-zinc-200 overflow-hidden shadow-sm">
                <table className="w-full text-left text-xs text-zinc-600">
                  <thead className="bg-zinc-50 font-bold border-b text-zinc-400 uppercase tracking-wider text-[10px]">
                    <tr>
                      <th className="p-3">Max Headcount Base</th>
                      <th className="p-3">Time Assigned</th>
                      <th className="p-3">Calendar Bracket</th>
                      <th className="p-3">Base Price</th>
                      <th className="p-3 text-right">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-zinc-100">
                    {rateTiers.map((tier) => (
                      <tr key={tier.id} className="hover:bg-zinc-50/60 transition-colors">
                        <td className="p-3 font-bold text-zinc-900">{tier.base_pax} Pax Limit</td>
                        <td className="p-3 uppercase font-semibold text-zinc-500">⏳ {tier.time_of_day} Slot</td>
                        <td className="p-3">
                          <span className={`px-2 py-0.5 rounded font-bold uppercase text-[9px] border ${tier.day_group === 'weekday' ? 'bg-zinc-50 text-zinc-600' : 'bg-purple-50 text-purple-700 border-purple-200'}`}>
                            {tier.day_group.replace('_', ' ')}
                          </span>
                        </td>
                        <td className="p-3 font-mono font-bold text-emerald-600 text-sm">₱{Number(tier.price).toLocaleString()}</td>
                        <td className="p-3 text-right">
                          <button onClick={() => deleteRateTier(tier.id)} className="text-red-500 hover:text-red-700 font-bold hover:bg-red-50 px-2 py-1 rounded-lg">Delete</button>
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

      {/* ======================================================== */}
      {/* DIALOG LAYERS MODAL WINDOW OVERLAYS COMPONENT CODES      */}
      {/* ======================================================== */}
      {activeForm && (
        <div className="fixed inset-0 bg-zinc-950/60 backdrop-blur-sm z-50 flex items-center justify-center p-4 animate-fadeIn" onClick={closeFormModal}>
          <div className="bg-white rounded-3xl p-6 max-w-md w-full space-y-4 shadow-2xl border border-zinc-100" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between border-b pb-3">
              <h3 className="font-bold text-zinc-900 text-base uppercase tracking-wide">
                {editTargetId ? '📝 Modify Entity Settings' : '✨ Instantiate New Record'}
              </h3>
              <button onClick={closeFormModal} className="text-zinc-400 hover:text-zinc-600 text-sm">✕</button>
            </div>

            {/* FORM PIPELINE: REGIONAL LOCATION MANAGER */}
            {activeForm === 'location' && (
              <form onSubmit={saveLocation} className="space-y-4 text-xs">
                <div>
                  <label className="block font-bold mb-1 text-zinc-700">Branch Identity Name</label>
                  <input type="text" required value={locName} onChange={e => setLocName(e.target.value)} placeholder="e.g., Main Branch, North Wing" className="w-full border rounded-xl bg-zinc-50 px-3 py-2.5 focus:outline-none focus:border-zinc-900 text-sm" />
                </div>
                <div>
                  <label className="block font-bold mb-1 text-zinc-700">Full Physical Address</label>
                  <input type="text" value={locAddress} onChange={e => setLocAddress(e.target.value)} placeholder="Complete address text lines" className="w-full border rounded-xl bg-zinc-50 px-3 py-2.5 focus:outline-none focus:border-zinc-900 text-sm" />
                </div>
                <div>
                  <label className="block font-bold mb-1 text-zinc-700">Cover Asset Image</label>
                  <input type="file" accept="image/*" onChange={e => handleImageUpload(e, 'locations')} className="w-full file:text-xs file:font-bold file:rounded-xl file:border-0 file:bg-zinc-900 file:text-white file:px-3 file:py-1.5 file:cursor-pointer" />
                  {uploading && <p className="text-[10px] text-zinc-400 animate-pulse mt-1">Uploading file...</p>}
                  {locImage && <p className="text-[10px] text-emerald-600 mt-1 truncate">Loaded: {locImage}</p>}
                </div>
                <button type="submit" disabled={uploading} className="w-full bg-zinc-950 hover:bg-zinc-800 text-white font-bold py-2.5 rounded-xl transition mt-2 shadow-sm text-xs">Save Configuration Block</button>
              </form>
            )}

            {/* FORM PIPELINE: VILLA ASSET LISTING BLOCK */}
            {activeForm === 'villa' && (
              <form onSubmit={saveVilla} className="space-y-4 text-xs max-h-[80vh] overflow-y-auto pr-1">
                <div>
                  <label className="block font-bold mb-1 text-zinc-700">Villa Custom Title</label>
                  <input type="text" required value={villaName} onChange={e => setVillaName(e.target.value)} placeholder="e.g., Sandy's Villa" className="w-full border rounded-xl bg-zinc-50 px-3 py-2.5 focus:outline-none focus:border-zinc-900 text-sm" />
                </div>
                <div>
                  <label className="block font-bold mb-1 text-zinc-700">Marketing & Listing Description</label>
                  <textarea rows={3} value={villaDesc} onChange={e => setVillaDesc(e.target.value)} placeholder="Describe spatial dimensions, bedroom caps, luxury additions..." className="w-full border rounded-xl bg-zinc-50 px-3 py-2.5 focus:outline-none focus:border-zinc-900 text-sm" />
                </div>
                
                {/* Image Upload Row */}
                <div>
                  <label className="block font-bold mb-1 text-zinc-700">Villa Profile Picture</label>
                  <input type="file" accept="image/*" onChange={e => handleImageUpload(e, 'villas')} className="w-full file:text-xs file:font-bold file:rounded-xl file:border-0 file:bg-zinc-900 file:text-white file:px-3 file:py-1.5 file:cursor-pointer" />
                  {uploading && <p className="text-[10px] text-zinc-400 animate-pulse mt-1">Uploading file...</p>}
                  {villaImage && <p className="text-[10px] text-emerald-600 mt-1 truncate">Loaded: {villaImage}</p>}
                </div>

                {/* Category Array Toggles */}
                <div>
                  <label className="block font-bold mb-1 text-zinc-700">Supported Core Purposes</label>
                  <div className="flex space-x-4 mt-1">
                    {['Events', 'Accommodation'].map(cat => (
                      <label key={cat} className="flex items-center space-x-2 font-semibold text-zinc-700 cursor-pointer">
                        <input type="checkbox" checked={villaCategories.includes(cat)} onChange={() => toggleCategoryCheck(cat)} className="accent-zinc-900" />
                        <span>{cat}</span>
                      </label>
                    ))}
                  </div>
                </div>

                {/* Inclusion Array Builder */}
                <div>
                  <label className="block font-bold mb-1 text-zinc-700">Inclusions Array Checklist Items</label>
                  <div className="flex space-x-1">
                    <input type="text" value={newInclusionItem} onChange={e => setNewInclusionItem(e.target.value)} placeholder="Add inclusion (e.g. Billiards table)" className="flex-1 border rounded-xl bg-zinc-50 px-3 py-1.5 focus:outline-none focus:border-zinc-900 text-xs" />
                    <button type="button" onClick={addInclusionChip} className="bg-zinc-200 hover:bg-zinc-300 font-bold px-3 rounded-xl transition text-xs">Append</button>
                  </div>
                  <div className="flex flex-wrap gap-1 mt-2 max-h-[100px] overflow-y-auto border p-2 rounded-xl bg-zinc-50/50">
                    {villaInclusions.map((inc, index) => (
                      <span key={index} className="inline-flex items-center gap-1 bg-white border px-2 py-0.5 rounded-lg text-[10px] font-semibold text-zinc-600">
                        {inc}
                        <button type="button" onClick={() => setVillaInclusions(prev => prev.filter((_, i) => i !== index))} className="text-red-500 font-black hover:text-red-700 pl-0.5">✕</button>
                      </span>
                    ))}
                  </div>
                </div>

                <button type="submit" disabled={uploading} className="w-full bg-zinc-950 hover:bg-zinc-800 text-white font-bold py-2.5 rounded-xl transition mt-2 shadow-sm text-xs">Save Villa Configuration</button>
              </form>
            )}

            {/* FORM PIPELINE: PACKAGES BLOCK DEFINITION */}
            {activeForm === 'package' && (
              <form onSubmit={savePackage} className="space-y-4 text-xs">
                <div>
                  <label className="block font-bold mb-1 text-zinc-700">Package Enum Identifier</label>
                  <select value={pkgName} onChange={e => setPkgName(e.target.value as any)} className="w-full border rounded-xl bg-zinc-50 px-3 py-2.5 focus:outline-none focus:border-zinc-900 text-sm">
                    <option value="venue_only">Venue Only (No Catering)</option>
                    <option value="with_catering">With Catering Support</option>
                    <option value="accommodation_only">Accommodation Only</option>
                  </select>
                </div>
                <div>
                  <label className="block font-bold mb-1 text-zinc-700">Excess Pax Rate Fee (Per Individual Head)</label>
                  <input type="number" required value={pkgExcessPax} onChange={e => setPkgExcessPax(Number(e.target.value))} className="w-full border rounded-xl bg-zinc-50 px-3 py-2.5 focus:outline-none focus:border-zinc-900 text-sm font-mono font-bold" />
                </div>
                <button type="submit" className="w-full bg-zinc-950 hover:bg-zinc-800 text-white font-bold py-2.5 rounded-xl transition mt-2 shadow-sm text-xs">Add Package Schema</button>
              </form>
            )}

            {/* FORM PIPELINE: RATE BRACKETS BUILDER MODULE */}
            {activeForm === 'rate_tier' && (
              <form onSubmit={saveRateTier} className="space-y-4 text-xs">
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block font-bold mb-1 text-zinc-700">Base Pax Cap</label>
                    <input type="number" required value={tierBasePax} onChange={e => setTierBasePax(Number(e.target.value))} className="w-full border rounded-xl bg-zinc-50 px-3 py-2.5 focus:outline-none focus:border-zinc-900 text-sm font-mono font-bold" />
                  </div>
                  <div>
                    <label className="block font-bold mb-1 text-zinc-700">Time of Day Slot</label>
                    <select value={tierTimeSlot} onChange={e => setTierTimeSlot(e.target.value as any)} className="w-full border rounded-xl bg-zinc-50 px-3 py-2.5 focus:outline-none focus:border-zinc-900 text-sm font-bold">
                      <option value="day">Day Timeframe</option>
                      <option value="evening">Evening Timeframe</option>
                    </select>
                  </div>
                </div>
                <div>
                  <label className="block font-bold mb-1 text-zinc-700">Calendar Day Grouping</label>
                  <select value={tierDayGroup} onChange={e => setTierDayGroup(e.target.value as any)} className="w-full border rounded-xl bg-zinc-50 px-3 py-2.5 focus:outline-none focus:border-zinc-900 text-sm font-bold">
                    <option value="weekday">Standard Weekday Block</option>
                    <option value="weekend_holiday">Weekend / Holiday Block</option>
                  </select>
                </div>
                <div>
                  <label className="block font-bold mb-1 text-zinc-700">Baseline Rate Price (PHP ₱)</label>
                  <input type="number" required value={tierPrice} onChange={e => setTierPrice(Number(e.target.value))} placeholder="Amount in pesos" className="w-full border rounded-xl bg-zinc-50 px-3 py-2.5 focus:outline-none focus:border-zinc-900 text-sm font-mono font-bold text-emerald-600" />
                </div>
                <button type="submit" className="w-full bg-zinc-950 hover:bg-zinc-800 text-white font-bold py-2.5 rounded-xl transition mt-2 shadow-sm text-xs">Commit New Rate Tier</button>
              </form>
            )}

          </div>
        </div>
      )}

    </section>
  );
}