"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

import { LoginForm, type LoginCredentials } from "@/components/auth/login-form";
import { AccessShell } from "@/components/event/access-shell";
import { ApiError, login } from "@/lib/api";

export default function LoginPage() {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  async function handleLogin({ email, password }: LoginCredentials) {
    setError(null);
    setSubmitting(true);
    try {
      const result = await login(email, password);
      if (result.role === "admin") router.push("/admin");
      else if (result.role === "judge") router.push("/judge");
      else router.push("/dashboard");
    } catch (caught) {
      if (caught instanceof ApiError && caught.status === 401) setError("Access denied. Invalid email or password.");
      else setError(caught instanceof ApiError ? caught.message : "Login failed.");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <AccessShell mode="login" workspaceLabel="Team access workspace">
      <p className="font-mono-data text-xs uppercase tracking-[0.24em] text-primary">01 // Team access</p>
      <h1 className="mt-4 text-4xl font-black uppercase leading-none tracking-[-0.04em] sm:text-6xl">Return to the hunt.</h1>
      <p className="mb-10 mt-4 max-w-xl text-sm leading-6 text-muted-foreground">Authenticate with your individual team credentials. Your role determines the control surface ahead.</p>
      <LoginForm error={error} submitting={submitting} onSubmit={handleLogin} />
      <p className="mt-6 font-mono-data text-xs text-muted-foreground">No team signal? <a href="/register" className="text-primary underline-offset-4 hover:underline">Register a team</a></p>
    </AccessShell>
  );
}
