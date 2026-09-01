"use client";

import { useState } from "react";

import { Button } from "@/components/ui/button";

type LoginCredentials = { email: string; password: string };

type LoginFormProps = {
  error: string | null;
  submitting: boolean;
  onSubmit: (credentials: LoginCredentials) => void | Promise<void>;
};

const inputClass =
  "focus-ring w-full border border-border bg-input px-4 py-3 font-mono-data text-sm text-foreground outline-none placeholder:text-muted-foreground/60";

function LoginForm({ error, submitting, onSubmit }: LoginFormProps) {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");

  function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    void onSubmit({ email: email.trim(), password });
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      <div className="space-y-2">
        <label htmlFor="login-email" className="font-mono-data text-xs uppercase tracking-[0.18em] text-muted-foreground">
          Email address
        </label>
        <input id="login-email" className={inputClass} type="email" value={email} onChange={(event) => setEmail(event.target.value)} autoComplete="email" required />
      </div>
      <div className="space-y-2">
        <label htmlFor="login-password" className="font-mono-data text-xs uppercase tracking-[0.18em] text-muted-foreground">
          Password
        </label>
        <input id="login-password" className={inputClass} type="password" value={password} onChange={(event) => setPassword(event.target.value)} autoComplete="current-password" required />
      </div>

      {error ? (
        <p role="alert" className="border-l-2 border-destructive bg-destructive/[0.07] px-4 py-3 font-mono-data text-sm text-destructive">
          {error}
        </p>
      ) : null}

      <Button type="submit" size="lg" className="w-full font-mono-data" disabled={submitting}>
        {submitting ? "Authenticating" : "Enter the hunt"}
      </Button>
    </form>
  );
}

export { LoginForm, type LoginCredentials, type LoginFormProps };
