import type { GateViewModel } from "./gate-types";

export const lockedGateFixture: GateViewModel = {
  state: "locked",
  roundNumber: 2,
  sourceRound: 1,
  hint: null,
  wordLengths: [],
  answer: "",
  attempts: 0,
  message: null,
};

export const readyGateFixture: GateViewModel = {
  ...lockedGateFixture,
  state: "ready",
  answer: "DIGI-AB-7Z-4Q",
};

export const rejectedGateFixture: GateViewModel = {
  ...readyGateFixture,
  state: "rejected",
  attempts: 1,
  message: "KEY REJECTED — the letters do not match",
};

export const unlockedGateFixture: GateViewModel = {
  ...readyGateFixture,
  state: "unlocked",
  message: "KEY ACCEPTED — Round 2 unlocked",
};
