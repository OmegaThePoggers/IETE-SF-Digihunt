import { describe, expect, it } from "vitest";

import { shouldAutoClaim } from "@/app/round1/page";

describe("Round 1 automatic claim", () => {
  it("does not immediately reclaim a clue the participant just released", () => {
    expect(shouldAutoClaim("clue-1", "clue-1")).toBe(false);
  });

  it("claims the next available clue when it has not been released by this participant", () => {
    expect(shouldAutoClaim("clue-1", null)).toBe(true);
  });
});
