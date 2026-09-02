"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";

// The Master Terminal was replaced by per-round cipher gates
// (see /gate/[round]). Any bookmarked /master link lands here and is sent
// somewhere sensible instead of 404ing.
export default function MasterPageRedirect() {
  const router = useRouter();

  useEffect(() => {
    router.replace("/dashboard");
  }, [router]);

  return (
    <main className="grid min-h-screen place-items-center bg-background">
      <p className="font-mono-data text-sm text-muted-foreground">Redirecting to mission control...</p>
    </main>
  );
}
