export type Round3ViewState = "locked" | "loading" | "solving" | "teammate-claimed" | "incorrect" | "complete";
export type Round3QuestionStatus = "available" | "claimed" | "solved";

export type Round3Question = {
  id: string;
  category: string;
  label: string;
  difficulty: string;
  questionText: string;
  options: string[];
  status: Round3QuestionStatus;
  claimedByName: string | null;
  selectedAnswer: string;
  busy: boolean;
  codeFragment: string | null;
  feedback: { correct: boolean; message: string } | null;
};

export type Round3ViewModel = {
  state: Round3ViewState;
  meName: string | null;
  questions: Round3Question[];
  error: string | null;
  nextGateRound: number | null;
};
