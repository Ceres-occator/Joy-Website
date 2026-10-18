import { createClient } from '@/utils/supabase/server';
import { NextRequest, NextResponse } from 'next/server';

export async function POST(req: NextRequest) {
  try {
    const supabase = await createClient();
    const body = await req.json();

    const {
      name,
      description,
      imageUrls,
      inclusions,
      categoryType,
      minDepositPercent,
      address,
      latitude,
      longitude,
      mapZoom,
      pkgCateringActive,
      pkgCateringRate,
      pkgVenueActive,
      pkgVenueRate,
      pkgAccomActive,
      pkgAccomRate,
    } = body;

    const depositPct = Number.isFinite(Number(minDepositPercent))
      ? Math.min(100, Math.max(0, Number(minDepositPercent)))
      : 50;

    const insertRow: Record<string, any> = {
      name,
      description,
      image_url: imageUrls && imageUrls.length > 0 ? JSON.stringify(imageUrls) : null,
      inclusions,
      category_type: categoryType,
      min_deposit_percent: depositPct,
      address: address || 'Ma-a, Davao City, Philippines, 8000',
      latitude: Number.isFinite(Number(latitude)) ? Number(latitude) : 7.0915,
      longitude: Number.isFinite(Number(longitude)) ? Number(longitude) : 125.5826,
      map_zoom: Number.isFinite(Number(mapZoom)) ? Number(mapZoom) : 16,
    };

    let { data: villa, error: villaErr } = await supabase
      .from('villas')
      .insert([insertRow])
      .select()
      .single();

    // Graceful fallback if min_deposit_percent column migration hasn't been executed yet
    if (villaErr && villaErr.message?.includes('min_deposit_percent')) {
      delete insertRow.min_deposit_percent;
      const retry = await supabase.from('villas').insert([insertRow]).select().single();
      villa = retry.data;
      villaErr = retry.error;
    }

    if (villaErr) throw villaErr;

    const packagesToInsert = [];
    if (pkgCateringActive) {
      packagesToInsert.push({
        villa_id: villa.id,
        name: 'with_catering',
        excess_pax_rate: Number(pkgCateringRate),
      });
    }
    if (pkgVenueActive) {
      packagesToInsert.push({
        villa_id: villa.id,
        name: 'venue_only',
        excess_pax_rate: Number(pkgVenueRate),
      });
    }
    if (pkgAccomActive) {
      packagesToInsert.push({
        villa_id: villa.id,
        name: 'accommodation_only',
        excess_pax_rate: Number(pkgAccomRate),
      });
    }

    if (packagesToInsert.length > 0) {
      const { error: pkgErr } = await supabase.from('packages').insert(packagesToInsert);
      if (pkgErr) throw pkgErr;
    }

    return NextResponse.json({ success: true, villa });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

export async function PUT(req: NextRequest) {
  try {
    const supabase = await createClient();
    const body = await req.json();

    const {
      villaId,
      name,
      description,
      imageUrls,
      inclusions,
      categoryType,
      minDepositPercent,
      address,
      latitude,
      longitude,
      mapZoom,
      pkgCateringActive,
      pkgCateringRate,
      pkgVenueActive,
      pkgVenueRate,
      pkgAccomActive,
      pkgAccomRate,
    } = body;

    const updatePayload: Record<string, any> = {
      name,
      description,
      image_url: imageUrls && imageUrls.length > 0 ? JSON.stringify(imageUrls) : null,
      inclusions,
      category_type: categoryType,
    };

    if (minDepositPercent !== undefined && Number.isFinite(Number(minDepositPercent))) {
      updatePayload.min_deposit_percent = Math.min(100, Math.max(0, Number(minDepositPercent)));
    }
    if (address !== undefined) updatePayload.address = address;
    if (latitude !== undefined && Number.isFinite(Number(latitude))) {
      updatePayload.latitude = Number(latitude);
    }
    if (longitude !== undefined && Number.isFinite(Number(longitude))) {
      updatePayload.longitude = Number(longitude);
    }
    if (mapZoom !== undefined && Number.isFinite(Number(mapZoom))) {
      updatePayload.map_zoom = Number(mapZoom);
    }

    let { data: villa, error: villaErr } = await supabase
      .from('villas')
      .update(updatePayload)
      .eq('id', villaId)
      .select()
      .single();

    if (villaErr && villaErr.message?.includes('min_deposit_percent')) {
      delete updatePayload.min_deposit_percent;
      const retry = await supabase
        .from('villas')
        .update(updatePayload)
        .eq('id', villaId)
        .select()
        .single();
      villa = retry.data;
      villaErr = retry.error;
    }

    if (villaErr) throw villaErr;

    const activeNames: string[] = [];
    if (pkgCateringActive) activeNames.push('with_catering');
    if (pkgVenueActive) activeNames.push('venue_only');
    if (pkgAccomActive) activeNames.push('accommodation_only');

    if (activeNames.length > 0) {
      await supabase
        .from('packages')
        .delete()
        .eq('villa_id', villaId)
        .not('name', 'in', `(${activeNames.join(',')})`);
    } else {
      await supabase.from('packages').delete().eq('villa_id', villaId);
    }

    const syncPackage = async (pName: string, rate: number) => {
      const { data: existing } = await supabase
        .from('packages')
        .select('id')
        .eq('villa_id', villaId)
        .eq('name', pName)
        .maybeSingle();
      if (existing) {
        await supabase
          .from('packages')
          .update({ excess_pax_rate: Number(rate) })
          .eq('id', existing.id);
      } else {
        await supabase
          .from('packages')
          .insert([{ villa_id: villaId, name: pName, excess_pax_rate: Number(rate) }]);
      }
    };

    if (pkgCateringActive) await syncPackage('with_catering', pkgCateringRate);
    if (pkgVenueActive) await syncPackage('venue_only', pkgVenueRate);
    if (pkgAccomActive) await syncPackage('accommodation_only', pkgAccomRate);

    return NextResponse.json({ success: true, villa });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}