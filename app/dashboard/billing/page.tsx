import { createSupabaseServerClient } from "@/lib/supabase/server";
import UpgradePlanButtons from "@/components/dashboard/UpgradePlanButtons";
import BillingOutcomeEvents from "@/components/dashboard/BillingOutcomeEvents";

export const dynamic = "force-dynamic";

export default async function BillingPage({
  searchParams,
}: {
  searchParams: { success?: string; canceled?: string; plan?: string };
}) {
  const supabase = createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const { data: subscription } = await supabase
    .from("subscriptions")
    .select("plan,status")
    .eq("user_id", user?.id ?? "")
    .maybeSingle();

  const outcome =
    searchParams?.success === "1"
      ? "success"
      : searchParams?.canceled === "1"
        ? "canceled"
        : null;

  const planFromQuery = (searchParams?.plan ?? "").toUpperCase();
  const planForEvents = (planFromQuery === "STARTER" || planFromQuery === "PRO"
    ? (planFromQuery as "STARTER" | "PRO")
    : (subscription?.plan ?? "FREE")) as "FREE" | "STARTER" | "PRO";

  return (
    <div className="min-h-screen p-6">
      <div className="max-w-2xl mx-auto flex flex-col gap-6">
        <div className="flex flex-col gap-1">
          <h1 className="text-2xl font-semibold">Billing</h1>
          <p className="text-zinc-600">
            Aktueller Status:{" "}
            <span className="font-medium">{subscription?.status ?? "-"}</span>{" "}
            · Plan: <span className="font-medium">{subscription?.plan ?? "-"}</span>
          </p>
        </div>

        <section className="rounded-xl border bg-white p-4">
          <h2 className="text-lg font-semibold mb-2">Plan upgraden</h2>
          <UpgradePlanButtons currentPlan={subscription?.plan ?? "FREE"} />
        </section>

        {outcome === "success" ? (
          <p className="text-sm text-emerald-700">
            Checkout abgeschlossen. Webhook aktualisiert das Abo.
          </p>
        ) : null}
        {outcome === "canceled" ? (
          <p className="text-sm text-zinc-600">
            Checkout abgebrochen.
          </p>
        ) : null}
      </div>
      <BillingOutcomeEvents outcome={outcome} plan={planForEvents} />
    </div>
  );
}

