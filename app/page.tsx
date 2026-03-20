import Link from "next/link";
import { ArrowRight, Lock, Sparkles } from "lucide-react";

export default function Home() {
  return (
    <section className="mx-auto w-full max-w-6xl px-6 py-24 md:py-32">
      <div className="mx-auto flex max-w-3xl flex-col items-center text-center">
        <div className="mb-6 inline-flex items-center gap-2 rounded-full border border-border bg-muted/50 px-3 py-1 text-xs font-medium text-muted-foreground">
          <Sparkles className="size-3.5" />
          Simple QR + Analytics
        </div>
        <h1 className="text-balance text-4xl font-semibold tracking-tight md:text-6xl">
          Create QR experiences with clean analytics.
        </h1>
        <p className="mt-5 max-w-2xl text-pretty text-base text-muted-foreground md:text-lg">
          Build trackable QR codes in seconds, monitor scans in real time, and keep every campaign
          organized in one modern dashboard.
        </p>
        <div className="mt-10 flex flex-wrap items-center justify-center gap-3">
          <Link
            href="/signup"
            className="inline-flex h-11 items-center gap-2 rounded-lg bg-primary px-5 text-sm font-medium text-primary-foreground shadow-sm transition-opacity hover:opacity-90"
          >
            Get Started
            <ArrowRight className="size-4" />
          </Link>
          <Link
            href="/login"
            className="inline-flex h-11 items-center gap-2 rounded-lg border border-border bg-background px-5 text-sm font-medium text-foreground transition-colors hover:bg-muted"
          >
            <Lock className="size-4" />
            Login
          </Link>
        </div>
      </div>
      <div className="mt-20 grid gap-4 md:grid-cols-3">
        {[
          ["Fast Setup", "Create branded QR codes in under a minute."],
          ["Live Signals", "Track scans, campaigns, and growth instantly."],
          ["Clean Reports", "Understand performance with minimal noise."],
        ].map(([title, copy]) => (
          <article
            key={title}
            className="rounded-xl border border-border bg-card p-5 text-left shadow-sm"
          >
            <h2 className="text-sm font-semibold">{title}</h2>
            <p className="mt-2 text-sm text-muted-foreground">{copy}</p>
          </article>
        ))}
      </div>
    </section>
  );
}
