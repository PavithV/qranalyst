"use client";

import { useCallback, useEffect, useState } from "react";

import { Button } from "@/components/ui/button";
import { KeyRound, Loader2, Trash2 } from "lucide-react";

type ApiKeyRow = {
  id: string;
  name: string;
  keyPrefix: string;
  createdAt: string;
  lastUsedAt: string | null;
};

export default function ApiKeysManager() {
  const [keys, setKeys] = useState<ApiKeyRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [name, setName] = useState("");
  const [creating, setCreating] = useState(false);
  const [newSecret, setNewSecret] = useState<string | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  const load = useCallback(async () => {
    setError(null);
    const res = await fetch("/api/account/api-keys", { credentials: "include" });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) {
      setError(typeof data.error === "string" ? data.error : "Laden fehlgeschlagen");
      setKeys([]);
      return;
    }
    setKeys(Array.isArray(data.apiKeys) ? data.apiKeys : []);
  }, []);

  useEffect(() => {
    void load().finally(() => setLoading(false));
  }, [load]);

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault();
    if (!name.trim()) return;
    setCreating(true);
    setError(null);
    setNewSecret(null);
    try {
      const res = await fetch("/api/account/api-keys", {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: name.trim() }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(typeof data.error === "string" ? data.error : "Erstellung fehlgeschlagen");
        return;
      }
      if (data.apiKey?.secret && typeof data.apiKey.secret === "string") {
        setNewSecret(data.apiKey.secret);
      }
      setName("");
      await load();
    } finally {
      setCreating(false);
    }
  }

  async function handleRevoke(id: string) {
    if (!confirm("API-Key wirklich widerrufen? Externe Integrationen verlieren den Zugriff.")) {
      return;
    }
    setDeletingId(id);
    setError(null);
    try {
      const res = await fetch(`/api/account/api-keys/${id}`, {
        method: "DELETE",
        credentials: "include",
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(typeof data.error === "string" ? data.error : "Widerruf fehlgeschlagen");
        return;
      }
      await load();
    } finally {
      setDeletingId(null);
    }
  }

  return (
    <div className="flex flex-col gap-6">
      <section className="rounded-xl border border-border bg-card p-5 shadow-sm">
        <h2 className="mb-3 text-lg font-semibold">Neuen API-Key erstellen</h2>
        <p className="mb-4 text-sm text-muted-foreground">
          Der vollständige Secret wird nur einmal angezeigt. Speichere ihn sicher (z.&nbsp;B.
          Passwort-Manager). In der Datenbank liegt nur ein Hash.
        </p>
        <form onSubmit={handleCreate} className="flex flex-col gap-3 sm:flex-row sm:items-end">
          <div className="flex min-w-0 flex-1 flex-col gap-1">
            <label htmlFor="api-key-name" className="text-xs font-medium text-muted-foreground">
              Bezeichnung
            </label>
            <input
              id="api-key-name"
              className="h-9 rounded-md border border-input bg-background px-3 text-sm"
              placeholder="z. B. Produktion / Zapier"
              value={name}
              onChange={(e) => setName(e.target.value)}
              maxLength={120}
            />
          </div>
          <Button type="submit" disabled={creating || !name.trim()}>
            {creating ? (
              <>
                <Loader2 className="mr-2 size-4 animate-spin" />
                Erstelle…
              </>
            ) : (
              <>
                <KeyRound className="mr-2 size-4" />
                Key erzeugen
              </>
            )}
          </Button>
        </form>
      </section>

      {newSecret ? (
        <div className="rounded-xl border border-amber-500/40 bg-amber-500/5 p-4 text-sm">
          <p className="font-medium text-foreground">Neuer Secret (nur jetzt sichtbar)</p>
          <code className="mt-2 block break-all rounded-md bg-muted px-2 py-2 font-mono text-xs">
            {newSecret}
          </code>
          <p className="mt-2 text-muted-foreground">
            Header: <span className="font-mono text-foreground">Authorization: Bearer …</span>
          </p>
          <Button type="button" variant="outline" size="sm" className="mt-3" onClick={() => setNewSecret(null)}>
            Verstanden, ausblenden
          </Button>
        </div>
      ) : null}

      {error ? (
        <p className="rounded-md border border-destructive/40 bg-destructive/5 px-3 py-2 text-sm text-destructive">
          {error}
        </p>
      ) : null}

      <section className="rounded-xl border border-border bg-card p-5 shadow-sm">
        <h2 className="mb-3 text-lg font-semibold">Aktive Keys</h2>
        {loading ? (
          <p className="flex items-center gap-2 text-sm text-muted-foreground">
            <Loader2 className="size-4 animate-spin" />
            Lade…
          </p>
        ) : keys.length === 0 ? (
          <p className="text-sm text-muted-foreground">Noch keine API-Keys.</p>
        ) : (
          <ul className="divide-y divide-border">
            {keys.map((k) => (
              <li key={k.id} className="flex flex-col gap-2 py-4 first:pt-0 sm:flex-row sm:items-center">
                <div className="min-w-0 flex-1">
                  <p className="font-medium">{k.name}</p>
                  <p className="font-mono text-xs text-muted-foreground">
                    {k.keyPrefix || "—"}
                  </p>
                  <p className="mt-1 text-xs text-muted-foreground">
                    Erstellt: {new Date(k.createdAt).toLocaleString()}
                    {k.lastUsedAt
                      ? ` · Zuletzt: ${new Date(k.lastUsedAt).toLocaleString()}`
                      : " · Noch nicht verwendet"}
                  </p>
                </div>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  className="shrink-0 text-destructive hover:bg-destructive/10"
                  disabled={deletingId === k.id}
                  onClick={() => void handleRevoke(k.id)}
                >
                  {deletingId === k.id ? (
                    <Loader2 className="size-4 animate-spin" />
                  ) : (
                    <>
                      <Trash2 className="mr-2 size-4" />
                      Widerrufen
                    </>
                  )}
                </Button>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
