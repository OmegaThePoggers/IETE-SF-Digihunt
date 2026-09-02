"""Team-scoped WebSocket connection registry + broadcast.

Broadcasts are team-scoped by construction: `broadcast()` only ever sends to
sockets registered under `active[team_id]`, so a payload can never reach
another team. Event payloads must still avoid leaking anything a teammate
shouldn't pre-emptively see (no correct_answer, no master code/hash, etc.) —
enforced at each call site, not here.
"""

import json
import uuid

from fastapi import WebSocket


class ConnectionManager:
    def __init__(self) -> None:
        self.active: dict[uuid.UUID, set[WebSocket]] = {}
        # team_id -> {user_id: open_connection_count}. A user can have
        # multiple tabs/devices open; member_online/offline should only fire
        # on the 0<->1 transition, not on every tab open/close.
        self.online_counts: dict[uuid.UUID, dict[uuid.UUID, int]] = {}

    async def connect(self, websocket: WebSocket, team_id: uuid.UUID, user_id: uuid.UUID) -> None:
        await websocket.accept()
        self.active.setdefault(team_id, set()).add(websocket)
        counts = self.online_counts.setdefault(team_id, {})
        counts[user_id] = counts.get(user_id, 0) + 1
        await websocket.send_text(
            json.dumps(
                {
                    "type": "presence_snapshot",
                    "user_ids": [str(online_user_id) for online_user_id in counts],
                }
            )
        )
        if counts[user_id] == 1:
            await self.broadcast(team_id, {"type": "member_online", "user_id": str(user_id)})

    async def disconnect(self, websocket: WebSocket, team_id: uuid.UUID, user_id: uuid.UUID) -> None:
        sockets = self.active.get(team_id)
        if sockets is not None:
            sockets.discard(websocket)
            if not sockets:
                del self.active[team_id]

        counts = self.online_counts.get(team_id)
        if counts is not None and user_id in counts:
            counts[user_id] -= 1
            if counts[user_id] <= 0:
                del counts[user_id]
                if not counts:
                    del self.online_counts[team_id]
                await self.broadcast(team_id, {"type": "member_offline", "user_id": str(user_id)})

    async def broadcast(self, team_id: uuid.UUID, event: dict) -> None:
        sockets = self.active.get(team_id)
        if not sockets:
            return
        payload = json.dumps(event)
        dead: list[WebSocket] = []
        for ws in list(sockets):
            try:
                await ws.send_text(payload)
            except Exception:
                # ponytail: broad except is deliberate — any send failure
                # (closed socket, broken pipe, etc.) just marks the socket
                # dead rather than aborting the broadcast loop for everyone
                # else on the team.
                dead.append(ws)
        if dead:
            live = self.active.get(team_id)
            if live is not None:
                for ws in dead:
                    live.discard(ws)
                if not live:
                    self.active.pop(team_id, None)


manager = ConnectionManager()


def broadcast_from_sync(team_id: uuid.UUID, event: dict) -> None:
    """Bridge for firing a broadcast from FastAPI's *sync* `def` route
    handlers (questions.py's claim/release/answer and master.py's verify are
    plain `def`, not `async def`).

    Only call this from a genuinely sync route. `submissions.py`'s upload
    route is `async def` (it awaits `file.read()`), so it runs directly on
    the event loop with no anyio worker-thread context for this bridge to
    hop through — it calls `await manager.broadcast(...)` directly instead.
    Confirmed by hitting this exact `anyio.NoEventLoopError` when it was
    first (wrongly) wired to use this helper.

    FastAPI/Starlette run sync route handlers via
    `anyio.to_thread.run_sync` (Starlette's `run_in_threadpool`), which sets
    thread-local state marking the worker thread as "belonging to" the
    caller's event loop. `anyio.from_thread.run()` detects that state and
    hops back onto the event loop to await the coroutine, blocking this
    worker thread until it completes (broadcasts are fast — a handful of
    `ws.send_text` calls — so blocking briefly here is fine).

    This was verified for real (not assumed) with a FastAPI TestClient
    round-trip: a sync route called `anyio.from_thread.run(...)` on an async
    helper and the result came back correctly on the sync side. No manually
    created BlockingPortal or captured event-loop reference is needed —
    `anyio.to_thread.run_sync` already provides the thread-local context
    `from_thread.run` looks for.
    """
    import anyio

    anyio.from_thread.run(manager.broadcast, team_id, event)
