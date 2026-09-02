import asyncio
import json
import unittest
import uuid

from app.websocket.manager import ConnectionManager


class FakeWebSocket:
    def __init__(self):
        self.accepted = False
        self.messages = []

    async def accept(self):
        self.accepted = True

    async def send_text(self, payload: str):
        self.messages.append(json.loads(payload))


class ConnectionManagerPresenceTests(unittest.TestCase):
    def test_new_connection_receives_current_team_presence_snapshot(self):
        async def scenario():
            manager = ConnectionManager()
            team_id = uuid.uuid4()
            first_user = uuid.uuid4()
            second_user = uuid.uuid4()
            first_socket = FakeWebSocket()
            second_socket = FakeWebSocket()

            await manager.connect(first_socket, team_id, first_user)
            await manager.connect(second_socket, team_id, second_user)

            snapshots = [
                message for message in second_socket.messages
                if message.get("type") == "presence_snapshot"
            ]
            self.assertEqual(len(snapshots), 1)
            self.assertEqual(
                set(snapshots[0]["user_ids"]),
                {str(first_user), str(second_user)},
            )

        asyncio.run(scenario())


if __name__ == "__main__":
    unittest.main()
