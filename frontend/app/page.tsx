import { BootSequence } from "@/components/boot-sequence";

const ROUNDS = [
  {
    num: "01",
    label: "Round 1 — Find the Clues",
    title: "The Digital Trail",
    objective:
      "Teams solve digital and physical challenges to collect hidden code fragments scattered through the event.",
    output: "Code Fragments → Access Key",
    listLabel: "Challenge Types",
    items: ["QR-code clues", "Binary decoding & Morse code", "Cryptography, logic & riddles"],
  },
  {
    num: "02",
    label: "Round 2 — Investigate the Incident",
    title: "Digital Detectives",
    objective:
      "Using their Access Key, teams open a Digital Incident Case File — logs, timestamps, suspicious emails, and code snippets.",
    output: "Investigation Report → Stage 3 Brief",
    listLabel: "Questions to Answer",
    items: ["Who compromised the system", "What happened, when & how", "Which vulnerability was exploited"],
  },
];

const CASES = [
  { num: "Case 01", name: "Password Attack", desc: "Password Security Checker Interface" },
  { num: "Case 02", name: "Phishing Attack", desc: "Phishing Detection & Analysis Interface" },
  { num: "Case 03", name: "Data Leakage", desc: "Data Privacy & PII Auditor Interface" },
  { num: "Case 04", name: "Encryption Incident", desc: "Cryptographic Encryption / Decryption Utility" },
];

const STACK = ["HTML / CSS / JS", "Python", "Scratch", "MIT App Inventor", "No-Code Tools", "AI Tools"];

export default function Home() {
  return (
    <main className="flex flex-col">
      <BootSequence />

      {/* NAV */}
      <nav className="sticky top-0 z-50 flex items-center justify-between border-b border-border/60 bg-background/85 px-5 py-5 backdrop-blur-md sm:px-8">
        <a href="#top" className="flex items-center gap-2.5 text-sm font-semibold tracking-wide text-foreground uppercase">
          <span className="h-1.5 w-1.5 flex-shrink-0 rounded-full bg-primary" style={{ boxShadow: "0 0 6px var(--primary)" }} />
          DigiHunt // The Missing Code
        </a>
        <div className="hidden gap-9 md:flex">
          <a href="#overview" className="text-xs tracking-widest text-muted-foreground uppercase transition-colors hover:text-foreground">Brief</a>
          <a href="#stages" className="text-xs tracking-widest text-muted-foreground uppercase transition-colors hover:text-foreground">Stages</a>
          <a href="#finale" className="text-xs tracking-widest text-muted-foreground uppercase transition-colors hover:text-foreground">Master Code</a>
          <a href="#register" className="text-xs tracking-widest text-muted-foreground uppercase transition-colors hover:text-foreground">Register</a>
        </div>
        <a
          href="/register"
          className="inline-flex items-center gap-2 border border-primary px-5 py-2.5 text-xs font-bold tracking-widest text-primary uppercase transition-colors hover:bg-primary hover:text-primary-foreground"
        >
          Enter →
        </a>
      </nav>

      {/* HERO */}
      <header id="top" className="relative overflow-hidden px-5 pt-16 pb-16 sm:px-8 sm:pt-24 sm:pb-24">
        <div className="pointer-events-none absolute top-[-15%] right-[-12%] z-0 h-[130%] w-[65%] bg-[radial-gradient(circle,oklch(0.919_0.237_127.1_/_8%),oklch(0.919_0.237_127.1_/_2%)_45%,transparent_72%)]" />
        <div className="relative z-10 mx-auto max-w-[1280px]">
          <div className="mb-8 flex flex-wrap gap-2.5">
            <span className="border border-border px-3.5 py-1.5 text-[11px] tracking-widest text-muted-foreground uppercase">IETE SF Presents</span>
            <span className="border border-border px-3.5 py-1.5 text-[11px] tracking-widest text-muted-foreground uppercase">Online Event</span>
          </div>

          <h1 className="mb-7 font-heading text-[clamp(46px,9.5vw,124px)] leading-[0.92] font-bold tracking-tight uppercase">
            <span className="glow-cyan text-foreground">DIGI</span>
            <span className="glow-cyan text-primary">HUNT</span>
          </h1>

          <div className="mb-7 inline-flex items-center border-x-[3px] border-primary px-4.5 py-1.5 text-sm font-bold tracking-[0.28em] text-foreground uppercase">
            The Missing Code
          </div>

          <p className="mb-9 max-w-[560px] text-base leading-[1.75] text-secondary">
            A three-stage, story-driven technical challenge for first-year students. Decode hidden clues,
            investigate a simulated security incident, and build a working prototype to unlock the final Master
            Code.
          </p>

          <div className="mb-13 flex max-w-[660px] flex-wrap border-t border-border pt-5">
            <div className="flex-1 min-w-[130px] border-r border-border pr-6 last:border-r-0 last:pr-0">
              <div className="mb-2.5 text-[11px] tracking-widest text-muted-foreground uppercase">Date</div>
              <div className="font-heading text-xl font-bold text-foreground">Sept 3</div>
            </div>
            <div className="flex-1 min-w-[130px] border-r border-border px-6 last:border-r-0">
              <div className="mb-2.5 text-[11px] tracking-widest text-muted-foreground uppercase">Prize Pool</div>
              <div className="font-heading text-xl font-bold text-primary">₹10,000</div>
            </div>
            <div className="flex-1 min-w-[130px] pl-6">
              <div className="mb-2.5 text-[11px] tracking-widest text-muted-foreground uppercase">Team Size</div>
              <div className="font-heading text-xl font-bold text-foreground">1–4</div>
            </div>
          </div>

          <div className="flex flex-wrap gap-3.5">
            <a
              href="/register"
              className="inline-flex items-center justify-center gap-2 bg-primary px-7 py-4 text-[13px] font-bold tracking-widest text-primary-foreground uppercase transition-shadow hover:shadow-[0_0_16px_oklch(0.919_0.237_127.1_/_35%)]"
            >
              Register a Team
            </a>
            <a
              href="#stages"
              className="inline-flex items-center justify-center gap-2 border border-border px-7 py-4 text-[13px] font-bold tracking-widest text-secondary uppercase transition-colors hover:border-foreground hover:text-foreground"
            >
              View the Stages
            </a>
          </div>
        </div>
      </header>

      {/* OVERVIEW */}
      <section id="overview" className="border-t border-b border-border px-5 py-14 sm:px-8">
        <div className="mx-auto grid max-w-[1280px] gap-8 md:grid-cols-[230px_1fr]">
          <div className="text-xs font-bold tracking-widest text-primary uppercase">01 — Overview</div>
          <p className="max-w-[860px] text-lg leading-[1.8] text-secondary sm:text-xl">
            Teams of <span className="font-bold text-primary">2–3</span> take on a simulated security incident from
            the ground up — decoding hidden digital clues, reading the evidence like investigators, and shipping a
            real piece of software before the clock runs out.{" "}
            <span className="font-bold text-primary">Every stage unlocks the next.</span>
          </p>
        </div>
      </section>

      {/* STAGES */}
      <section id="stages" className="px-5 pt-20 sm:px-8">
        <div className="mx-auto max-w-[1280px]">
          <span className="mb-4.5 block text-xs font-bold tracking-widest text-primary uppercase">02 — The Mission</span>
          <h2 className="mb-5 font-heading text-[clamp(28px,4.6vw,48px)] leading-[1.18] font-bold text-foreground uppercase">
            Three Stages.
            <br />
            One Unlock Key Each.
          </h2>
          <p className="max-w-[480px] text-[15px] leading-[1.75] text-muted-foreground">
            The story runs in sequence — each round&apos;s output is the key that opens the next.
          </p>

          {ROUNDS.map((r) => (
            <div key={r.num} className="grid grid-cols-1 gap-7 border-t border-border py-12 sm:grid-cols-[120px_1fr]">
              <div
                className="font-heading text-[76px] leading-none font-bold text-transparent"
                style={{ WebkitTextStroke: "1.5px oklch(0.919 0.237 127.1 / 0.3)" }}
              >
                {r.num}
              </div>
              <div>
                <div className="mb-3 text-xs font-bold tracking-widest text-primary uppercase">{r.label}</div>
                <h3 className="mb-7 font-heading text-[clamp(22px,3.2vw,35px)] font-bold text-foreground uppercase">
                  {r.title}
                </h3>
                <div className="grid gap-10 md:grid-cols-[1.3fr_1fr]">
                  <div>
                    <div className="mb-3.5 text-[11px] tracking-widest text-muted-foreground uppercase">Objective</div>
                    <p className="mb-6 text-base leading-[1.75] text-secondary">{r.objective}</p>
                    <div className="inline-flex items-center gap-2 border border-border px-4.5 py-2.5 text-[13px] text-secondary">
                      <span className="text-primary">→</span> {r.output}
                    </div>
                  </div>
                  <div>
                    <div className="mb-3.5 text-[11px] tracking-widest text-muted-foreground uppercase">{r.listLabel}</div>
                    <ul className="flex flex-col gap-2.5">
                      {r.items.map((item) => (
                        <li key={item} className="relative pl-5 text-[15px] text-secondary">
                          <span className="absolute left-0 text-primary">—</span>
                          {item}
                        </li>
                      ))}
                    </ul>
                  </div>
                </div>
              </div>
            </div>
          ))}

          {/* Round 3 */}
          <div className="grid grid-cols-1 gap-7 border-t border-border py-12 sm:grid-cols-[120px_1fr]">
            <div
              className="font-heading text-[76px] leading-none font-bold text-transparent"
              style={{ WebkitTextStroke: "1.5px oklch(0.919 0.237 127.1 / 0.3)" }}
            >
              03
            </div>
            <div>
              <div className="mb-3 text-xs font-bold tracking-widest text-primary uppercase">Round 3 — Build the Solution</div>
              <h3 className="mb-7 font-heading text-[clamp(22px,3.2vw,35px)] font-bold text-foreground uppercase">
                The Final Hack
              </h3>

              <div className="mb-3.5 text-[11px] tracking-widest text-muted-foreground uppercase">Objective</div>
              <p className="mb-6 text-base leading-[1.75] text-secondary">
                Teams build a working software prototype that directly addresses the vulnerability uncovered in
                Stage 2, then deliver a live demo.
              </p>

              <div className="mb-1.5 text-[11px] tracking-widest text-muted-foreground uppercase">Case → Required Prototype</div>
              <div className="border-t border-border">
                {CASES.map((c) => (
                  <div
                    key={c.num}
                    className="grid grid-cols-[80px_1fr] items-center gap-x-5 gap-y-1.5 border-b border-border py-4.5 sm:grid-cols-[110px_1fr_1.1fr]"
                  >
                    <div className="text-sm font-bold text-primary">{c.num}</div>
                    <div className="text-base font-bold text-foreground">{c.name}</div>
                    <div
                      className="col-span-2 text-sm sm:col-span-1"
                      style={{ color: "oklch(0.697 0.020 127.3)" }}
                    >
                      {c.desc}
                    </div>
                  </div>
                ))}
              </div>

              <div className="mt-7 flex flex-wrap items-center gap-3">
                <span className="mr-1.5 text-[11px] tracking-widest text-muted-foreground uppercase">Permitted Stack</span>
                {STACK.map((s) => (
                  <span key={s} className="border border-border px-3.5 py-2 text-[13px] whitespace-nowrap text-foreground">
                    {s}
                  </span>
                ))}
              </div>

              <div className="mt-6.5">
                <div className="inline-flex items-center gap-2 border border-border px-4.5 py-2.5 text-[13px] font-bold text-foreground">
                  <span className="text-primary">→</span> Prototype + Source + Live Demo
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* FINALE */}
      <section id="finale" className="relative overflow-hidden px-5 py-24 text-center sm:py-32">
        <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_60%_55%_at_50%_35%,oklch(0.919_0.237_127.1_/_6%),transparent_70%)]" />
        <div className="relative z-10 mx-auto max-w-[920px]">
          <span className="text-xs font-bold tracking-widest text-primary uppercase">03 — The Finale</span>
          <h2 className="my-5 font-heading text-[clamp(28px,5.6vw,58px)] leading-[1.22] font-bold text-foreground uppercase">
            Run It. Reveal It.
            <br />
            Enter The Master Code.
          </h2>
          <p className="mx-auto mb-12 max-w-[640px] text-base leading-[1.75] text-muted-foreground">
            Teams run their working solution to generate the final unlock key and enter it into the Master Terminal
            to complete the mission.
          </p>
          <div className="flex flex-wrap items-center justify-center gap-3.5">
            <div className="border border-border px-7 py-4 text-xl font-bold tracking-widest text-primary">D1G1</div>
            <span className="text-lg text-muted-foreground">–</span>
            <div className="border border-border px-7 py-4 text-xl font-bold tracking-widest text-primary">HUNT</div>
            <span className="text-lg text-muted-foreground">–</span>
            <div className="border border-border px-7 py-4 text-xl font-bold tracking-widest text-primary">2026</div>
          </div>
        </div>
      </section>

      {/* CTA */}
      <section id="register" className="border-t border-border px-5 py-20 sm:px-8">
        <div className="mx-auto grid max-w-[1280px] items-start gap-14 md:grid-cols-[1fr_420px]">
          <div>
            <h2 className="mb-5.5 font-heading text-[clamp(26px,4.2vw,44px)] leading-[1.2] font-bold text-foreground uppercase">
              Decode. Investigate.
              <br />
              Build.
            </h2>
            <p className="max-w-[440px] text-base leading-[1.75] text-secondary">
              One online event, three rounds, a ₹10,000 prize pool. Bring a team of 1–4 and see how far you get
              before the Master Terminal.
            </p>
          </div>
          <div
            className="border border-border p-7"
            style={{ background: "linear-gradient(160deg, oklch(0.919 0.237 127.1 / 6%), transparent 55%)" }}
          >
            <div className="flex items-center justify-between border-b border-border py-4 first:pt-0">
              <span className="text-[11px] tracking-widest text-muted-foreground uppercase">Date</span>
              <span className="text-sm font-bold text-foreground">September 3</span>
            </div>
            <div className="flex items-center justify-between border-b border-border py-4">
              <span className="text-[11px] tracking-widest text-muted-foreground uppercase">Format</span>
              <span className="text-sm font-bold text-foreground">Online · Teams of 1–4</span>
            </div>
            <div className="flex items-center justify-between border-b border-border py-4">
              <span className="text-[11px] tracking-widest text-muted-foreground uppercase">Entry Fee</span>
              <span className="text-sm font-bold text-foreground">₹100 per person</span>
            </div>
            <div className="flex items-center justify-between py-4 last:border-b-0">
              <span className="text-[11px] tracking-widest text-muted-foreground uppercase">Prize Pool</span>
              <span className="text-sm font-bold text-primary">₹10,000</span>
            </div>
            <a
              href="/register"
              className="mt-5.5 flex w-full items-center justify-center gap-2 bg-primary px-7 py-4 text-[13px] font-bold tracking-widest text-primary-foreground uppercase transition-shadow hover:shadow-[0_0_16px_oklch(0.919_0.237_127.1_/_35%)]"
            >
              Register Now
            </a>
          </div>
        </div>
      </section>

      {/* FOOTER */}
      <footer className="border-t border-border px-5 py-6 sm:px-8">
        <div className="mx-auto flex max-w-[1280px] flex-wrap justify-between gap-4">
          <div className="flex gap-6.5">
            <span className="text-[12.5px] text-muted-foreground">IETE SF</span>
            <span className="text-[12.5px] text-muted-foreground">DigiHunt</span>
          </div>
          <div className="flex gap-6.5">
            <a href="#overview" className="text-[12.5px] text-muted-foreground transition-colors hover:text-foreground">Brief</a>
            <a href="#stages" className="text-[12.5px] text-muted-foreground transition-colors hover:text-foreground">Stages</a>
            <a href="#register" className="text-[12.5px] text-muted-foreground transition-colors hover:text-foreground">Register</a>
          </div>
        </div>
      </footer>
    </main>
  );
}
