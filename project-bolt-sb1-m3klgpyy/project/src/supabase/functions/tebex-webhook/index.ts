// VibeBlox Tebex Webhook Handler
// Listens for Tebex package purchase signals, verifies the HMAC signature,
// parses the player's username, and updates their rank in the database.
//
// Environment variables (configured via Supabase secrets — do NOT hardcode):
//   TEBEX_SECRET_KEY — shared secret used to verify webhook signatures
//   SUPABASE_URL     — auto-provided by the Supabase edge runtime
//   SUPABASE_ANON_KEY — auto-provided by the Supabase edge runtime
//   SUPABASE_SERVICE_ROLE_KEY — auto-provided, used to write to player_ranks

import { createClient } from "npm:@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Client-Info, Apikey",
};

// Placeholder reference — the actual key is injected via Supabase edge function secrets.
// process.env.TEBEX_SECRET_KEY is used at runtime; never hardcode a real key here.
const TEBEX_SECRET_KEY = process.env.TEBEX_SECRET_KEY;

// Map Tebex package IDs/names to internal rank values.
// In production these would match the Tebex package configuration.
const PACKAGE_RANK_MAP: Record<string, string> = {
  vanguard: "vanguard",
  elite: "elite",
  champion: "champion",
};

async function verifySignature(body: string, signature: string | null, secret: string): Promise<boolean> {
  if (!signature || !secret) return false;
  // Tebex sends an HMAC-SHA256 signature in the X-Signature header.
  const key = await crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign", "verify"],
  );
  const sigBytes = new Uint8Array(
    signature.match(/.{2}/g)?.map((byte) => parseInt(byte, 16)) ?? [],
  );
  const dataBytes = new TextEncoder().encode(body);
  return crypto.subtle.verify("HMAC", key, sigBytes, dataBytes);
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { status: 200, headers: corsHeaders });
  }

  if (req.method !== "POST") {
    return new Response(
      JSON.stringify({ error: "Method not allowed" }),
      { status: 405, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  }

  try {
    const rawBody = await req.text();
    const signature = req.headers.get("X-Signature") ?? req.headers.get("X-Tebex-Signature");

    // Verify webhook signature — reject if invalid or secret not configured
    if (!TEBEX_SECRET_KEY) {
      console.error("TEBEX_SECRET_KEY is not configured");
      return new Response(
        JSON.stringify({ error: "Server configuration error" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    const isValid = await verifySignature(rawBody, signature, TEBEX_SECRET_KEY);
    if (!isValid) {
      console.error("Invalid webhook signature");
      return new Response(
        JSON.stringify({ error: "Invalid signature" }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    // Parse the webhook payload
    let payload: Record<string, unknown>;
    try {
      payload = JSON.parse(rawBody);
    } catch {
      return new Response(
        JSON.stringify({ error: "Invalid JSON payload" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    // Extract the subject (player username) and transaction info from Tebex payload.
    // Tebex webhook structure varies by event type; we handle the common "payment" / "validation" shapes.
    const subject = payload.subject as Record<string, unknown> | undefined;
    const transaction = payload.transaction as Record<string, unknown> | undefined;
    const packages = payload.packages as Array<Record<string, unknown>> | undefined;

    // Try multiple field paths for the username
    const username =
      (subject?.username as string) ??
      (subject?.name as string) ??
      (transaction?.username as string) ??
      (payload.username as string);

    // Try to determine the rank from package data
    let rank = "free";
    if (packages && Array.isArray(packages) && packages.length > 0) {
      const pkg = packages[0];
      const pkgName = (pkg.name as string ?? "").toLowerCase();
      const pkgId = String(pkg.id ?? "");
      rank = PACKAGE_RANK_MAP[pkgName] ?? PACKAGE_RANK_MAP[pkgId] ?? "free";
    } else if (payload.type === "payment") {
      // Some Tebex payloads put the package in a different location
      const pkgName = String(payload.package_name ?? "").toLowerCase();
      rank = PACKAGE_RANK_MAP[pkgName] ?? "free";
    }

    if (!username || rank === "free") {
      console.error("Missing username or unrecognized package in webhook payload");
      return new Response(
        JSON.stringify({ error: "Missing required fields" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    // Update the player's rank in the database using the service role client
    const supabase = createClient(
      process.env.SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!,
    );

    const { error } = await supabase
      .from("player_ranks")
      .upsert(
        { username, rank, updated_at: new Date().toISOString() },
        { onConflict: "username" },
      );

    if (error) {
      console.error("Database error:", error.message);
      return new Response(
        JSON.stringify({ error: "Failed to update rank" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    return new Response(
      JSON.stringify({ success: true, username, rank }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  } catch (err) {
    console.error("Webhook error:", err);
    return new Response(
      JSON.stringify({ error: "Internal server error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  }
});
