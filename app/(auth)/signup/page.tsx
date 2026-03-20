"use client";

import { z } from "zod";
import { useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { UserPlus } from "lucide-react";

import { supabase } from "@/lib/supabase/browser";
import { posthogCaptureClient } from "@/lib/posthog/capture-client";

const signupSchema = z.object({
  email: z.string().email("Bitte eine gültige E-Mail eingeben."),
  password: z.string().min(8, "Das Passwort muss mindestens 8 Zeichen haben."),
});

export default function SignupPage() {
  const router = useRouter();

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [info, setInfo] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function onSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(null);
    setInfo(null);

    const parsed = signupSchema.safeParse({ email, password });
    if (!parsed.success) {
      setError(parsed.error.issues[0]?.message ?? "Eingaben sind ungültig.");
      return;
    }

    setLoading(true);
    if (!supabase) {
      setError(
        "Supabase ist nicht konfiguriert. Bitte setze `NEXT_PUBLIC_SUPABASE_URL` und `NEXT_PUBLIC_SUPABASE_ANON_KEY`.",
      );
      setLoading(false);
      return;
    }

    void posthogCaptureClient({
      event: "signup_started",
      distinctId: email.trim(),
      properties: {
        user_id: email.trim(),
        project_id: null,
        qr_code_id: null,
        campaign: null,
        plan: "FREE",
        source: "auth",
      },
    });

    const { data, error } = await supabase.auth.signUp({
      email: parsed.data.email,
      password: parsed.data.password,
    });
    setLoading(false);

    if (error) {
      setError(error.message);
      return;
    }

    // Häufiges Verhalten: Bei Email-Bestätigung wird kein Session-User erstellt.
    if (data.user) {
      void posthogCaptureClient({
        event: "signup_completed",
        distinctId: data.user.id,
        properties: {
          user_id: data.user.id,
          project_id: null,
          qr_code_id: null,
          campaign: null,
          plan: "FREE",
          source: "auth",
        },
      });
      router.push("/dashboard");
      return;
    }

    setInfo(
      "Bitte bestätige deine E-Mail. Danach kannst du dich anmelden.",
    );
  }

  return (
    <div className="flex min-h-[calc(100vh-4rem)] items-center justify-center px-6 py-12">
      <form
        onSubmit={onSubmit}
        className="w-full max-w-md rounded-xl border border-border bg-card p-6 text-card-foreground shadow-sm"
      >
        <div className="mb-5 space-y-1">
          <h1 className="text-xl font-semibold tracking-tight">Account erstellen</h1>
          <p className="text-sm text-muted-foreground">Starte mit deinem neuen QR Analytics Workspace.</p>
        </div>

        <div className="space-y-4">
        <label className="flex flex-col gap-1.5">
          <span className="text-sm text-muted-foreground">E-Mail</span>
          <input
            name="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            className="h-11 rounded-lg border border-border bg-background px-3 text-sm outline-none transition focus-visible:ring-2 focus-visible:ring-ring"
            type="email"
            autoComplete="email"
            required
          />
        </label>

        <label className="flex flex-col gap-1.5">
          <span className="text-sm text-muted-foreground">Passwort</span>
          <input
            name="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            className="h-11 rounded-lg border border-border bg-background px-3 text-sm outline-none transition focus-visible:ring-2 focus-visible:ring-ring"
            type="password"
            autoComplete="new-password"
            required
          />
        </label>
        </div>

        {error ? <p className="mt-4 text-sm text-destructive">{error}</p> : null}
        {info ? <p className="mt-4 text-sm text-muted-foreground">{info}</p> : null}

        <button
          type="submit"
          disabled={loading}
          className="mt-5 inline-flex h-11 items-center justify-center gap-2 rounded-lg bg-primary px-4 text-sm font-medium text-primary-foreground transition-opacity hover:opacity-90 disabled:opacity-50"
        >
          <UserPlus className="size-4" />
          {loading ? "Registriere..." : "Registrieren"}
        </button>

        <p className="mt-4 text-sm text-muted-foreground">
          Schon einen Account?{" "}
          <Link className="underline underline-offset-4 hover:text-foreground" href="/login">
            Anmelden
          </Link>
        </p>
      </form>
    </div>
  );
}

