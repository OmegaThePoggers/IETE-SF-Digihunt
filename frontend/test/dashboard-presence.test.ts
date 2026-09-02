import { describe, expect, it } from "vitest";

import { applyPresenceEvent } from "@/features/dashboard/presence";

describe("applyPresenceEvent", () => {
  it("replaces stale local state with server presence snapshots", () => {
    const next = applyPresenceEvent(new Set(["old-user"]), {
      type: "presence_snapshot",
      user_ids: ["member-1", "member-2", 42, null],
    });

    expect([...next].sort()).toEqual(["member-1", "member-2"]);
  });

  it("applies online and offline deltas after a snapshot", () => {
    const withJoin = applyPresenceEvent(new Set(["member-1"]), {
      type: "member_online",
      user_id: "member-2",
    });
    const withLeave = applyPresenceEvent(withJoin, {
      type: "member_offline",
      user_id: "member-1",
    });

    expect([...withJoin].sort()).toEqual(["member-1", "member-2"]);
    expect([...withLeave]).toEqual(["member-2"]);
  });
});
