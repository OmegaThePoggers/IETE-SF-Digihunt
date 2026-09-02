"use client";

import { useState } from "react";

import { EventPanel } from "@/components/event/event-panel";
import { SectionMarker } from "@/components/event/section-marker";
import { Button } from "@/components/ui/button";
import type { MemberIn } from "@/lib/api";

type RegistrationPayload = { team_name: string; team_password: string; members: MemberIn[] };
type RegisterFormProps = {
  error: string | null;
  submitting: boolean;
  onSubmit: (payload: RegistrationPayload) => void | Promise<void>;
  onValidationError: (message: string) => void;
};

const EMPTY_MEMBER = { name: "", email: "" };
const inputClass = "focus-ring w-full border border-border bg-input px-3 py-3 font-mono-data text-sm text-foreground outline-none placeholder:text-muted-foreground/60";

function RegisterForm({ error, submitting, onSubmit, onValidationError }: RegisterFormProps) {
  const [teamName, setTeamName] = useState("");
  const [teamPassword, setTeamPassword] = useState("");
  const [teamSize, setTeamSize] = useState(3);
  const [members, setMembers] = useState<MemberIn[]>([
    { ...EMPTY_MEMBER }, { ...EMPTY_MEMBER }, { ...EMPTY_MEMBER },
  ]);

  function selectTeamSize(size: number) {
    setTeamSize(size);
    setMembers((current) => Array.from(
      { length: size },
      (_, index) => current[index] ?? { ...EMPTY_MEMBER },
    ));
  }

  function updateMember(index: number, field: keyof MemberIn, value: string) {
    setMembers((current) => current.map((member, memberIndex) => memberIndex === index ? { ...member, [field]: value } : member));
  }

  function validate() {
    if (!teamName.trim()) return "Team name is required.";
    if (!teamPassword) return "Team password is required.";
    if (teamPassword.length < 8) return "Team password must be at least 8 characters.";
    const emails = members.map((member) => member.email.trim().toLowerCase());
    if (members.some((member) => !member.name.trim() || !member.email.trim())) return `All ${teamSize} participant${teamSize === 1 ? "" : "s"} need a name and email.`;
    if (new Set(emails).size !== emails.length) return "Member emails must be unique.";
    return null;
  }

  function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const validationError = validate();
    if (validationError) {
      onValidationError(validationError);
      return;
    }
    void onSubmit({ team_name: teamName.trim(), team_password: teamPassword, members });
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-5" noValidate>
      <div className="space-y-2">
        <label htmlFor="team-name" className="font-mono-data text-xs uppercase tracking-[0.18em] text-muted-foreground">Team name</label>
        <input id="team-name" className={inputClass} value={teamName} onChange={(event) => setTeamName(event.target.value)} autoComplete="organization" placeholder="e.g. Null Pointers" />
      </div>

      <div className="space-y-2">
        <label htmlFor="team-password" className="font-mono-data text-xs uppercase tracking-[0.18em] text-muted-foreground">Team password</label>
        <input id="team-password" className={inputClass} type="password" value={teamPassword} onChange={(event) => setTeamPassword(event.target.value)} autoComplete="new-password" placeholder="One shared 8+ character team password" />
        <p className="text-xs leading-5 text-muted-foreground">Every member logs in with their own email and this shared team password.</p>
      </div>

      <fieldset>
        <legend className="font-mono-data mb-3 text-xs uppercase tracking-[0.18em] text-muted-foreground">Number of participants</legend>
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-4" role="radiogroup" aria-label="Number of participants">
          {[1, 2, 3, 4].map((size) => {
            const label = `${size} participant${size === 1 ? "" : "s"}`;
            return <label key={size} className={`cursor-pointer border px-4 py-3 text-center font-mono-data text-sm font-bold uppercase transition-colors ${teamSize === size ? "border-primary bg-primary text-primary-foreground" : "border-border text-muted-foreground hover:border-secondary hover:text-foreground"}`}>
              <input className="sr-only" type="radio" name="team-size" value={size} checked={teamSize === size} onChange={() => selectTeamSize(size)} />
              {label}
            </label>;
          })}
        </div>
        <p className="mt-2 text-xs text-muted-foreground">Choose from 1 to 4 participants. You can change this before registering.</p>
      </fieldset>

      <section aria-label="Participant roster">
        <SectionMarker index="03" label="Team roster" headingLevel={2} />
        <EventPanel className="overflow-hidden p-0" variant="muted">
          <div className="flex items-center justify-between gap-4 border-b border-border bg-background/60 px-4 py-3 sm:px-5">
            <p className="font-mono-data text-xs font-bold uppercase tracking-[0.16em] text-foreground">Participant details</p>
            <span className="font-mono-data text-xs text-primary">{teamSize} selected</span>
          </div>
          {members.map((member, index) => (
            <div key={index} role="group" aria-label={`Participant ${index + 1}`} className="grid grid-cols-[2.25rem_minmax(0,1fr)] gap-x-3 gap-y-3 border-b border-border px-4 py-4 last:border-b-0 sm:grid-cols-[2.5rem_minmax(0,1fr)_minmax(0,1fr)] sm:items-end sm:gap-x-5 sm:px-5">
              <span className="mt-6 grid size-9 place-items-center border border-primary/40 bg-primary/10 font-mono-data text-xs font-bold text-primary sm:mt-0">
                {String(index + 1).padStart(2, "0")}
              </span>
              <div className="grid min-w-0 gap-3 sm:col-span-2 sm:grid-cols-2 sm:gap-5">
                {(["name", "email"] as const).map((field) => {
                  const label = `Member ${index + 1} ${field}`;
                  return <div key={field} className="min-w-0 space-y-1.5">
                    <label htmlFor={`member-${index}-${field}`} className="font-mono-data text-[0.65rem] uppercase tracking-[0.14em] text-muted-foreground">{field === "name" ? "Full name" : "Email address"}</label>
                    <input id={`member-${index}-${field}`} className={inputClass} type={field === "email" ? "email" : "text"} value={member[field]} onChange={(event) => updateMember(index, field, event.target.value)} autoComplete={field} aria-label={label} />
                  </div>;
                })}
              </div>
            </div>
          ))}
        </EventPanel>
      </section>

      {error ? <p role="alert" className="border-l-2 border-destructive bg-destructive/[0.07] px-4 py-3 font-mono-data text-sm text-destructive">{error}</p> : null}
      <Button type="submit" size="lg" className="w-full font-mono-data" disabled={submitting}>{submitting ? "Registering team" : "Register team"}</Button>
    </form>
  );
}

export { RegisterForm, type RegistrationPayload, type RegisterFormProps };
