"use client";

import { useState } from "react";

import { RegisterForm, type RegistrationPayload } from "@/components/auth/register-form";
import { AccessShell } from "@/components/event/access-shell";
import { EventPanel } from "@/components/event/event-panel";
import { Button } from "@/components/ui/button";
import { ApiError, registerTeam } from "@/lib/api";

export default function RegisterPage() {
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [teamCode, setTeamCode] = useState<string | null>(null);

  async function handleRegister(payload: RegistrationPayload) {
    setError(null);
    setSubmitting(true);
    try {
      const result = await registerTeam(payload);
      setTeamCode(result.team_code);
    } catch (caught) {
      setError(caught instanceof ApiError ? caught.message : "Registration failed.");
    } finally {
      setSubmitting(false);
    }
  }

  if (teamCode) {
    return (
      <AccessShell mode="register" workspaceLabel="Team registration result">
        <p className="font-mono-data text-xs uppercase tracking-[0.24em] text-primary">04 // Signal acquired</p>
        <h1 className="mt-4 text-4xl font-black uppercase leading-none tracking-[-0.04em] sm:text-6xl">Team created.</h1>
        <EventPanel variant="emphasis" className="mt-10">
          <p className="font-mono-data text-xs uppercase tracking-[0.18em] text-muted-foreground">Team code // Keep secure</p>
          <p className="glow-lime my-6 font-mono-data text-4xl font-black tracking-[0.16em] text-primary sm:text-6xl">{teamCode}</p>
          <Button size="lg" className="font-mono-data" render={<a href="/login" />} nativeButton={false}>Go to login</Button>
        </EventPanel>
      </AccessShell>
    );
  }

  return (
    <AccessShell mode="register" workspaceLabel="Team registration workspace">
      <p className="font-mono-data text-xs uppercase tracking-[0.24em] text-primary">02 // Team registration</p>
      <h1 className="mt-4 text-4xl font-black uppercase leading-none tracking-[-0.04em] sm:text-6xl">Build your unit.</h1>
      <p className="mb-8 mt-4 max-w-xl text-sm leading-6 text-muted-foreground">Exactly three members enter the hunt. Each competitor logs in with their own email under one shared team password.</p>
      <RegisterForm error={error} submitting={submitting} onSubmit={handleRegister} onValidationError={setError} />
      <p className="mt-6 font-mono-data text-xs text-muted-foreground">Already registered? <a href="/login" className="text-primary underline-offset-4 hover:underline">Return to login</a></p>
    </AccessShell>
  );
}
