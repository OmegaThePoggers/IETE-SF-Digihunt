"""add round 2 judge review state

Revision ID: b2d8e4f1a6c3
Revises: 9ff48c00f29c
Create Date: 2026-09-02
"""

from alembic import op
import sqlalchemy as sa

revision = "b2d8e4f1a6c3"
down_revision = "9ff48c00f29c"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column("team_questions", sa.Column("judge_approved", sa.Boolean(), nullable=True))
    op.add_column("team_questions", sa.Column("judge_reviewed_by", sa.UUID(), nullable=True))
    op.add_column("team_questions", sa.Column("judge_reviewed_at", sa.DateTime(timezone=True), nullable=True))
    op.create_foreign_key(
        "fk_team_questions_judge_reviewed_by_users",
        "team_questions",
        "users",
        ["judge_reviewed_by"],
        ["id"],
    )


def downgrade() -> None:
    op.drop_constraint("fk_team_questions_judge_reviewed_by_users", "team_questions", type_="foreignkey")
    op.drop_column("team_questions", "judge_reviewed_at")
    op.drop_column("team_questions", "judge_reviewed_by")
    op.drop_column("team_questions", "judge_approved")
