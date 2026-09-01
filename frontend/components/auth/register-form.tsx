"use client";

import { useState } from "react";

import { EventPanel } from "@/components/event/event-panel";
import { SectionMarker } from "@/components/event/section-marker";
import { Button } from "@/components/ui/button";
import type { MemberIn } from "@/lib/api";

type RegistrationPayload = { team_name: string; members: MemberIn[] };
type RegisterFormProps = {
  error: string | null;
  submitting: boolean;
  onSubmit: (payload: RegistrationPayload) => void | Promise<void>;
  onValidationError: (message: string) => void;
};

const EMPTY_MEMBER = { name: "", email: "", password: "" };
const inputClass = "focus-ring w-full border border-border bg-input px-3 py-3 font-mono-data text-sm text-foreground outline-none placeholder:text-muted-foreground/60";

function RegisterForm({ error, submitting, onSubmit, onValidationError }: RegisterFormProps) {
  const [teamName, setTeamName] = useState("");
  const [members, setMembers] = useState<MemberIn[]>([
    { ...EMPTY_MEMBER }, { ...EMPTY_MEMBER }, { ...EMPTY_MEMBER },
  ]);

  function updateMember(index: number, field: keyof MemberIn, value: string) {
    setMembers((current) => current.map((member, memberIndex) => memberIndex === index ? { ...member, [field]: value } : member));
  }

  function validate() {
    if (!teamName.trim()) return "Team name is required.";
    const emails = members.map((member) => member.email.trim().toLowerCase());
    if (members.some((member) => !member.name.trim() || !member.email.trim() || !member.password)) return "All 3 members need a name, email, and password.";
    if (members.some((member) => member.password.length < 8)) return "Passwords must be at least 8 characters.";
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
    void onSubmit({ team_name: teamName.trim(), members });
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-5" noValidate>
      <div className="space-y-2">
        <label htmlFor="team-name" className="font-mono-data text-xs uppercase tracking-[0.18em] text-muted-foreground">Team name</label>
        <input id="team-name" className={inputClass} value={teamName} onChange={(event) => setTeamName(event.target.value)} autoComplete="organization" placeholder="e.g. Null Pointers" />
      </div>

      <div>
        <SectionMarker index="03" label="Team roster" headingLevel={2} />
        <div className="grid gap-px bg-border md:grid-cols-3">
          {members.map((member, index) => (
            <EventPanel key={index} className="border-0 bg-card p-4 sm:p-5">
              <h3 className="font-mono-data mb-5 text-xs font-bold uppercase tracking-[0.2em] text-primary">Member {index + 1}</h3>
              <div className="space-y-4">
                {(["name", "email", "password"] as const).map((field) => {
                  const label = `Member ${index + 1} ${field}`;
                  return (
                    <div key={field} className="space-y-1.5">
                      <label htmlFor={`member-${index}-${field}`} className="font-mono-data text-[0.65rem] uppercase tracking-[0.14em] text-muted-foreground">{label}</label>
                      <input id={`member-${index}-${field}`} className={inputClass} type={field === "password" ? "password" : field === "email" ? "email" : "text"} value={member[field]} onChange={(event) => updateMember(index, field, event.target.value)} autoComplete={field === "password" ? "new-password" : field} placeholder={field === "password" ? "8+ characters" : undefined} />
                    </div>
                  );
                })}
              </div>
            </EventPanel>
          ))}
        </div>
      </div>

      {error ? <p role="alert" className="border-l-2 border-destructive bg-destructive/[0.07] px-4 py-3 font-mono-data text-sm text-destructive">{error}</p> : null}
      <Button type="submit" size="lg" className="w-full font-mono-data" disabled={submitting}>{submitting ? "Registering team" : "Register team"}</Button>
    </form>
  );
}

export { RegisterForm, type RegistrationPayload, type RegisterFormProps };
