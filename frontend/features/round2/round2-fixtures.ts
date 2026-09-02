import type { Round2ViewModel } from "./round2-types";

const evidence = {
  serverLog: Array.from({ length: 18 }, (_, index) => ({
    time: `10:${String(index + 10).padStart(2, "0")}:44`,
    event: index === 2 ? "Auth gateway accepted stale token for admin panel." : `Packet trace checkpoint ${index + 1} normalized.`,
  })),
  suspiciousEmail: {
    from: "ops-alert@initech.invalid",
    subject: "Immediate patch approval required",
    body: "The attached hotfix bypasses normal review. Apply before the audit window closes.",
  },
  userActivity: "User activity: privileged session opened minutes after the message was read.",
  codeSnippet: "if (token.valid || token.age < MAX_AGE) {\n  grantAdmin();\n}",
  timeline: "09:55 alert received → 10:12 stale token accepted → 10:20 records exported.",
};

const questions = [
  { id: "q-who", category: "who", label: "WHO", difficulty: "medium", questionText: "Who is most likely behind the breach?", options: ["External botnet", "Malicious insider", "Lost device", "Vendor outage"], status: "available" as const, claimedByName: null, selectedAnswer: "", busy: false, feedback: null },
  { id: "q-what", category: "what", label: "WHAT", difficulty: "hard", questionText: "What attack path matches the evidence?", options: ["SQL injection", "Stale token replay", "DNS poisoning", "Credential stuffing"], status: "claimed" as const, claimedByName: "Asha", selectedAnswer: "", busy: false, feedback: null },
  { id: "q-when", category: "when", label: "WHEN", difficulty: "easy", questionText: "When did the incident begin?", options: ["09:55", "10:12", "10:20", "11:45"], status: "solved" as const, claimedByName: "Asha", selectedAnswer: "09:55", busy: false, feedback: { correct: true, message: "Timeline anchored." } },
];

export const loadingRound2Fixture: Round2ViewModel = { state: "loading", meName: null, evidence: null, activeEvidenceId: "log", questions: [], summary: null, error: null };
export const lockedRound2Fixture: Round2ViewModel = { ...loadingRound2Fixture, state: "locked" };
export const investigatingRound2Fixture: Round2ViewModel = { state: "investigating", meName: "Asha", evidence, activeEvidenceId: "log", questions, summary: null, error: null };
export const teammateClaimedRound2Fixture: Round2ViewModel = { ...investigatingRound2Fixture, state: "teammate-claimed", questions: questions.map((q) => q.id === "q-who" ? { ...q, status: "claimed", claimedByName: "Priya" } : q) };
export const incorrectRound2Fixture: Round2ViewModel = { ...investigatingRound2Fixture, state: "incorrect", questions: questions.map((q) => q.id === "q-what" ? { ...q, selectedAnswer: "SQL injection", feedback: { correct: false, message: "Incorrect response. Try again." } } : q) };
export const completeRound2Fixture: Round2ViewModel = { ...investigatingRound2Fixture, state: "complete", questions: questions.map((q) => ({ ...q, status: "solved" })), summary: { who: "Malicious insider", what: "Stale token replay", when: "09:55", how: "Review bypass email", why: "Privilege escalation" } };
export const awaitingReviewRound2Fixture: Round2ViewModel = { ...completeRound2Fixture, state: "awaiting-review" };
