export type Round2ViewState = "locked" | "loading" | "investigating" | "teammate-claimed" | "incorrect" | "complete";
export type Round2EvidenceId = "log" | "email" | "code" | "timeline";
export type Round2QuestionStatus = "available" | "claimed" | "solved";

export type Round2Evidence = {
  serverLog: { time: string; event: string }[];
  suspiciousEmail: { from: string; subject: string; body: string };
  userActivity: string;
  codeSnippet: string;
  timeline: string;
};

export type Round2Question = {
  id: string;
  category: string;
  label: string;
  difficulty: string;
  questionText: string;
  options: string[];
  status: Round2QuestionStatus;
  claimedByName: string | null;
  codeFragment: string | null;
  selectedAnswer: string;
  busy: boolean;
  feedback: { correct: boolean; message: string } | null;
};

export type Round2ViewModel = {
  state: Round2ViewState;
  meName: string | null;
  evidence: Round2Evidence | null;
  activeEvidenceId: Round2EvidenceId;
  questions: Round2Question[];
  summary: Record<string, string> | null;
  error: string | null;
};
