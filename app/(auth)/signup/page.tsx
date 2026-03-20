"use client";

import { z } from "zod";
import { useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";

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
    <div className="min-h-screen flex items-center justify-center p-6 bg-zinc-50">
      <form
        onSubmit={onSubmit}
        className="w-full max-w-sm rounded-xl border bg-white p-6 shadow-sm flex flex-col gap-4"
      >
        <h1 className="text-xl font-semibold">Registrieren</h1>

        <label className="flex flex-col gap-1">
          <span className="text-sm text-zinc-700">E-Mail</span>
          <input
            name="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            className="border rounded-lg px-3 py-2"
            type="email"
            autoComplete="email"
            required
          />
        </label>

        <label className="flex flex-col gap-1">
          <span className="text-sm text-zinc-700">Passwort</span>
          <input
            name="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            className="border rounded-lg px-3 py-2"
            type="password"
            autoComplete="new-password"
            required
          />
        </label>

        {error ? <p className="text-sm text-red-600">{error}</p> : null}
        {info ? <p className="text-sm text-zinc-700">{info}</p> : null}

        <button
          type="submit"
          disabled={loading}
          className="mt-1 rounded-lg bg-black text-white py-2 px-3 disabled:opacity-50"
        >
          {loading ? "Registriere..." : "Registrieren"}
        </button>

        <p className="text-sm text-zinc-600">
          Schon einen Account?{" "}
          <a className="underline" href="/login">
            Anmelden
          </a>
        </p>
      </form>
    </div>
  );
}

