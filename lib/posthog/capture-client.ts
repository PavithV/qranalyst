type CaptureProperties = Record<string, unknown>;

function envName(): string {
  if (process.env.NODE_ENV === "production") return "production";
  if (process.env.VERCEL_ENV) return process.env.VERCEL_ENV;
  return "development";
}

function normalizeHost(host: string): string {
  return host.endsWith("/") ? host.slice(0, -1) : host;
}

export async function posthogCaptureClient(args: {
  event: string;
  properties: CaptureProperties;
  distinctId?: string;
}): Promise<void> {
  const apiKey = process.env.NEXT_PUBLIC_POSTHOG_KEY;
  const host = process.env.NEXT_PUBLIC_POSTHOG_HOST;

  if (!apiKey || !host) return;

  const url = `${normalizeHost(host)}/capture/`;

  const payload = {
    api_key: apiKey,
    event: args.event,
    distinct_id: args.distinctId ?? args.properties.user_id ?? "anonymous",
    properties: {
      environment: envName(),
      ...args.properties,
    },
  };

  await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  }).catch(() => {
    // Intentionally ignore capture failures in the browser.
  });
}

