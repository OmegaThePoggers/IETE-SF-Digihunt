"""four rounds + anagram gates

Revision ID: c3f1a20b7de4
Revises: b2d8e4f1a6c3
Create Date: 2026-09-02
"""

import sqlalchemy as sa
from alembic import op

revision = "c3f1a20b7de4"
down_revision = "b2d8e4f1a6c3"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.create_table(
        "round_unlocks",
        sa.Column("id", sa.UUID(), primary_key=True),
        sa.Column("team_id", sa.UUID(), sa.ForeignKey("teams.id"), nullable=False),
        sa.Column("round_number", sa.Integer(), nullable=False),
        sa.Column("unlocked_by", sa.UUID(), sa.ForeignKey("users.id"), nullable=True),
        sa.Column("unlocked_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.UniqueConstraint("team_id", "round_number", name="uq_round_unlocks_team_round"),
    )
    op.create_table(
        "round_key_attempts",
        sa.Column("id", sa.UUID(), primary_key=True),
        sa.Column("team_id", sa.UUID(), sa.ForeignKey("teams.id"), nullable=False),
        sa.Column("user_id", sa.UUID(), sa.ForeignKey("users.id"), nullable=False),
        sa.Column("round_number", sa.Integer(), nullable=False),
        sa.Column("submitted", sa.String(), nullable=False),
        sa.Column("correct", sa.Boolean(), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
    )

    # Backfill so teams mid-event do not regress: any team whose round 1 is
    # fully solved keeps round 2 open, and any team that already passed the
    # old Master Terminal keeps round 3 open.
    op.execute(
        """
        INSERT INTO round_unlocks (id, team_id, round_number)
        SELECT gen_random_uuid(), tq.team_id, 2
        FROM team_questions tq
        JOIN questions q ON q.id = tq.question_id
        WHERE q.round = 1
        GROUP BY tq.team_id
        HAVING COUNT(*) = COUNT(*) FILTER (WHERE tq.status = 'solved')
        ON CONFLICT DO NOTHING
        """
    )
    op.execute(
        """
        INSERT INTO round_unlocks (id, team_id, round_number)
        SELECT gen_random_uuid(), ma.team_id, 3
        FROM master_attempts ma
        WHERE ma.correct IS TRUE
        GROUP BY ma.team_id
        ON CONFLICT DO NOTHING
        """
    )
    # The upload round moved 3 -> 4; carry its deadline setting across.
    op.execute("UPDATE event_settings SET key = 'round4_deadline' WHERE key = 'round3_deadline'")


def downgrade() -> None:
    op.execute("UPDATE event_settings SET key = 'round3_deadline' WHERE key = 'round4_deadline'")
    op.drop_table("round_key_attempts")
    op.drop_table("round_unlocks")
