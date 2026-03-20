import { Code2 } from "lucide-react";

import ApiKeysManager from "@/components/dashboard/ApiKeysManager";

export const dynamic = "force-dynamic";

export default function DeveloperPage() {
  return (
    <div className="mx-auto w-full max-w-3xl">
      <div className="mb-6 flex items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Entwickler</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            API-Keys für programmatischen Zugriff (z.&nbsp;B.{" "}
            <span className="font-mono">POST /api/qrcodes</span> mit{" "}
            <span className="font-mono">Authorization: Bearer</span>).
          </p>
        </div>
        <Code2 className="mt-1 size-5 text-muted-foreground" />
      </div>
      <ApiKeysManager />
    </div>
  );
}
