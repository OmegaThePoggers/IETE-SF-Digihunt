const API_URL = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8000";
const TOKEN_KEY = "digihunt_token";

export class ApiError extends Error {
  status: number;
  constructor(status: number, message: string) {
    super(message);
    this.status = status;
  }
}

function getToken(): string | null {
  if (typeof window === "undefined") return null;
  return localStorage.getItem(TOKEN_KEY);
}

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const token = getToken();
  const res = await fetch(`${API_URL}${path}`, {
    ...init,
    headers: {
      "Content-Type": "application/json",
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...init?.headers,
    },
  });

  if (!res.ok) {
    let detail = res.statusText;
    try {
      const body = await res.json();
      if (typeof body.detail === "string") detail = body.detail;
      else if (Array.isArray(body.detail)) {
        // FastAPI/Pydantic 422 validation errors
        detail = body.detail.map((e: { msg: string }) => e.msg).join("; ");
      }
    } catch {
      // ignore non-JSON error body
    }
    throw new ApiError(res.status, detail);
  }

  return res.json() as Promise<T>;
}

export interface MemberIn {
  name: string;
  email: string;
  password: string;
}

export interface RegisterTeamOut {
  team_code: string;
  team_name: string;
  members: { name: string; email: string }[];
}

export function registerTeam(payload: { team_name: string; members: MemberIn[] }) {
  return request<RegisterTeamOut>("/auth/register-team", {
    method: "POST",
    body: JSON.stringify(payload),
  });
}

export interface TokenOut {
  access_token: string;
  token_type: string;
  role: string;
  team_code: string | null;
}

export async function login(email: string, password: string) {
  const result = await request<TokenOut>("/auth/login", {
    method: "POST",
    body: JSON.stringify({ email, password }),
  });
  localStorage.setItem(TOKEN_KEY, result.access_token);
  return result;
}

export interface MeOut {
  id: string;
  name: string;
  email: string;
  role: string;
  team_id: string | null;
  team_code: string | null;
}

export function getMe() {
  return request<MeOut>("/auth/me");
}

export interface RoundProgress {
  solved: number;
  total: number;
  locked: boolean;
}

export interface TeamMeOut {
  team_code: string;
  team_name: string;
  members: { id: string; name: string; is_you: boolean }[];
  rounds: {
    round1: RoundProgress;
    round2: RoundProgress;
    round3: RoundProgress;
    master: { locked: boolean; solved: boolean };
  };
}

export function getTeamMe() {
  return request<TeamMeOut>("/teams/me");
}

export function logout() {
  localStorage.removeItem(TOKEN_KEY);
}

export function getStoredToken(): string | null {
  return getToken();
}

export const TOKEN_STORAGE_KEY = TOKEN_KEY;

export interface QuestionBoardItem {
  team_question_id: string;
  category: string;
  difficulty: string;
  question_text: string;
  options: string[] | null;
  status: "available" | "claimed" | "solved";
  claimed_by_name: string | null;
  code_fragment: string | null;
}

export interface Round1BoardOut {
  questions: QuestionBoardItem[];
  all_complete: boolean;
  access_key: string | null;
}

export function getRound1Board() {
  return request<Round1BoardOut>("/questions/round/1");
}

export interface Round2BoardOut {
  questions: QuestionBoardItem[];
  all_complete: boolean;
  investigation_complete: boolean;
  summary: Record<string, string> | null;
}

export function getRound2Board() {
  return request<Round2BoardOut>("/questions/round/2");
}

export interface IncidentOut {
  server_log: { time: string; event: string }[];
  suspicious_email: { from: string; subject: string; body: string };
  user_activity: string;
  code_snippet: string;
  timeline: string;
}

export function getIncident() {
  return request<IncidentOut>("/incident");
}

export function claimQuestion(teamQuestionId: string) {
  return request<{ status: string; claim_expires_at: string }>(
    `/questions/${teamQuestionId}/claim`,
    { method: "POST" }
  );
}

export function releaseQuestion(teamQuestionId: string) {
  return request<{ status: string }>(`/questions/${teamQuestionId}/release`, {
    method: "POST",
  });
}

export interface AnswerOut {
  correct: boolean;
  message: string;
  code_fragment: string | null;
}

export function answerQuestion(teamQuestionId: string, selectedAnswer: string) {
  return request<AnswerOut>(`/questions/${teamQuestionId}/answer`, {
    method: "POST",
    body: JSON.stringify({ selected_answer: selectedAnswer }),
  });
}

export interface CaseOut {
  case_number: number;
  title: string;
  description: string;
  evidence: Record<string, unknown> | unknown[] | null;
}

export function getCase() {
  return request<CaseOut>("/cases/me");
}

export interface SubmissionOut {
  id: string;
  file_name: string;
  file_size: number;
  mime_type: string;
  version: number;
  is_current: boolean;
  submitted_at: string;
}

// Multipart upload — do NOT set Content-Type manually, the browser sets the
// correct multipart boundary from the FormData object.
export async function uploadSubmission(file: File) {
  const token = getToken();
  const formData = new FormData();
  formData.append("file", file);
  const res = await fetch(`${API_URL}/submissions`, {
    method: "POST",
    headers: token ? { Authorization: `Bearer ${token}` } : undefined,
    body: formData,
  });
  if (!res.ok) {
    let detail = res.statusText;
    try {
      const body = await res.json();
      if (typeof body.detail === "string") detail = body.detail;
    } catch {
      // ignore non-JSON error body
    }
    throw new ApiError(res.status, detail);
  }
  return res.json() as Promise<SubmissionOut>;
}

export function getCurrentSubmission() {
  return request<SubmissionOut>("/submissions/current");
}

export function getSubmissionHistory() {
  return request<SubmissionOut[]>("/submissions/history");
}

// ---- Master Terminal ----------------------------------------------------

export interface MasterStatusOut {
  eligible: boolean;
  solved: boolean;
}

export function getMasterStatus() {
  return request<MasterStatusOut>("/master/status");
}

export interface MasterVerifyOut {
  correct: boolean;
  message: string;
}

export function verifyMasterCode(code: string) {
  return request<MasterVerifyOut>("/master/verify", {
    method: "POST",
    body: JSON.stringify({ code }),
  });
}

// ---- Admin ------------------------------------------------------------

export interface DashboardOut {
  registered_teams: number;
  active_teams: number;
  round1_count: number;
  round2_count: number;
  round3_count: number;
  submitted_count: number;
}

export function getAdminDashboard() {
  return request<DashboardOut>("/admin/dashboard");
}

export interface AdminRoundProgress {
  solved: number;
  total: number;
}

export interface AdminTeamListItem {
  id: string;
  team_code: string;
  team_name: string;
  status: string;
  member_count: number;
  round1: AdminRoundProgress;
  round2: AdminRoundProgress;
  round3_case: string | null;
  submitted: boolean;
}

export function getAdminTeams() {
  return request<AdminTeamListItem[]>("/admin/teams");
}

// Full team detail is a one-off nested admin view (see backend
// app/routers/admin.py get_team_detail) — kept as a loose type rather than
// a fully-modeled interface, matching the backend's plain-dict response.
export interface AdminTeamDetail {
  id: string;
  team_code: string;
  team_name: string;
  status: string;
  members: { id: string; name: string; email: string; last_login: string | null }[];
  questions: {
    team_question_id: string;
    round: number;
    category: string;
    question_text: string;
    status: string;
    solved_by: string | null;
    solved_at: string | null;
    wrong_attempt_count: number;
  }[];
  round2_investigation_summary: Record<string, string> | null;
  case: { case_number: number; title: string; assigned_at: string } | null;
  submission_history: {
    version: number;
    file_name: string;
    uploaded_by: string | null;
    submitted_at: string;
    is_current: boolean;
    submission_id: string;
  }[];
  scores: {
    judge_id: string;
    problem_understanding: number;
    technical_solution: number;
    creativity: number;
    presentation: number;
    feasibility: number;
    total: number;
    comments: string | null;
    finalized: boolean;
    finalized_at: string | null;
  }[];
}

export function getAdminTeamDetail(teamId: string) {
  return request<AdminTeamDetail>(`/admin/teams/${teamId}`);
}

export interface AdminSubmissionListItem {
  team_code: string;
  file_name: string;
  version: number;
  submitted_at: string;
  submission_id: string;
}

export function getAdminSubmissions() {
  return request<AdminSubmissionListItem[]>("/admin/submissions");
}

// Auth is a Bearer header, not a cookie, so a plain <a href> can't carry it —
// fetch the file with the token and trigger a client-side save instead.
export async function downloadAdminSubmission(submissionId: string, fileName: string) {
  const token = getToken();
  const res = await fetch(`${API_URL}/admin/submissions/${submissionId}/download`, {
    headers: token ? { Authorization: `Bearer ${token}` } : undefined,
  });
  if (!res.ok) throw new ApiError(res.status, res.statusText);
  const blob = await res.blob();
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = fileName;
  a.click();
  URL.revokeObjectURL(url);
}

export interface EventSetting {
  key: string;
  value: string;
  updated_at: string;
}

export function getAdminSettings() {
  return request<EventSetting[]>("/admin/settings");
}

export function putAdminSetting(key: string, value: string) {
  return request<EventSetting>(`/admin/settings/${encodeURIComponent(key)}`, {
    method: "PUT",
    body: JSON.stringify({ value }),
  });
}

export function setMasterCode(code: string) {
  return request<{ status: string }>("/admin/master-code", {
    method: "POST",
    body: JSON.stringify({ code }),
  });
}

export function getMasterCodeStatus() {
  return request<{ is_set: boolean }>("/admin/master-code/status");
}

// Shared guard for /admin/* pages: 401 -> logout + back to /login, 403 ->
// not an admin, send to /dashboard. Returns an error message to display for
// anything else, or null when the redirect already handled it.
export function redirectOnAdminError(
  err: unknown,
  router: { replace: (href: string) => void }
): string | null {
  if (err instanceof ApiError) {
    if (err.status === 401) {
      logout();
      router.replace("/login");
      return null;
    }
    if (err.status === 403) {
      router.replace("/dashboard");
      return null;
    }
    return err.message;
  }
  return "Something went wrong.";
}

export function resetTeam(teamId: string) {
  return request<{ status: string; team_id: string }>(`/admin/dev/reset-team/${teamId}`, {
    method: "POST",
  });
}

// ---- Judge --------------------------------------------------------------

export interface AssignedCaseOut {
  title: string;
  case_number: number;
}

export interface AssignedSubmissionOut {
  id: string;
  file_name: string;
  submitted_at: string;
}

export interface MyScoreSummary {
  total: number;
  finalized: boolean;
}

export interface AssignedTeamOut {
  team_id: string;
  team_code: string;
  case: AssignedCaseOut | null;
  submission: AssignedSubmissionOut | null;
  my_score: MyScoreSummary | null;
  round1_complete: boolean;
  round2_approved: boolean;
  round3_submitted: boolean;
}

export function getAssignedTeams() {
  return request<AssignedTeamOut[]>("/judging/assigned");
}

export interface ScoreOut {
  problem_understanding: number;
  technical_solution: number;
  creativity: number;
  presentation: number;
  feasibility: number;
  total: number;
  comments: string | null;
  finalized: boolean;
  finalized_at: string | null;
}

export interface TeamJudgingDetailOut {
  team_id: string;
  team_code: string;
  case: AssignedCaseOut | null;
  submission: AssignedSubmissionOut | null;
  round2_investigation_summary: Record<string, string> | null;
  my_score: ScoreOut | null;
  round2_review: Round2ReviewOut[];
}

export interface Round2ReviewOut {
  team_question_id: string;
  category: string;
  question_text: string;
  submitted_answer: string | null;
  ideal_answer: string;
  judge_approved: boolean | null;
}

export function getJudgeTeamDetail(teamId: string) {
  return request<TeamJudgingDetailOut>(`/judging/teams/${teamId}`);
}

export function reviewRound2Answer(teamId: string, teamQuestionId: string, approved: boolean) {
  return request<Round2ReviewOut>(`/judging/teams/${teamId}/round2/${teamQuestionId}/review`, {
    method: "POST",
    body: JSON.stringify({ approved }),
  });
}

// Same pattern as downloadAdminSubmission — Bearer auth can't ride a plain
// <a href>, so fetch as a blob and trigger a client-side save.
export async function downloadJudgeSubmission(teamId: string, fileName: string) {
  const token = getToken();
  const res = await fetch(`${API_URL}/judging/teams/${teamId}/download`, {
    headers: token ? { Authorization: `Bearer ${token}` } : undefined,
  });
  if (!res.ok) throw new ApiError(res.status, res.statusText);
  const blob = await res.blob();
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = fileName;
  a.click();
  URL.revokeObjectURL(url);
}

export interface ScoreIn {
  problem_understanding: number;
  technical_solution: number;
  creativity: number;
  presentation: number;
  feasibility: number;
  comments?: string | null;
  finalize: boolean;
}

export function submitScore(teamId: string, payload: ScoreIn) {
  return request<ScoreOut>(`/judging/teams/${teamId}/score`, {
    method: "POST",
    body: JSON.stringify(payload),
  });
}

// Shared guard for /judge/* pages: 401 -> logout + back to /login, 403 ->
// not a judge, send to /dashboard. Mirrors redirectOnAdminError.
export function redirectOnJudgeError(
  err: unknown,
  router: { replace: (href: string) => void }
): string | null {
  if (err instanceof ApiError) {
    if (err.status === 401) {
      logout();
      router.replace("/login");
      return null;
    }
    if (err.status === 403) {
      router.replace("/dashboard");
      return null;
    }
    return err.message;
  }
  return "Something went wrong.";
}
