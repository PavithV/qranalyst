export default function Home() {
  return (
    <div className="min-h-screen flex flex-col items-center justify-center gap-6 p-6 bg-zinc-50">
      <div className="text-center flex flex-col gap-2">
        <h1 className="text-3xl font-semibold">Simple QR + Analytics</h1>
        <p className="text-zinc-600">
          Trackbare QR-Codes erstellen, scannen und Analytics ansehen.
        </p>
      </div>

      <div className="flex gap-3">
        <a
          href="/login"
          className="rounded-lg bg-black text-white px-4 py-2 hover:opacity-90"
        >
          Anmelden
        </a>
        <a
          href="/signup"
          className="rounded-lg border border-zinc-300 bg-white px-4 py-2 hover:bg-zinc-50"
        >
          Registrieren
        </a>
      </div>
    </div>
  );
}
