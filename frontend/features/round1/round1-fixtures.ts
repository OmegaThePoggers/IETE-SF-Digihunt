import type { Round1ViewModel } from "./round1-types";

const baseClues = [
  {
    id: "rq-1",
    category: "binary",
    difficulty: "easy",
    questionText: "Decode the opening byte.",
    options: ["01001000", "01001001", "01001110", "01010100"],
    status: "claimed" as const,
    claimedByName: "Asha",
    codeFragment: null,
  },
  {
    id: "rq-2",
    category: "morse",
    difficulty: "medium",
    questionText: "Which signal means access?",
    options: [".-", "-...", "-.-.", "--."],
    status: "available" as const,
    claimedByName: null,
    codeFragment: null,
  },
  {
    id: "rq-3",
    category: "logic",
    difficulty: "hard",
    questionText: "Finish the route pattern.",
    options: ["north", "east", "south", "west"],
    status: "available" as const,
    claimedByName: null,
    codeFragment: null,
  },
];

export const loadingRound1Fixture: Round1ViewModel = {
  state: "loading",
  meName: null,
  clues: [],
  currentIndex: -1,
  selectedAnswer: "",
  nextGateRound: null,
  feedback: null,
  busy: false,
};

export const availableRound1Fixture: Round1ViewModel = {
  state: "available",
  meName: "Asha",
  clues: baseClues.map((clue, index) => index === 0 ? { ...clue, status: "available", claimedByName: null } : clue),
  currentIndex: 0,
  selectedAnswer: "",
  nextGateRound: null,
  feedback: { tone: "neutral", message: "Establishing clue ownership..." },
  busy: true,
};

export const claimedRound1Fixture: Round1ViewModel = {
  state: "answering",
  meName: "Asha",
  clues: baseClues,
  currentIndex: 0,
  selectedAnswer: "",
  nextGateRound: null,
  feedback: null,
  busy: false,
};

export const incorrectRound1Fixture: Round1ViewModel = {
  ...claimedRound1Fixture,
  state: "incorrect",
  feedback: { tone: "error", message: "ACCESS DENIED — Incorrect response. Try again." },
};

export const completeRound1Fixture: Round1ViewModel = {
  state: "complete",
  meName: "Asha",
  clues: baseClues.map((clue, index) => ({
    ...clue,
    status: "solved",
    claimedByName: index === 1 ? "Dev" : "Asha",
    codeFragment: ["DIGI", "HUNT", "2026"][index],
  })),
  currentIndex: 3,
  selectedAnswer: "",
  nextGateRound: 2,
  feedback: { tone: "success", message: "ACCESS GRANTED — all fragments recovered." },
  busy: false,
};

export const lockedRound1Fixture: Round1ViewModel = {
  ...loadingRound1Fixture,
  state: "locked",
  feedback: { tone: "error", message: "Round 1 is locked for your team." },
};

export const teammateClaimedRound1Fixture: Round1ViewModel = {
  ...claimedRound1Fixture,
  state: "teammate-claimed",
  meName: "Dev",
  selectedAnswer: "",
  feedback: { tone: "neutral", message: "Being solved by Asha..." },
};
