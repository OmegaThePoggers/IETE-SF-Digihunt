export type DashboardRoundState = "locked" | "active" | "completed";

export type DashboardMember = {
  id: string;
  name: string;
  isYou: boolean;
  presence: "online" | "offline";
};

export type DashboardRound = {
  id: "round1" | "round2" | "master" | "round3";
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
  progress: { solved: 4, total: 7 },
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
      id: "master",
      index: "M",
      eyebrow: "Master Terminal",
      title: "Authorize the final gate",
      description: "The access terminal opens after Round 02 is complete.",
      state: "locked",
      solved: 0,
      total: 1,
      href: "/master",
    },
    {
      id: "round3",
      index: "03",
      eyebrow: "The Final Hack",
      title: "Transmit the payload",
      description: "The final operation unlocks after terminal authorization.",
      state: "locked",
      solved: 0,
      total: 0,
      href: "/round3",
    },
  ],
} satisfies DashboardViewModel;

export const lockedDashboardFixture = {
  ...activeDashboardFixture,
  progress: { solved: 0, total: 7 },
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
  progress: { solved: 8, total: 8 },
  currentMission: {
    title: "Mission archived",
    summary: "Every round is complete. Review the final operation while results are processed.",
    actionLabel: "Review completed mission",
    href: "/round3",
  },
  rounds: activeDashboardFixture.rounds.map((round) => ({
    ...round,
    solved: round.total,
    state: "completed" as const,
  })),
} satisfies DashboardViewModel;
