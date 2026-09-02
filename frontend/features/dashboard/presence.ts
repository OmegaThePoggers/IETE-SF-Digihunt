import type { TeamSocketEvent } from "@/hooks/useTeamSocket";

function applyPresenceEvent(current: ReadonlySet<string>, event: TeamSocketEvent): Set<string> {
  if (event.type === "presence_snapshot" && Array.isArray(event.user_ids)) {
    return new Set(event.user_ids.filter((userId): userId is string => typeof userId === "string"));
  }

  if (event.type === "member_online" && typeof event.user_id === "string") {
    return new Set(current).add(event.user_id);
  }

  if (event.type === "member_offline" && typeof event.user_id === "string") {
    const next = new Set(current);
    next.delete(event.user_id);
    return next;
  }

  return new Set(current);
}

export { applyPresenceEvent };
