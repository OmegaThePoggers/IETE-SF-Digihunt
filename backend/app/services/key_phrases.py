"""Themed, deterministic cipher phrases."""

import hashlib
import random

PHRASE_BANKS: dict[int, list[tuple[str, str]]] = {
    1: [
        ("BINARY SIGNAL", "How machines spell every message."),
        ("MORSE BEACON", "Dots, dashes, and a light in the dark."),
        ("CIPHER TRAIL", "The path left by shifted letters."),
        ("SILENT PACKET", "Data that moved without being noticed."),
        ("HIDDEN DIGITS", "Numbers that were never meant to be read."),
    ],
    2: [
        ("PHISHING PAYLOAD", "The bait arrived as an attachment."),
        ("STOLEN SESSION", "Someone else is wearing your login."),
        ("MIDNIGHT BREACH", "The logs point at the small hours."),
        ("EXPORTED RECORDS", "The database left through the front door."),
        ("INSIDER MOTIVE", "Ask why before you ask who."),
    ],
    3: [
        ("ACCESS DENIED", "The only safe default for a stranger."),
        ("SECURE PROTOTYPE", "Lock it down before you ship it."),
        ("AUDIT PIPELINE", "Every action leaves a record."),
        ("QUARANTINE ALERT", "Hold the change, raise the flag."),
        ("PATCHED GATEWAY", "The hole in the wall is closed."),
    ],
}


def phrase_for_round(team_code: str, round_number: int) -> tuple[str, str]:
    """Return stable (phrase, hint) for a team and round."""
    bank = PHRASE_BANKS[round_number]
    seed = hashlib.sha256(f"{team_code}:phrase:{round_number}".encode()).hexdigest()
    return random.Random(int(seed, 16)).choice(bank)
