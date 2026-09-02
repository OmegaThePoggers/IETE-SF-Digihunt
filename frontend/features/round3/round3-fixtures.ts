import type { Round3ViewModel } from "./round3-types";

const questions = [
  {
    id: "r3-q1",
    category: "access_control",
    label: "ACCESS",
    difficulty: "medium",
    questionText: "Which control best limits privilege escalation during the final build?",
    options: ["Shared admin keys", "Least-privilege roles", "Public debug mode", "Plaintext secrets"],
    status: "claimed" as const,
    claimedByName: "Asha",
    selectedAnswer: "",
    busy: false,
    codeFragment: null,
    feedback: null,
  },
  {
    id: "r3-q2",
    category: "secure_coding",
    label: "CODE",
    difficulty: "hard",
    questionText: "What is the safest first response to an untrusted input path?",
    options: ["Validate and normalize it", "Log the raw path only", "Trust the UI", "Disable authentication"],
    status: "available" as const,
    claimedByName: null,
    selectedAnswer: "",
    busy: false,
    codeFragment: null,
    feedback: null,
  },
];

export const activeRound3Fixture: Round3ViewModel = {
  state: "solving",
  meName: "Asha",
  questions,
  error: null,
  nextGateRound: null,
};

export const completeRound3Fixture: Round3ViewModel = {
  state: "complete",
  meName: "Asha",
  questions: questions.map((q, index) => ({ ...q, status: "solved" as const, claimedByName: index === 0 ? "Asha" : "Dev", codeFragment: ["FINAL", "HACK"][index] })),
  error: null,
  nextGateRound: 4,
};

export const lockedRound3Fixture: Round3ViewModel = {
  state: "locked",
  meName: null,
  questions: [],
  error: null,
  nextGateRound: null,
};
