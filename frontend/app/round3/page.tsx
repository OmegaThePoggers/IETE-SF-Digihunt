"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  ApiError,
  getCase,
  getCurrentSubmission,
  getSubmissionHistory,
  getStoredToken,
  uploadSubmission,
  type CaseOut,
  type SubmissionOut,
} from "@/lib/api";

// Spec §28 — required presentation structure, shown as a persistent
// reference in the left pane throughout the round, not just once.
const STRUCTURE = [
  "Problem",
  "Investigation findings",
  "Proposed solution",
  "UI",
  "How it works",
  "Technology/tools",
  "Impact",
  "Future scope",
];

function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

export default function Round3Page() {
  const router = useRouter();
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [locked, setLocked] = useState(false);
  const [caseFile, setCaseFile] = useState<CaseOut | null>(null);
  const [current, setCurrent] = useState<SubmissionOut | null>(null);
  const [history, setHistory] = useState<SubmissionOut[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);
  const [dragOver, setDragOver] = useState(false);

  const refreshSubmissions = useCallback(async () => {
    try {
      setCurrent(await getCurrentSubmission());
    } catch (err) {
      if (err instanceof ApiError && err.status === 404) {
        setCurrent(null);
      }
    }
    try {
      setHistory(await getSubmissionHistory());
    } catch {
      // non-fatal — history stays empty
    }
  }, []);

  useEffect(() => {
    if (!getStoredToken()) {
      router.replace("/login");
      return;
    }
    getCase()
      .then((data) => {
        setCaseFile(data);
        setLocked(false);
        refreshSubmissions();
      })
      .catch((err) => {
        if (err instanceof ApiError && err.status === 401) {
          router.replace("/login");
          return;
        }
        if (err instanceof ApiError && err.status === 403) {
          setLocked(true);
          return;
        }
        setError(err instanceof ApiError ? err.message : "Failed to load case file.");
      });
  }, [router, refreshSubmissions]);

  async function handleFile(file: File | undefined | null) {
    if (!file) return;
    setUploadError(null);
    setUploading(true);
    try {
      await uploadSubmission(file);
      await refreshSubmissions();
    } catch (err) {
      if (err instanceof ApiError && err.status === 423) {
        setUploadError("UPLOAD FAILED — Submission deadline has passed.");
      } else {
        setUploadError("UPLOAD FAILED — Check file type and size.");
      }
    } finally {
      setUploading(false);
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  }

  function handleDrop(e: React.DragEvent<HTMLDivElement>) {
    e.preventDefault();
    setDragOver(false);
    handleFile(e.dataTransfer.files?.[0]);
  }

  if (locked) {
    return (
      <main className="flex min-h-screen flex-col items-center justify-center gap-4 bg-background px-6 text-center">
        <p className="glow-cyan font-mono-data text-xl font-bold text-primary">
          ROUND LOCKED
        </p>
        <p className="font-mono-data text-sm text-muted-foreground">
          Pass the Master Terminal to unlock this round.
        </p>
        <Button
          variant="outline"
          className="font-mono-data"
          onClick={() => router.push("/master")}
        >
          GO TO MASTER TERMINAL
        </Button>
      </main>
    );
  }

  if (error) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-background px-6">
        <p className="border border-destructive/40 bg-destructive/10 px-4 py-3 font-mono-data text-sm text-destructive">
          {error}
        </p>
      </main>
    );
  }

  if (!caseFile) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-background px-6">
        <p className="font-mono-data text-sm text-muted-foreground">
          LOADING CASE FILE...
        </p>
      </main>
    );
  }

  return (
    <main className="flex min-h-screen flex-col bg-background">
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-border px-6 py-5 sm:px-8">
        <h1 className="glow-cyan font-mono-data text-lg font-bold tracking-widest text-primary uppercase sm:text-xl">
          Round 3 // The Final Hack
        </h1>
        <div className="flex items-center gap-4">
          <span className="font-mono-data text-xs tracking-widest text-muted-foreground">
            CASE {caseFile.case_number} · {caseFile.title.toUpperCase()}
          </span>
          <Button
            variant="outline"
            size="sm"
            className="font-mono-data"
            onClick={() => router.push("/dashboard")}
          >
            MISSION CONTROL
          </Button>
        </div>
      </div>

      <div className="grid flex-1 grid-cols-1 lg:grid-cols-[320px_1fr]">
        {/* LEFT — passive reference: case brief + required structure */}
        <div className="border-b border-border p-6 lg:border-r lg:border-b-0 sm:p-8">
          <p className="mb-3.5 font-mono-data text-[10px] tracking-widest text-muted-foreground uppercase">
            Reference — read once
          </p>

          <div className="mb-6 border border-border bg-black/20 p-4">
            <p className="mb-2 font-mono-data text-[10px] tracking-widest text-primary uppercase">
              Case brief
            </p>
            <p className="font-mono-data text-xs leading-relaxed text-foreground/90">
              {caseFile.description}
            </p>
            {caseFile.evidence && Object.keys(caseFile.evidence).length > 0 && (
              <pre className="mt-3 overflow-x-auto whitespace-pre-wrap border-t border-border pt-3 font-mono-data text-[10px] text-secondary">
                {JSON.stringify(caseFile.evidence, null, 2)}
              </pre>
            )}
          </div>

          <p className="mb-2.5 font-mono-data text-[10px] tracking-widest text-muted-foreground uppercase">
            Required structure
          </p>
          <div className="border-t border-border">
            {STRUCTURE.map((step, i) => (
              <div
                key={step}
                className="flex gap-2.5 border-b border-border py-2 font-mono-data text-xs text-foreground/90"
              >
                <span className="text-primary">{String(i + 1).padStart(2, "0")}</span>
                {step}
              </div>
            ))}
          </div>
        </div>

        {/* RIGHT — the active task: upload, current submission, history */}
        <div className="p-6 sm:p-8">
          <p className="mb-3.5 font-mono-data text-[10px] tracking-widest text-muted-foreground uppercase">
            Submit — the action
          </p>

          <div
            onDragOver={(e) => {
              e.preventDefault();
              setDragOver(true);
            }}
            onDragLeave={() => setDragOver(false)}
            onDrop={handleDrop}
            className={`mb-6 flex flex-col items-center justify-center gap-3 border-2 border-dashed px-6 py-14 text-center transition-colors ${
              dragOver ? "border-primary bg-primary/10" : "border-border"
            }`}
          >
            <p className="font-mono-data text-sm font-bold text-foreground">
              {uploading ? "UPLOADING..." : "DROP YOUR .PPTX HERE"}
            </p>
            <input
              ref={fileInputRef}
              type="file"
              accept=".ppt,.pptx"
              className="hidden"
              onChange={(e) => handleFile(e.target.files?.[0])}
            />
            <Button
              variant="outline"
              className="font-mono-data"
              disabled={uploading}
              onClick={() => fileInputRef.current?.click()}
            >
              [ SELECT FILE ]
            </Button>
          </div>

          {uploadError && (
            <p className="mb-6 border border-destructive/40 bg-destructive/10 px-4 py-2 font-mono-data text-sm text-destructive">
              {uploadError}
            </p>
          )}

          <div className="mb-6">
            <p className="mb-2 font-mono-data text-[10px] tracking-widest text-muted-foreground uppercase">
              Current submission
            </p>
            {current ? (
              <div
                className="flex flex-wrap items-center justify-between gap-2 border border-primary p-4"
                style={{
                  background: "linear-gradient(160deg, oklch(0.92 0.29 128 / 6%), transparent 60%)",
                }}
              >
                <span className="font-mono-data text-sm text-foreground">
                  {current.file_name} · v{current.version} · {formatBytes(current.file_size)}
                </span>
                <Badge className="font-mono-data">CURRENT</Badge>
              </div>
            ) : (
              <p className="font-mono-data text-sm text-muted-foreground">
                No submission uploaded yet.
              </p>
            )}
          </div>

          {history.length > 0 && (
            <div>
              <p className="mb-2 font-mono-data text-[10px] tracking-widest text-muted-foreground uppercase">
                Version history
              </p>
              <div className="border-t border-border">
                {history.map((s) => (
                  <div
                    key={s.id}
                    className="flex flex-wrap items-center justify-between gap-2 border-b border-border py-2.5 font-mono-data text-xs text-foreground"
                  >
                    <span>
                      v{s.version} · {s.file_name} · {formatBytes(s.file_size)} ·{" "}
                      {new Date(s.submitted_at).toLocaleString()}
                    </span>
                    <Badge
                      variant={s.is_current ? undefined : "outline"}
                      className="font-mono-data text-[9px]"
                    >
                      {s.is_current ? "CURRENT" : "SUPERSEDED"}
                    </Badge>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>
    </main>
  );
}
