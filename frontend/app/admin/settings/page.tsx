"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  getAdminSettings,
  getStoredToken,
  putAdminSetting,
  redirectOnAdminError,
  type EventSetting,
} from "@/lib/api";

const inputClass =
  "w-full rounded-md border border-border bg-input px-3 py-2 text-sm text-foreground font-mono-data outline-none focus:ring-2 focus:ring-ring";

export default function AdminSettingsPage() {
  const router = useRouter();
  const [settings, setSettings] = useState<EventSetting[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  const [newKey, setNewKey] = useState("");
  const [newValue, setNewValue] = useState("");
  const [savingSetting, setSavingSetting] = useState(false);

  function load() {
    getAdminSettings()
      .then(setSettings)
      .catch((err) => {
        const msg = redirectOnAdminError(err, router);
        if (msg) setError(msg);
      });
  }

  useEffect(() => {
    if (!getStoredToken()) {
      router.replace("/login");
      return;
    }
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [router]);

  async function handleSaveSetting(e: React.FormEvent) {
    e.preventDefault();
    if (!newKey.trim()) return;
    setSavingSetting(true);
    try {
      await putAdminSetting(newKey.trim(), newValue);
      setNewKey("");
      setNewValue("");
      load();
    } catch (err) {
      const msg = redirectOnAdminError(err, router);
      if (msg) setError(msg);
    } finally {
      setSavingSetting(false);
    }
  }

  if (error) {
    return (
      <p className="rounded-md border border-destructive/40 bg-destructive/10 px-4 py-3 font-mono-data text-sm text-destructive">
        {error}
      </p>
    );
  }

  if (!settings) {
    return (
      <p className="font-mono-data text-sm text-muted-foreground">LOADING SETTINGS...</p>
    );
  }

  return (
    <div className="flex flex-col gap-8">
      <h1 className="glow-cyan font-mono-data text-2xl font-bold text-primary">
        EVENT SETTINGS
      </h1>

      <section className="space-y-4">
        <h2 className="font-mono-data text-sm tracking-widest text-secondary">
          KEY / VALUE SETTINGS
        </h2>
        {settings.length === 0 ? (
          <p className="font-mono-data text-sm text-muted-foreground">
            No settings configured yet. Known keys: round4_deadline (ISO datetime),
            question_claim_timeout_minutes (integer).
          </p>
        ) : (
          <div className="grid gap-2">
            {settings.map((s) => (
              <Card key={s.key}>
                <CardContent className="flex flex-wrap items-center justify-between gap-2 py-3">
                  <div>
                    <p className="font-mono-data text-sm text-secondary">{s.key}</p>
                    <p className="font-mono-data text-sm text-foreground">{s.value}</p>
                  </div>
                  <p className="font-mono-data text-xs text-muted-foreground">
                    Updated {new Date(s.updated_at).toLocaleString()}
                  </p>
                </CardContent>
              </Card>
            ))}
          </div>
        )}

        <Card className="glow-border">
          <CardHeader>
            <CardTitle className="font-mono-data text-sm text-secondary">
              ADD / UPDATE A SETTING
            </CardTitle>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleSaveSetting} className="grid gap-3 sm:grid-cols-[1fr_1fr_auto]">
              <div className="space-y-2">
                <label htmlFor="setting-key" className="sr-only">
                  Setting key
                </label>
                <input
                  id="setting-key"
                  className={inputClass}
                  placeholder="key (e.g. round4_deadline)"
                  value={newKey}
                  onChange={(e) => setNewKey(e.target.value)}
                  required
                />
              </div>
              <div className="space-y-2">
                <label htmlFor="setting-value" className="sr-only">
                  Setting value
                </label>
                <input
                  id="setting-value"
                  className={inputClass}
                  placeholder="value"
                  value={newValue}
                  onChange={(e) => setNewValue(e.target.value)}
                  required
                />
              </div>
              <Button type="submit" className="font-mono-data" disabled={savingSetting}>
                {savingSetting ? "SAVING..." : "SAVE"}
              </Button>
            </form>
          </CardContent>
        </Card>
      </section>
    </div>
  );
}
