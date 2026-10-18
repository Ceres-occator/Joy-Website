'use client';

import { useState, useEffect } from 'react';
import dynamic from 'next/dynamic';
import { createClient } from '@/utils/supabase/client';
import {
  formatCurrency,
  formatPackageLabel,
  getFirstVillaImage,
  parseVillaImages,
} from '@/utils/formatters';
import type { DayGroup, PackageRow, RateTierRow, TimeSlot, Villa } from '@/types';
import { AdminTableSkeleton, MapSkeleton } from '@/components/ui/Skeleton';
import { MapPin, X, Percent } from 'lucide-react';

const OpenFreeMap = dynamic(() => import('@/components/map/OpenFreeMap'), {
  ssr: false,
  loading: () => <MapSkeleton />,
});

export default function ManageRoomsPage() {
  const supabase = createClient();

  const [villas, setVillas] = useState<Villa[]>([]);
  const [packages, setPackages] = useState<PackageRow[]>([]);
  const [rateTiers, setRateTiers] = useState<RateTierRow[]>([]);

  const [selectedVilla, setSelectedVilla] = useState<Villa | null>(null);
  const [selectedPackage, setSelectedPackage] = useState<PackageRow | null>(null);

  const [loading, setLoading] = useState<boolean>(true);
  const [uploading, setUploading] = useState<boolean>(false);
  const [activeForm, setActiveForm] = useState<'villa' | 'rate_tier' | null>(null);
  const [editTargetId, setEditTargetId] = useState<string | null>(null);

  const [villaName, setVillaName] = useState('');
  const [villaDesc, setVillaDesc] = useState('');
  const [villaImages, setVillaImages] = useState<string[]>([]);
  const [villaInclusions, setVillaInclusions] = useState<string[]>([]);
  const [villaCategories, setVillaCategories] = useState<string[]>([]);
  const [villaMinDeposit, setVillaMinDeposit] = useState<number>(50);
  const [newInclusionItem, setNewInclusionItem] = useState('');

  // OpenFreeMap coordinates & address state
  const [villaAddress, setVillaAddress] = useState(
    'Ma-a, Davao City, Philippines, 8000'
  );
  const [villaLat, setVillaLat] = useState<number>(7.0915);
  const [villaLng, setVillaLng] = useState<number>(125.5826);
  const [villaZoom, setVillaZoom] = useState<number>(16);

  const [pkgCateringActive, setPkgCateringActive] = useState(true);
  const [pkgCateringRate, setPkgCateringRate] = useState<number>(300);
  const [pkgVenueActive, setPkgVenueActive] = useState(false);
  const [pkgVenueRate, setPkgVenueRate] = useState<number>(300);
  const [pkgAccomActive, setPkgAccomActive] = useState(false);
  const [pkgAccomRate, setPkgAccomRate] = useState<number>(400);

  const [tierBasePax, setTierBasePax] = useState<number>(50);
  const [tierTimeSlot, setTierTimeSlot] = useState<TimeSlot>('day');
  const [tierDayGroup, setTierDayGroup] = useState<DayGroup>('weekday');
  const [tierPrice, setTierPrice] = useState<number>(0);

  async function loadInitialData() {
    setLoading(true);
    let { data: vilData, error } = await supabase
      .from('villas')
      .select('*, packages(*, rate_tiers(*))')
      .order('name');

    if (error || !vilData) {
      const fallback = await supabase.from('villas').select('*').order('name');
      vilData = fallback.data;
    }

    if (vilData) {
      setVillas(vilData as Villa[]);
      if (vilData.length > 0 && !selectedVilla) {
        setSelectedVilla(vilData[0] as Villa);
      }
    }
    setLoading(false);
  }

  useEffect(() => {
    loadInitialData();
  }, []);

  useEffect(() => {
    if (!selectedVilla?.id) {
      setPackages([]);
      setSelectedPackage(null);
      return;
    }
    async function loadPackagesAndRates() {
      let { data: pkgData, error } = await supabase
        .from('packages')
        .select('*, rate_tiers(*)')
        .eq('villa_id', selectedVilla!.id);

      if (error || !pkgData) {
        const fallback = await supabase
          .from('packages')
          .select('*')
          .eq('villa_id', selectedVilla!.id);
        pkgData = fallback.data;
      }

      if (pkgData) {
        setPackages(pkgData as PackageRow[]);
        const firstPkg = pkgData.length > 0 ? (pkgData[0] as any) : null;
        setSelectedPackage(firstPkg);
        if (firstPkg && Array.isArray(firstPkg.rate_tiers) && firstPkg.rate_tiers.length > 0) {
          setRateTiers(
            [...firstPkg.rate_tiers].sort((a, b) => Number(a.base_pax) - Number(b.base_pax))
          );
        }
      }
    }
    loadPackagesAndRates();
  }, [selectedVilla, supabase]);

  useEffect(() => {
    if (!selectedPackage?.id) {
      setRateTiers([]);
      return;
    }
    async function loadTiers() {
      const { data: tierData } = await supabase
        .from('rate_tiers')
        .select('*')
        .eq('package_id', selectedPackage!.id)
        .order('base_pax');
      if (tierData) setRateTiers(tierData as RateTierRow[]);
    }
    loadTiers();
  }, [selectedPackage, supabase]);

  const handleMultiImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;
    setUploading(true);
    try {
      const uploadedUrls: string[] = [...villaImages];
      for (let i = 0; i < files.length; i++) {
        const file = files[i];
        const extension = file.name.split('.').pop();
        const relativeStoragePath = `villas/asset_${Date.now()}_${i}.${extension}`;
        const { error } = await supabase.storage
          .from('property-listings')
          .upload(relativeStoragePath, file);
        if (error) throw error;

        const { data: urlData } = supabase.storage
          .from('property-listings')
          .getPublicUrl(relativeStoragePath);
        if (urlData?.publicUrl) uploadedUrls.push(urlData.publicUrl);
      }
      setVillaImages(uploadedUrls);
    } catch (err: any) {
      alert(`Photo upload failed: ${err.message}`);
    } finally {
      setUploading(false);
    }
  };

  const saveVilla = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    const bodyPayload = {
      villaId: editTargetId,
      name: villaName,
      description: villaDesc,
      imageUrls: villaImages,
      inclusions: villaInclusions,
      categoryType: villaCategories,
      minDepositPercent: Number(villaMinDeposit),
      address: villaAddress,
      latitude: Number(villaLat),
      longitude: Number(villaLng),
      mapZoom: Number(villaZoom),
      pkgCateringActive,
      pkgCateringRate,
      pkgVenueActive,
      pkgVenueRate,
      pkgAccomActive,
      pkgAccomRate,
    };

    try {
      const res = await fetch('/api/admin/villas', {
        method: editTargetId ? 'PUT' : 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(bodyPayload),
      });
      if (res.ok) {
        alert('Villa, minimum deposit rate, and map coordinates saved!');
        closeFormModal();
        loadInitialData();
        setSelectedVilla(null);
      } else {
        const err = await res.json();
        alert(`Could not save villa: ${err.error}`);
      }
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const deleteVilla = async (id: string) => {
    if (!confirm('Are you sure you want to delete this villa?')) return;
    await supabase.from('villas').delete().eq('id', id);
    setVillas((prev) => prev.filter((v) => v.id !== id));
    if (selectedVilla?.id === id) setSelectedVilla(null);
  };

  const saveRateTier = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedPackage) return;
    const payload = {
      package_id: selectedPackage.id,
      base_pax: Number(tierBasePax),
      time_of_day: tierTimeSlot,
      day_group: tierDayGroup,
      price: Number(tierPrice),
    };
    const { data } = await supabase.from('rate_tiers').insert([payload]).select();
    if (data) setRateTiers((prev) => [...prev, data[0] as RateTierRow]);
    closeFormModal();
  };

  const deleteRateTier = async (id: string) => {
    await supabase.from('rate_tiers').delete().eq('id', id);
    setRateTiers((prev) => prev.filter((t) => t.id !== id));
  };

  const addInclusionChip = () => {
    if (!newInclusionItem.trim()) return;
    setVillaInclusions((prev) => [...prev, newInclusionItem.trim()]);
    setNewInclusionItem('');
  };

  const removeInclusionChip = (index: number) => {
    setVillaInclusions((prev) => prev.filter((_, i) => i !== index));
  };

  const toggleCategoryCheck = (cat: string) => {
    setVillaCategories((prev) =>
      prev.includes(cat) ? prev.filter((c) => c !== cat) : [...prev, cat]
    );
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

  const openNewVillaForm = () => {
    setEditTargetId(null);
    setVillaName('');
    setVillaDesc('');
    setVillaImages([]);
    setVillaInclusions([]);
    setVillaCategories([]);
    setVillaMinDeposit(50);
    setVillaAddress('Ma-a, Davao City, Philippines, 8000');
    setVillaLat(7.0915);
    setVillaLng(125.5826);
    setVillaZoom(16);
    setPkgCateringActive(true);
    setPkgCateringRate(300);
    setPkgVenueActive(false);
    setPkgVenueRate(300);
    setPkgAccomActive(false);
    setPkgAccomRate(400);
    setActiveForm('villa');
  };

  const openEditVillaForm = async (vil: Villa) => {
    setEditTargetId(vil.id);
    setVillaName(vil.name);
    setVillaDesc(vil.description || '');
    setVillaInclusions(vil.inclusions || []);
    setVillaCategories(vil.category_type || []);
    setVillaImages(parseVillaImages(vil.image_url));
    setVillaMinDeposit(Number(vil.min_deposit_percent ?? 50));
    setVillaAddress(vil.address || 'Ma-a, Davao City, Philippines, 8000');
    setVillaLat(Number(vil.latitude || 7.0915));
    setVillaLng(Number(vil.longitude || 125.5826));
    setVillaZoom(Number(vil.map_zoom || 16));

    setPkgCateringActive(false);
    setPkgVenueActive(false);
    setPkgAccomActive(false);
    const { data: existingPackages } = await supabase
      .from('packages')
      .select('*')
      .eq('villa_id', vil.id);
    if (existingPackages) {
      existingPackages.forEach((p) => {
        if (p.name === 'with_catering') {
          setPkgCateringActive(true);
          setPkgCateringRate(p.excess_pax_rate);
        }
        if (p.name === 'venue_only') {
          setPkgVenueActive(true);
          setPkgVenueRate(p.excess_pax_rate);
        }
        if (p.name === 'accommodation_only') {
          setPkgAccomActive(true);
          setPkgAccomRate(p.excess_pax_rate);
        }
      });
    }
    setActiveForm('villa');
  };

  const openNewRateTierForm = () => {
    setEditTargetId(null);
    setTierBasePax(50);
    setTierTimeSlot('day');
    setTierDayGroup('weekday');
    setTierPrice(0);
    setActiveForm('rate_tier');
  };

  const closeFormModal = () => {
    setActiveForm(null);
    setEditTargetId(null);
  };

  if (loading && villas.length === 0) {
    return (
      <section className="space-y-6 max-w-6xl mx-auto pb-12">
        <AdminTableSkeleton rows={4} />
      </section>
    );
  }

  return (
    <section className="space-y-6 max-w-6xl mx-auto animate-fadeIn pb-12 font-sans">
      <div>
        <p className="text-xs uppercase tracking-widest text-emerald-600 dark:text-emerald-400 font-bold">
          Villas, Rates &amp; Map Locations
        </p>
        <h2 className="text-2xl sm:text-3xl font-bold text-gray-900 dark:text-gray-100">
          Manage Villas, Deposit Rates &amp; Pricing
        </h2>
        <p className="text-xs sm:text-sm text-gray-600 dark:text-gray-300 mt-0.5">
          Configure each villa&apos;s minimum deposit percentage, photos, amenities, package rates,
          and OpenFreeMap coordinates.
        </p>
      </div>

      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <h3 className="text-xs font-bold text-gray-600 dark:text-gray-300 uppercase tracking-wider">
            Your Villas
          </h3>
          <button
            type="button"
            onClick={openNewVillaForm}
            className="neu-btn-primary font-semibold text-xs px-4 py-2.5"
          >
            + Add Villa
          </button>
        </div>

        <div className="grid gap-5 sm:grid-cols-2">
          {villas.map((vil) => {
            const coverImg = getFirstVillaImage(vil.image_url);
            const isSelected = selectedVilla?.id === vil.id;
            const depositPct = Number(vil.min_deposit_percent ?? 50);

            return (
              <div
                key={vil.id}
                onClick={() => setSelectedVilla(vil)}
                className={`neu-card p-5 cursor-pointer transition flex flex-col justify-between min-h-[165px] ${
                  isSelected ? 'ring-2 ring-emerald-500' : ''
                }`}
              >
                <div className="flex gap-4">
                  {coverImg && (
                    <img
                      src={coverImg}
                      className="w-16 h-16 rounded-lg object-cover border border-gray-200 dark:border-gray-800 shrink-0"
                      alt={vil.name}
                    />
                  )}
                  <div className="space-y-1 flex-1">
                    <div className="flex flex-wrap items-center gap-1.5">
                      {vil.category_type?.map((c) => (
                        <span
                          key={c}
                          className="text-xs font-semibold uppercase neu-inset-sm text-emerald-700 dark:text-emerald-400 px-2 py-0.5"
                        >
                          {c}
                        </span>
                      ))}
                      <span className="text-xs font-mono font-semibold uppercase px-2 py-0.5 rounded bg-emerald-50 text-emerald-800 border border-emerald-200 dark:bg-emerald-950/60 dark:text-emerald-200 dark:border-emerald-800/60">
                        Min. Deposit: {depositPct}%
                      </span>
                    </div>
                    <h4 className="font-bold text-gray-900 dark:text-gray-100 text-base">
                      {vil.name}
                    </h4>
                    <p className="text-xs text-gray-600 dark:text-gray-300 line-clamp-2 leading-relaxed">
                      {vil.description}
                    </p>
                    <p className="text-xs font-medium text-emerald-700 dark:text-emerald-400 flex items-center gap-1 pt-0.5">
                      <MapPin className="w-3 h-3 shrink-0" />
                      <span className="truncate">
                        {vil.address || 'Davao City'} ({Number(vil.latitude || 7.0915).toFixed(4)},{' '}
                        {Number(vil.longitude || 125.5826).toFixed(4)})
                      </span>
                    </p>
                  </div>
                </div>
                <div className="flex items-center justify-end gap-2 pt-3 border-t border-gray-200 dark:border-gray-800 mt-4 text-xs font-semibold">
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      openEditVillaForm(vil);
                    }}
                    className="neu-btn px-3.5 py-1.5 text-gray-900 dark:text-gray-100"
                  >
                    Edit Villa &amp; Deposit
                  </button>
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      deleteVilla(vil.id);
                    }}
                    className="neu-btn px-3.5 py-1.5 text-rose-600 dark:text-rose-400"
                  >
                    Delete
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {selectedVilla && (
        <div className="grid gap-6 md:grid-cols-[240px_1fr] pt-6 border-t border-gray-200 dark:border-gray-800 animate-fadeIn">
          <div className="space-y-3">
            <h4 className="text-xs font-bold text-gray-600 dark:text-gray-300 uppercase tracking-wider">
              Packages ({selectedVilla.name})
            </h4>
            <div className="space-y-2">
              {packages.map((pkg) => (
                <div
                  key={pkg.id}
                  onClick={() => setSelectedPackage(pkg)}
                  className={`p-3.5 rounded-lg text-xs cursor-pointer transition flex flex-col justify-between ${
                    selectedPackage?.id === pkg.id
                      ? 'neu-btn-primary'
                      : 'neu-card-sm text-gray-900 dark:text-gray-100'
                  }`}
                >
                  <p className="font-bold uppercase tracking-wide text-xs">
                    {formatPackageLabel(pkg.name)}
                  </p>
                  <p className="text-xs mt-0.5 opacity-90">
                    Extra Guest: {formatCurrency(pkg.excess_pax_rate)}/person
                  </p>
                </div>
              ))}
            </div>
          </div>

          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <h4 className="text-xs font-bold text-gray-600 dark:text-gray-300 uppercase tracking-wider">
                Price Tiers
              </h4>
              {selectedPackage && (
                <button
                  type="button"
                  onClick={openNewRateTierForm}
                  className="neu-btn-primary font-semibold text-xs px-3.5 py-2"
                >
                  + Add Price Tier
                </button>
              )}
            </div>

            {!selectedPackage ? (
              <div className="p-12 text-center text-xs text-gray-600 dark:text-gray-300 neu-inset">
                Select a package on the left to view its prices.
              </div>
            ) : rateTiers.length === 0 ? (
              <div className="p-12 text-center text-xs text-gray-600 dark:text-gray-300 neu-inset">
                No price tiers yet for this package. Click &ldquo;+ Add Price Tier&rdquo; above.
              </div>
            ) : (
              <div className="neu-card p-2 overflow-hidden">
                <table className="w-full text-left text-xs text-gray-900 dark:text-gray-100">
                  <thead className="font-semibold border-b border-gray-200 dark:border-gray-800 text-xs text-gray-600 dark:text-gray-300 uppercase">
                    <tr>
                      <th className="p-3.5">Guest Limit</th>
                      <th className="p-3.5">Time Slot</th>
                      <th className="p-3.5">Days</th>
                      <th className="p-3.5">Price</th>
                      <th className="p-3.5 text-right">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-200 dark:divide-gray-800">
                    {rateTiers.map((tier) => (
                      <tr
                        key={tier.id}
                        className="hover:bg-gray-50 dark:hover:bg-gray-800/40"
                      >
                        <td className="p-3.5 font-semibold text-gray-900 dark:text-gray-100">
                          Up to {tier.base_pax} Guests
                        </td>
                        <td className="p-3.5 uppercase font-medium text-gray-600 dark:text-gray-300">
                          {tier.time_of_day}
                        </td>
                        <td className="p-3.5">
                          <span className="px-2.5 py-0.5 rounded neu-inset-sm text-xs font-semibold uppercase text-gray-900 dark:text-gray-100">
                            {tier.day_group === 'weekday' ? 'Weekday' : 'Weekend / Holiday'}
                          </span>
                        </td>
                        <td className="p-3.5 font-mono font-bold text-emerald-700 dark:text-emerald-400 text-sm">
                          {formatCurrency(tier.price)}
                        </td>
                        <td className="p-3.5 text-right">
                          <button
                            type="button"
                            onClick={() => deleteRateTier(tier.id)}
                            className="text-rose-600 dark:text-rose-400 font-semibold hover:underline cursor-pointer"
                          >
                            Delete
                          </button>
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

      {activeForm && (
        <div
          className="fixed inset-0 bg-gray-950/60 backdrop-blur-sm z-50 flex items-center justify-center p-4 animate-fadeIn"
          onClick={closeFormModal}
        >
          <div
            className="neu-card p-6 sm:p-7 max-w-2xl w-full space-y-4 text-xs"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between border-b border-gray-200 dark:border-gray-800 pb-3">
              <h3 className="font-bold text-gray-900 dark:text-gray-100 text-base">
                {activeForm === 'villa'
                  ? editTargetId
                    ? 'Edit Villa, Minimum Deposit & Map Location'
                    : 'Add New Villa'
                  : 'Add Price Tier'}
              </h3>
              <button
                type="button"
                onClick={closeFormModal}
                className="neu-btn h-8 w-8 flex items-center justify-center text-gray-600 dark:text-gray-300"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {activeForm === 'villa' && (
              <form
                onSubmit={saveVilla}
                className="space-y-4 max-h-[78vh] overflow-y-auto pr-1"
              >
                <div className="neu-inset p-3.5 space-y-2">
                  <span className="block text-xs font-bold text-gray-600 dark:text-gray-300 uppercase tracking-wider">
                    Quick Setup Presets
                  </span>
                  <div className="flex flex-wrap gap-2">
                    <button
                      type="button"
                      onClick={() => applyPreset('events_only')}
                      className="neu-btn font-semibold px-3 py-1.5 text-xs text-gray-900 dark:text-gray-100"
                    >
                      Events Only
                    </button>
                    <button
                      type="button"
                      onClick={() => applyPreset('accommodation_only')}
                      className="neu-btn font-semibold px-3 py-1.5 text-xs text-gray-900 dark:text-gray-100"
                    >
                      Overnight Only
                    </button>
                    <button
                      type="button"
                      onClick={() => applyPreset('combo_all')}
                      className="neu-btn-primary font-semibold px-3 py-1.5 text-xs"
                    >
                      Both Events &amp; Overnight
                    </button>
                  </div>
                </div>

                {/* Villa Name, Per-Villa Minimum Deposit & Photo Upload */}
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3.5">
                  <div>
                    <label className="block font-semibold mb-1.5 text-gray-600 dark:text-gray-300">
                      Villa Name *
                    </label>
                    <input
                      type="text"
                      required
                      value={villaName}
                      onChange={(e) => setVillaName(e.target.value)}
                      className="neu-input w-full px-3.5 py-2.5 text-sm font-medium text-gray-900 dark:text-gray-100"
                    />
                  </div>
                  <div>
                    <label className="block font-semibold mb-1.5 text-gray-600 dark:text-gray-300 flex items-center gap-1">
                      <Percent className="w-3.5 h-3.5 text-emerald-600" />
                      Minimum Deposit (%) *
                    </label>
                    <input
                      type="number"
                      min={1}
                      max={100}
                      required
                      value={villaMinDeposit}
                      onChange={(e) =>
                        setVillaMinDeposit(
                          Math.min(100, Math.max(0, Number(e.target.value) || 0))
                        )
                      }
                      className="neu-input w-full px-3.5 py-2.5 text-sm font-mono font-bold text-emerald-700 dark:text-emerald-400"
                    />
                  </div>
                  <div>
                    <label className="block font-semibold mb-1.5 text-gray-600 dark:text-gray-300">
                      Upload Photos {uploading && '(Uploading...)'}
                    </label>
                    <input
                      type="file"
                      multiple
                      accept="image/*"
                      onChange={handleMultiImageUpload}
                      className="w-full text-gray-600 dark:text-gray-300 file:py-1.5 file:px-3 file:rounded-lg file:border-0 file:bg-emerald-600 file:text-white file:font-semibold cursor-pointer"
                    />
                  </div>
                </div>

                {villaImages.length > 0 && (
                  <div className="space-y-1.5">
                    <span className="block text-xs font-semibold text-gray-600 dark:text-gray-300">
                      Photos ({villaImages.length})
                    </span>
                    <div className="grid grid-cols-5 gap-2 neu-inset p-2.5">
                      {villaImages.map((img, idx) => (
                        <div
                          key={idx}
                          className="relative aspect-square rounded-lg overflow-hidden bg-white group"
                        >
                          <img src={img} className="w-full h-full object-cover" alt="" />
                          <button
                            type="button"
                            onClick={() =>
                              setVillaImages((prev) => prev.filter((_, i) => i !== idx))
                            }
                            className="absolute inset-0 bg-rose-600/85 text-white font-semibold opacity-0 group-hover:opacity-100 transition flex items-center justify-center text-xs"
                          >
                            Remove
                          </button>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                <div>
                  <label className="block font-semibold mb-1.5 text-gray-600 dark:text-gray-300">
                    Description
                  </label>
                  <textarea
                    rows={2}
                    value={villaDesc}
                    onChange={(e) => setVillaDesc(e.target.value)}
                    className="neu-input w-full px-3.5 py-2.5 text-sm text-gray-900 dark:text-gray-100"
                  />
                </div>

                {/* OpenFreeMap Location & Coordinates Editor */}
                <div className="neu-inset p-4 space-y-3">
                  <div className="flex items-center justify-between">
                    <label className="font-bold text-gray-900 dark:text-gray-100 uppercase text-xs flex items-center gap-1.5">
                      <MapPin className="w-3.5 h-3.5 text-emerald-600" />
                      OpenFreeMap Location &amp; Coordinates
                    </label>
                    <span className="text-xs text-gray-600 dark:text-gray-300 font-medium">
                      Click or drag the map pin below to update coordinates
                    </span>
                  </div>

                  <div>
                    <label className="block font-semibold text-gray-600 dark:text-gray-300 mb-1 text-xs">
                      Street Address / Landmark Label
                    </label>
                    <input
                      type="text"
                      value={villaAddress}
                      onChange={(e) => setVillaAddress(e.target.value)}
                      placeholder="Ma-a, Davao City, Philippines, 8000"
                      className="neu-input w-full px-3 py-2 text-xs font-medium text-gray-900 dark:text-gray-100"
                    />
                  </div>

                  <div className="grid grid-cols-3 gap-3">
                    <div>
                      <label className="block font-semibold text-gray-600 dark:text-gray-300 mb-1 text-xs uppercase">
                        Latitude
                      </label>
                      <input
                        type="number"
                        step="0.000001"
                        value={villaLat}
                        onChange={(e) => setVillaLat(Number(e.target.value))}
                        className="neu-input w-full px-3 py-2 text-xs font-mono font-semibold text-gray-900 dark:text-gray-100"
                      />
                    </div>
                    <div>
                      <label className="block font-semibold text-gray-600 dark:text-gray-300 mb-1 text-xs uppercase">
                        Longitude
                      </label>
                      <input
                        type="number"
                        step="0.000001"
                        value={villaLng}
                        onChange={(e) => setVillaLng(Number(e.target.value))}
                        className="neu-input w-full px-3 py-2 text-xs font-mono font-semibold text-gray-900 dark:text-gray-100"
                      />
                    </div>
                    <div>
                      <label className="block font-semibold text-gray-600 dark:text-gray-300 mb-1 text-xs uppercase">
                        Default Zoom
                      </label>
                      <input
                        type="number"
                        min={8}
                        max={20}
                        value={villaZoom}
                        onChange={(e) => setVillaZoom(Number(e.target.value))}
                        className="neu-input w-full px-3 py-2 text-xs font-mono font-semibold text-gray-900 dark:text-gray-100"
                      />
                    </div>
                  </div>

                  <OpenFreeMap
                    latitude={villaLat}
                    longitude={villaLng}
                    zoom={villaZoom}
                    title={villaName || "Joy's Events Place"}
                    address={villaAddress}
                    editable={true}
                    heightClass="h-[240px]"
                    onLocationChange={(lat, lng) => {
                      setVillaLat(Number(lat.toFixed(6)));
                      setVillaLng(Number(lng.toFixed(6)));
                    }}
                  />
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 neu-inset p-4">
                  <div>
                    <label className="block font-semibold text-gray-600 dark:text-gray-300 uppercase text-xs mb-2">
                      Booking Types Offered
                    </label>
                    <div className="space-y-2 font-semibold text-gray-900 dark:text-gray-100">
                      {['Events', 'Accommodation'].map((cat) => (
                        <label key={cat} className="flex items-center gap-2 cursor-pointer">
                          <input
                            type="checkbox"
                            checked={villaCategories.includes(cat)}
                            onChange={() => toggleCategoryCheck(cat)}
                            className="accent-emerald-600"
                          />
                          <span>{cat === 'Accommodation' ? 'Overnight Stay' : 'Events'}</span>
                        </label>
                      ))}
                    </div>
                  </div>

                  <div>
                    <label className="block font-semibold text-gray-600 dark:text-gray-300 uppercase text-xs mb-1.5">
                      Included Amenities
                    </label>
                    <div className="grid grid-cols-[1fr_auto] gap-2">
                      <input
                        type="text"
                        value={newInclusionItem}
                        onChange={(e) => setNewInclusionItem(e.target.value)}
                        placeholder="e.g. Swimming Pool"
                        className="neu-input w-full px-3 py-1.5 text-xs text-gray-900 dark:text-gray-100"
                      />
                      <button
                        type="button"
                        onClick={addInclusionChip}
                        className="neu-btn-primary font-semibold px-3 py-1.5 text-xs"
                      >
                        Add
                      </button>
                    </div>
                    <div className="flex flex-wrap gap-1.5 mt-2.5 max-h-[80px] overflow-y-auto p-1">
                      {villaInclusions.map((inc, i) => (
                        <button
                          key={i}
                          type="button"
                          onClick={() => removeInclusionChip(i)}
                          title="Click to remove"
                          className="neu-card-sm text-xs font-semibold px-2 py-0.5 text-gray-900 dark:text-gray-100 hover:text-rose-600"
                        >
                          {inc} (Remove)
                        </button>
                      ))}
                    </div>
                  </div>
                </div>

                <div className="space-y-2 pt-2">
                  <label className="block font-bold text-gray-900 dark:text-gray-100 uppercase text-xs">
                    Packages &amp; Extra Guest Fees
                  </label>
                  <div className="space-y-3 neu-inset p-4">
                    <div className="flex items-center justify-between gap-4">
                      <label className="flex items-center gap-2 cursor-pointer">
                        <input
                          type="checkbox"
                          checked={pkgCateringActive}
                          onChange={(e) => setPkgCateringActive(e.target.checked)}
                          className="accent-emerald-600"
                        />
                        <span className="text-gray-900 dark:text-gray-100 font-semibold text-xs">
                          With Catering
                        </span>
                      </label>
                      {pkgCateringActive && (
                        <div className="flex items-center gap-1.5">
                          <span className="text-gray-600 dark:text-gray-300 text-xs">
                            Extra Guest:
                          </span>
                          <input
                            type="number"
                            value={pkgCateringRate}
                            onChange={(e) => setPkgCateringRate(Number(e.target.value))}
                            className="neu-input px-2 py-1 w-20 font-mono font-bold text-center text-emerald-700 dark:text-emerald-400"
                          />
                          <span className="text-gray-600 dark:text-gray-300 font-mono">₱</span>
                        </div>
                      )}
                    </div>

                    <div className="flex items-center justify-between gap-4 border-t border-gray-200 dark:border-gray-800 pt-2.5">
                      <label className="flex items-center gap-2 cursor-pointer">
                        <input
                          type="checkbox"
                          checked={pkgVenueActive}
                          onChange={(e) => setPkgVenueActive(e.target.checked)}
                          className="accent-emerald-600"
                        />
                        <span className="text-gray-900 dark:text-gray-100 font-semibold text-xs">
                          Venue Only
                        </span>
                      </label>
                      {pkgVenueActive && (
                        <div className="flex items-center gap-1.5">
                          <span className="text-gray-600 dark:text-gray-300 text-xs">
                            Extra Guest:
                          </span>
                          <input
                            type="number"
                            value={pkgVenueRate}
                            onChange={(e) => setPkgVenueRate(Number(e.target.value))}
                            className="neu-input px-2 py-1 w-20 font-mono font-bold text-center text-emerald-700 dark:text-emerald-400"
                          />
                          <span className="text-gray-600 dark:text-gray-300 font-mono">₱</span>
                        </div>
                      )}
                    </div>

                    <div className="flex items-center justify-between gap-4 border-t border-gray-200 dark:border-gray-800 pt-2.5">
                      <label className="flex items-center gap-2 cursor-pointer">
                        <input
                          type="checkbox"
                          checked={pkgAccomActive}
                          onChange={(e) => setPkgAccomActive(e.target.checked)}
                          className="accent-emerald-600"
                        />
                        <span className="text-gray-900 dark:text-gray-100 font-semibold text-xs">
                          Overnight Stay
                        </span>
                      </label>
                      {pkgAccomActive && (
                        <div className="flex items-center gap-1.5">
                          <span className="text-gray-600 dark:text-gray-300 text-xs">
                            Extra Guest:
                          </span>
                          <input
                            type="number"
                            value={pkgAccomRate}
                            onChange={(e) => setPkgAccomRate(Number(e.target.value))}
                            className="neu-input px-2 py-1 w-20 font-mono font-bold text-center text-emerald-700 dark:text-emerald-400"
                          />
                          <span className="text-gray-600 dark:text-gray-300 font-mono">₱</span>
                        </div>
                      )}
                    </div>
                  </div>
                </div>

                <button
                  type="submit"
                  className="neu-btn-primary w-full font-bold py-3.5 text-xs"
                >
                  Save Villa, Deposit Rate &amp; Map Location
                </button>
              </form>
            )}

            {activeForm === 'rate_tier' && (
              <form onSubmit={saveRateTier} className="space-y-4">
                <div className="grid grid-cols-2 gap-3.5">
                  <div>
                    <label className="block font-semibold mb-1.5 text-gray-600 dark:text-gray-300">
                      Included Guests
                    </label>
                    <input
                      type="number"
                      required
                      value={tierBasePax}
                      onChange={(e) => setTierBasePax(Number(e.target.value))}
                      className="neu-input w-full px-3.5 py-2.5 text-sm font-mono font-semibold text-gray-900 dark:text-gray-100"
                    />
                  </div>
                  <div>
                    <label className="block font-semibold mb-1.5 text-gray-600 dark:text-gray-300">
                      Time Slot
                    </label>
                    <select
                      value={tierTimeSlot}
                      onChange={(e) => setTierTimeSlot(e.target.value as TimeSlot)}
                      className="neu-input w-full px-3.5 py-2.5 text-sm font-semibold text-gray-900 dark:text-gray-100"
                    >
                      <option value="day">Daytime</option>
                      <option value="evening">Evening</option>
                    </select>
                  </div>
                </div>
                <div>
                  <label className="block font-semibold mb-1.5 text-gray-600 dark:text-gray-300">
                    Day Type
                  </label>
                  <select
                    value={tierDayGroup}
                    onChange={(e) => setTierDayGroup(e.target.value as DayGroup)}
                    className="neu-input w-full px-3.5 py-2.5 text-sm font-semibold text-gray-900 dark:text-gray-100"
                  >
                    <option value="weekday">Weekday (Mon–Thu)</option>
                    <option value="weekend_holiday">Weekend / Holiday (Fri–Sun)</option>
                  </select>
                </div>
                <div>
                  <label className="block font-semibold mb-1.5 text-gray-600 dark:text-gray-300">
                    Package Price (₱)
                  </label>
                  <input
                    type="number"
                    required
                    value={tierPrice}
                    onChange={(e) => setTierPrice(Number(e.target.value))}
                    className="neu-input w-full px-3.5 py-2.5 font-mono font-bold text-emerald-700 dark:text-emerald-400 text-sm"
                  />
                </div>
                <button
                  type="submit"
                  className="neu-btn-primary w-full font-bold py-3 text-xs"
                >
                  Save Price Tier
                </button>
              </form>
            )}
          </div>
        </div>
      )}
    </section>
  );
}