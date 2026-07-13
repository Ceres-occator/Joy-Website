import { createClient } from "@/utils/supabase/server";
import { NextResponse } from "next/server";

// Fetch all FAQs ordered by display layout sequence
export async function GET() {
  try {
    const supabase = await createClient();
    const { data, error } = await supabase
      .from("faqs")
      .select("*")
      .order("display_order", { ascending: true });

    if (error) throw error;
    return NextResponse.json({ faqs: data || [] });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

// Add a brand new FAQ item entry
export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { question, answer, display_order } = body;
    const supabase = await createClient();

    const { data, error } = await supabase
      .from("faqs")
      .insert([{ question, answer, display_order: Number(display_order || 0) }])
      .select();

    if (error) throw error;
    return NextResponse.json({ success: true, faq: data[0] });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

// Modify an existing FAQ entry row parameters
export async function PUT(request: Request) {
  try {
    const body = await request.json();
    const { id, question, answer, display_order } = body;
    const supabase = await createClient();

    const { data, error } = await supabase
      .from("faqs")
      .update({ question, answer, display_order: Number(display_order || 0) })
      .eq("id", id)
      .select();

    if (error) throw error;
    return NextResponse.json({ success: true, faq: data[0] });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

// Purge an item from the database table framework entirely
export async function DELETE(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const id = searchParams.get("id");
    if (!id) return NextResponse.json({ error: "Missing identifier target id" }, { status: 400 });

    const supabase = await createClient();
    const { error } = await supabase.from("faqs").delete().eq("id", id);

    if (error) throw error;
    return NextResponse.json({ success: true });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}