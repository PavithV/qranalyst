import type { SupabaseClient } from "@supabase/supabase-js";

export type QrAnalyticsResponse = {
  totalScans: number;
  scansByDay: Array<{ day: string; scans: number }>;
  scansByCountry: Array<{ countryCode: string; scans: number }>;
  scansByDevice: Array<{ deviceType: string; scans: number }>;
  uniqueScannersApprox: number;
  retentionDays: number;
  truncated: boolean;
};

type ScanEventRow = {
  created_at: string;
  country_code: string | null;
  device_type: string | null;
  ip_hash: string | null;
};

function dayKeyFromIso(iso: string): string {
  // Use UTC day buckets to keep results stable.
  return new Date(iso).toISOString().slice(0, 10);
}

export async function getQrAnalytics(args: {
  supabase: SupabaseClient;
  qrCodeId: string;
  retentionDays: number;
  maxEvents?: number;
}): Promise<QrAnalyticsResponse> {
  const { supabase, qrCodeId, retentionDays, maxEvents = 5000 } = args;

  const since = new Date(Date.now() - retentionDays * 24 * 60 * 60 * 1000).toISOString();

  const { count, error: countError } = await supabase
    .from("scan_events")
    .select("id", { count: "exact", head: true })
    .eq("qr_code_id", qrCodeId)
    .gte("created_at", since);

  if (countError) {
    // Non-fatal: we can still compute aggregates from the sampled event list.
    console.warn("count scan_events failed:", countError.message);
  }

  const { data: events, error: eventsError } = await supabase
    .from("scan_events")
    .select("created_at,country_code,device_type,ip_hash")
    .eq("qr_code_id", qrCodeId)
    .gte("created_at", since)
    .order("created_at", { ascending: false })
    .limit(maxEvents);

  if (eventsError) {
    throw new Error(`scan_events fetch failed: ${eventsError.message}`);
  }

  const scansByDayMap = new Map<string, number>();
  const scansByCountryMap = new Map<string, number>();
  const scansByDeviceMap = new Map<string, number>();
  const uniqueIpHashes = new Set<string>();

  for (const ev of (events ?? []) as ScanEventRow[]) {
    const day = dayKeyFromIso(ev.created_at);
    scansByDayMap.set(day, (scansByDayMap.get(day) ?? 0) + 1);

    if (ev.country_code) {
      scansByCountryMap.set(ev.country_code, (scansByCountryMap.get(ev.country_code) ?? 0) + 1);
    }
    if (ev.device_type) {
      scansByDeviceMap.set(ev.device_type, (scansByDeviceMap.get(ev.device_type) ?? 0) + 1);
    }
    if (ev.ip_hash) uniqueIpHashes.add(ev.ip_hash);
  }

  const truncated = (events?.length ?? 0) >= maxEvents;

  return {
    totalScans: typeof count === "number" ? count : events?.length ?? 0,
    scansByDay: Array.from(scansByDayMap.entries())
      .map(([day, scans]) => ({ day, scans }))
      .sort((a, b) => a.day.localeCompare(b.day)),
    scansByCountry: Array.from(scansByCountryMap.entries())
      .map(([countryCode, scans]) => ({ countryCode, scans }))
      .sort((a, b) => b.scans - a.scans),
    scansByDevice: Array.from(scansByDeviceMap.entries())
      .map(([deviceType, scans]) => ({ deviceType, scans }))
      .sort((a, b) => b.scans - a.scans),
    uniqueScannersApprox: uniqueIpHashes.size,
    retentionDays,
    truncated,
  };
}

