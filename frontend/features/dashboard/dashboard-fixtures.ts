export type DashboardRoundState = "locked" | "active" | "completed";

export type DashboardMember = {
  id: string;
  name: string;
  isYou: boolean;
  presence: "online" | "offline";
};

export type DashboardRound = {
  id: "round1" | "gate2" | "round2" | "gate3" | "round3" | "gate4" | "round4";
  index: string;
  eyebrow: string;
  title: string;
  description: string;
  state: DashboardRoundState;
  solved: number;
  total: number;
  href: string;
};

export type DashboardViewModel = {
  team: {
    name: string;
    code: string;
  };
  members: DashboardMember[];
  rounds: DashboardRound[];
  currentMission: {
    title: string;
    summary: string;
    actionLabel: string;
    href: string;
  };
  progress: {
    solved: number;
    total: number;
  };
};

const members: DashboardMember[] = [
  { id: "member-1", name: "Asha", isYou: true, presence: "online" },
  { id: "member-2", name: "Kabir", isYou: false, presence: "online" },
  { id: "member-3", name: "Mira", isYou: false, presence: "offline" },
];

export const activeDashboardFixture = {
  team: { name: "Null Pointers", code: "KH-2048" },
  members,
  progress: { solved: 5, total: 13 },
  currentMission: {
    title: "Digital Detectives",
    summary: "Four signals remain. Re-enter the investigation and close the active trail.",
    actionLabel: "Continue round 02",
    href: "/round2",
  },
  rounds: [
    {
      id: "round1",
      index: "01",
      eyebrow: "The Digital Trail",
      title: "Find the clues",
      description: "Trace the first signal set and recover every fragment.",
      state: "completed",
      solved: 3,
      total: 3,
      href: "/round1",
    },
    {
      id: "gate2",
      index: "G2",
      eyebrow: "Cipher Gate",
      title: "Unlock Round 2",
      description: "Unscramble the Round 1 fragments to unlock the incident dossier.",
      state: "completed",
      solved: 1,
      total: 1,
      href: "/gate/2",
    },
    {
      id: "round2",
      index: "02",
      eyebrow: "Digital Detectives",
      title: "Connect the evidence",
      description: "Interrogate the active evidence board and resolve the remaining cases.",
      state: "active",
      solved: 1,
      total: 4,
      href: "/round2",
    },
    {
      id: "gate3",
      index: "G3",
      eyebrow: "Cipher Gate",
      title: "Unlock Round 3",
      description: "Solve the Round 2 anagram once all evidence questions are complete.",
      state: "locked",
      solved: 0,
      total: 1,
      href: "/gate/3",
    },
    {
      id: "round3",
      index: "03",
      eyebrow: "Defensive Prototyping",
      title: "Clear the final hack",
      description: "Answer the final MCQs to recover the upload gate fragments.",
      state: "locked",
      solved: 0,
      total: 6,
      href: "/round3",
    },
    {
      id: "gate4",
      index: "G4",
      eyebrow: "Cipher Gate",
      title: "Unlock Round 4",
      description: "Unscramble the Round 3 fragments to open final PPT upload.",
      state: "locked",
      solved: 0,
      total: 1,
      href: "/gate/4",
    },
    {
      id: "round4",
      index: "04",
      eyebrow: "The Final Hack",
      title: "Transmit the payload",
      description: "Upload the final presentation for judge scoring.",
      state: "locked",
      solved: 0,
      total: 1,
      href: "/round4",
    },
  ],
} satisfies DashboardViewModel;

export const lockedDashboardFixture = {
  ...activeDashboardFixture,
  progress: { solved: 0, total: 13 },
  currentMission: {
    title: "The Digital Trail",
    summary: "Your first signal is live. Enter Round 01 to begin the hunt.",
    actionLabel: "Begin round 01",
    href: "/round1",
  },
  rounds: activeDashboardFixture.rounds.map((round) => ({
    ...round,
    solved: 0,
    state: round.id === "round1" ? ("active" as const) : ("locked" as const),
  })),
} satisfies DashboardViewModel;

export const completedDashboardFixture = {
  ...activeDashboardFixture,
  progress: { solved: 13, total: 13 },
  currentMission: {
    title: "Mission archived",
    summary: "Every round is complete. Review the final operation while results are processed.",
    actionLabel: "Review completed mission",
    href: "/round4",
  },
  rounds: activeDashboardFixture.rounds.map((round) => ({
    ...round,
    solved: round.total,
    state: "completed" as const,
  })),
} satisfies DashboardViewModel;
