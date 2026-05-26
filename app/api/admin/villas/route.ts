import { createClient } from "@/utils/supabase/server";
import { NextRequest, NextResponse } from "next/server";

export async function POST(req: NextRequest) {
  try {
    const supabase = await createClient();
    const body = await req.json();
    
    const { 
      name, description, imageUrls, inclusions, categoryType,
      pkgCateringActive, pkgCateringRate,
      pkgVenueActive, pkgVenueRate,
      pkgAccomActive, pkgAccomRate
    } = body;

    // 1. Insert Core Villa listing row (image_url field repurposed to store JSON array string or comma-delimited tokens)
    const { data: villa, error: villaErr } = await supabase
      .from("villas")
      .insert([{
        name,
        description,
        image_url: imageUrls && imageUrls.length > 0 ? JSON.stringify(imageUrls) : null,
        inclusions,
        category_type: categoryType
      }])
      .select().single();

    if (villaErr) throw villaErr;

    // 2. Batch construct checked package schemas relationally
    const packagesToInsert = [];
    if (pkgCateringActive) packagesToInsert.push({ villa_id: villa.id, name: 'with_catering', excess_pax_rate: Number(pkgCateringRate) });
    if (pkgVenueActive) packagesToInsert.push({ villa_id: villa.id, name: 'venue_only', excess_pax_rate: Number(pkgVenueRate) });
    if (pkgAccomActive) packagesToInsert.push({ villa_id: villa.id, name: 'accommodation_only', excess_pax_rate: Number(pkgAccomRate) });

    if (packagesToInsert.length > 0) {
      const { error: pkgErr } = await supabase.from("packages").insert(packagesToInsert);
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
      villaId, name, description, imageUrls, inclusions, categoryType,
      pkgCateringActive, pkgCateringRate,
      pkgVenueActive, pkgVenueRate,
      pkgAccomActive, pkgAccomRate
    } = body;

    // 1. Update Core Villa specifications
    const { data: villa, error: villaErr } = await supabase
      .from("villas")
      .update({
        name,
        description,
        image_url: imageUrls && imageUrls.length > 0 ? JSON.stringify(imageUrls) : null,
        inclusions,
        category_type: categoryType
      })
      .eq("id", villaId)
      .select().single();

    if (villaErr) throw villaErr;

    // 2. Synchronize packages
    const activeNames: string[] = [];
    if (pkgCateringActive) activeNames.push('with_catering');
    if (pkgVenueActive) activeNames.push('venue_only');
    if (pkgAccomActive) activeNames.push('accommodation_only');

    if (activeNames.length > 0) {
      await supabase.from("packages").delete().eq("villa_id", villaId).not("name", "in", `(${activeNames.join(',')})`);
    } else {
      await supabase.from("packages").delete().eq("villa_id", villaId);
    }

    const syncPackage = async (pName: string, rate: number) => {
      const { data: existing } = await supabase.from("packages").select("id").eq("villa_id", villaId).eq("name", pName).maybeSingle();
      if (existing) {
        await supabase.from("packages").update({ excess_pax_rate: Number(rate) }).eq("id", existing.id);
      } else {
        await supabase.from("packages").insert([{ villa_id: villaId, name: pName, excess_pax_rate: Number(rate) }]);
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