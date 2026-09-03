export type GateState = "loading" | "locked" | "ready" | "submitting" | "rejected" | "unlocked";

export type GateViewModel = {
  state: GateState;
  roundNumber: number;
  sourceRound: number;
  scrambledKey: string | null;
  hint: string | null;
  wordLengths: number[];
  answer: string;
  attempts: number;
  message: string | null;
};
