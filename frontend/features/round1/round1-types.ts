export type Round1ClueStatus = "available" | "claimed" | "solved";
export type Round1ViewState = "loading" | "locked" | "available" | "teammate-claimed" | "answering" | "incorrect" | "complete";

export type Round1Clue = {
  id: string;
  category: string;
  difficulty: string;
  questionText: string;
  options: string[];
  status: Round1ClueStatus;
  claimedByName: string | null;
  codeFragment: string | null;
};

export type Round1Feedback = {
  tone: "error" | "success" | "neutral";
  message: string;
};

export type Round1ViewModel = {
  state: Round1ViewState;
  meName: string | null;
  clues: Round1Clue[];
  currentIndex: number;
  selectedAnswer: string;
  nextGateRound: number | null;
  feedback: Round1Feedback | null;
  busy: boolean;
};
