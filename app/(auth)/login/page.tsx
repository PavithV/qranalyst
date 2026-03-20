"use client";

import { z } from "zod";
import { useMemo, useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { LogIn } from "lucide-react";

import { supabase } from "@/lib/supabase/browser";

const loginSchema = z.object({
  email: z.string().email("Bitte eine gültige E-Mail eingeben."),
  password: z.string().min(8, "Das Passwort muss mindestens 8 Zeichen haben."),
});

export default function LoginPage() {
  const router = useRouter();

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const canSubmit = useMemo(() => email.length > 0 && password.length > 0, [email, password]);

  async function onSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(null);

    const parsed = loginSchema.safeParse({ email, password });
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

    const { error } = await supabase.auth.signInWithPassword({
      email: parsed.data.email,
      password: parsed.data.password,
    });
    setLoading(false);

    if (error) {
      setError(error.message);
      return;
    }

    router.push("/dashboard");
  }

  return (
    <div className="flex min-h-[calc(100vh-4rem)] items-center justify-center px-6 py-12">
      <form
        onSubmit={onSubmit}
        className="w-full max-w-md rounded-xl border border-border bg-card p-6 text-card-foreground shadow-sm"
      >
        <div className="mb-5 space-y-1">
          <h1 className="text-xl font-semibold tracking-tight">Willkommen zurück</h1>
          <p className="text-sm text-muted-foreground">Melde dich an, um dein Dashboard zu öffnen.</p>
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
            autoComplete="current-password"
            required
          />
        </label>
        </div>

        {error ? <p className="mt-4 text-sm text-destructive">{error}</p> : null}

        <button
          type="submit"
          disabled={!canSubmit || loading}
          className="mt-5 inline-flex h-11 items-center justify-center gap-2 rounded-lg bg-primary px-4 text-sm font-medium text-primary-foreground transition-opacity hover:opacity-90 disabled:opacity-50"
        >
          <LogIn className="size-4" />
          {loading ? "Anmeldung..." : "Anmelden"}
        </button>

        <p className="mt-4 text-sm text-muted-foreground">
          Noch keinen Account?{" "}
          <Link className="underline underline-offset-4 hover:text-foreground" href="/signup">
            Registrieren
          </Link>
        </p>
      </form>
    </div>
  );
}

