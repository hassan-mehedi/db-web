"use client";

import { useRouter } from "next/navigation";
import { type FormEvent, useState } from "react";
import { beginSetup, type SetupResponse } from "@/app/actions/setup";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { authClient } from "@/lib/auth-client";

export function SetupForm() {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [enrolled, setEnrolled] = useState<Extract<SetupResponse, { ok: true }> | null>(null);

  async function onCreate(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    const form = new FormData(e.currentTarget);
    const res = await beginSetup(String(form.get("email")), String(form.get("password")));
    setBusy(false);
    if (res.ok) setEnrolled(res);
    else setError(res.error);
  }

  async function onVerify(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    const code = String(new FormData(e.currentTarget).get("code"));
    const { error } = await authClient.twoFactor.verifyTotp({ code });
    setBusy(false);
    if (error) setError(error.message ?? "invalid code");
    else router.push("/projects");
  }

  return (
    <main className="flex min-h-screen items-center justify-center p-6">
      <Card className="w-full max-w-md">
        <CardHeader>
          <CardTitle>{enrolled ? "Set up two-factor" : "Create the admin user"}</CardTitle>
        </CardHeader>
        <CardContent>
          {!enrolled ? (
            <form onSubmit={onCreate} className="grid gap-4">
              <p className="text-sm text-muted-foreground">
                This is the only account. Two-factor with an authenticator app is required.
              </p>
              <div className="grid gap-2">
                <Label htmlFor="email">Email</Label>
                <Input id="email" name="email" type="email" autoComplete="username" required />
              </div>
              <div className="grid gap-2">
                <Label htmlFor="password">Password (min 8)</Label>
                <Input
                  id="password"
                  name="password"
                  type="password"
                  autoComplete="new-password"
                  minLength={8}
                  required
                />
              </div>
              {error && <p className="text-sm text-destructive">{error}</p>}
              <Button type="submit" disabled={busy}>
                Continue
              </Button>
            </form>
          ) : (
            <form onSubmit={onVerify} className="grid gap-4">
              <div className="grid gap-2 sm:grid-cols-[220px_1fr]">
                {/* biome-ignore lint/performance/noImgElement: data URL, nothing to optimise */}
                <img src={enrolled.qr} alt="TOTP QR code" width={220} height={220} />
                <div className="grid content-start gap-2 text-sm">
                  <p>Scan with your authenticator app, or paste the URI.</p>
                  <code className="break-all rounded bg-muted p-2 text-xs">{enrolled.totpURI}</code>
                </div>
              </div>
              <div className="grid gap-1">
                <p className="text-sm">Backup codes. Store them offline, they are shown once.</p>
                <pre className="rounded bg-muted p-2 font-mono text-xs">
                  {enrolled.backupCodes.join("\n")}
                </pre>
              </div>
              <div className="grid gap-2">
                <Label htmlFor="code">Code from your authenticator</Label>
                <Input
                  id="code"
                  name="code"
                  inputMode="numeric"
                  autoComplete="one-time-code"
                  pattern="[0-9]{6}"
                  required
                  autoFocus
                />
              </div>
              {error && <p className="text-sm text-destructive">{error}</p>}
              <Button type="submit" disabled={busy}>
                Verify and finish
              </Button>
            </form>
          )}
        </CardContent>
      </Card>
    </main>
  );
}
