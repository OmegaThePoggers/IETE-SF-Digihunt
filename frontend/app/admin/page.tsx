"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import {
  getAdminDashboard,
  getStoredToken,
  redirectOnAdminError,
  type DashboardOut,
} from "@/lib/api";

function HeroStat({
  label,
  value,
  total,
  caption,
}: {
  label: string;
  value: number;
  total: number;
  caption: string;
}) {
  return (
    <div
      className="glow-border border border-primary p-6"
      style={{ background: "linear-gradient(160deg, oklch(0.92 0.29 128 / 6%), transparent 60%)" }}
    >
      <p className="mb-2 font-mono-data text-[10px] tracking-widest text-muted-foreground uppercase">
        {label}
      </p>
      <p className="glow-lime font-heading text-5xl font-bold leading-none text-primary">
        {value}
        <span className="text-2xl text-muted-foreground">/{total}</span>
      </p>
      <p className="mt-2.5 font-mono-data text-[11px] text-muted-foreground">{caption}</p>
    </div>
  );
}

function SecondaryStat({
  label,
  value,
  caption,
}: {
  label: string;
  value: number;
  caption: string;
}) {
  return (
    <div className="border border-border p-6">
      <p className="mb-2 font-mono-data text-[10px] tracking-widest text-muted-foreground uppercase">
        {label}
      </p>
      <p className="font-heading text-3xl font-bold leading-none text-foreground">{value}</p>
      <p className="mt-2.5 font-mono-data text-[11px] text-muted-foreground">{caption}</p>
    </div>
  );
}

function MinorStat({ label, value }: { label: string; value: number }) {
  return (
    <div className="border border-border p-4">
      <p className="mb-1.5 font-mono-data text-[9px] tracking-widest text-muted-foreground uppercase">
        {label}
      </p>
      <p className="font-heading text-xl font-bold leading-none text-foreground/80">{value}</p>
    </div>
  );
}

export default function AdminDashboardPage() {
  const router = useRouter();
  const [data, setData] = useState<DashboardOut | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!getStoredToken()) {
      router.replace("/login");
      return;
    }
    getAdminDashboard()
      .then(setData)
      .catch((err) => {
        const msg = redirectOnAdminError(err, router);
        if (msg) setError(msg);
      });
  }, [router]);

  if (error) {
    return (
      <p className="border border-destructive/40 bg-destructive/10 px-4 py-3 font-mono-data text-sm text-destructive">
        {error}
      </p>
    );
  }

  if (!data) {
    return (
      <p className="font-mono-data text-sm text-muted-foreground">
        LOADING EVENT DATA...
      </p>
    );
  }

  const notSubmitted = data.registered_teams - data.submitted_count;

  return (
    <div className="flex flex-col gap-8">
      <h1 className="glow-cyan font-mono-data text-2xl font-bold text-primary">
        EVENT DASHBOARD
      </h1>

      {/* hero + secondary — the two numbers an organizer actually watches live */}
      <div className="grid gap-4 sm:grid-cols-[1.6fr_1fr]">
        <HeroStat
          label="Submissions received"
          value={data.submitted_count}
          total={data.registered_teams}
          caption={
            notSubmitted > 0
              ? `${notSubmitted} team${notSubmitted === 1 ? "" : "s"} have not submitted yet`
              : "All registered teams have submitted"
          }
        />
        <SecondaryStat
          label="Active teams"
          value={data.active_teams}
          caption={`of ${data.registered_teams} registered`}
        />
      </div>

      {/* minor — round-touched counts, lowest visual weight */}
      <div>
        <p className="mb-3 font-mono-data text-[10px] tracking-widest text-muted-foreground uppercase">
          Round engagement
        </p>
        <div className="grid gap-4 sm:grid-cols-3">
          <MinorStat label="Round 1 touched" value={data.round1_count} />
          <MinorStat label="Round 2 touched" value={data.round2_count} />
          <MinorStat label="Round 3 touched" value={data.round3_count} />
        </div>
      </div>
    </div>
  );
}
