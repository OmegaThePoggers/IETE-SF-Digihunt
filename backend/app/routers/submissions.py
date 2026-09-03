"""Round 4 PPTX submission upload/list/download.

EventSettings encoding convention for this router: the `round4_deadline` row's
`value` column is a JSON-encoded ISO 8601 datetime string, e.g.
value = '"2026-09-05T18:00:00Z"' (i.e. json.dumps(iso_string)). If the key is
absent, there is no deadline and uploads are always allowed — that's correct
default behavior until G8's admin panel sets one, not a bug.
"""

import json
import os
import re
import tempfile
import uuid
from datetime import datetime, timezone
from pathlib import Path

from fastapi import APIRouter, Depends, HTTPException, UploadFile, status
from fastapi.responses import FileResponse
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.core.config import settings
from app.core.db import get_db
from app.core.deps import require_round_unlocked
from app.models import EventSettings, Submission, Team, User
from app.services.round_gate import UPLOAD_ROUND
from app.schemas.submission import SubmissionOut
from app.websocket.manager import manager

router = APIRouter(prefix="/submissions", tags=["submissions"])

ALLOWED_EXTENSIONS = {".ppt", ".pptx"}
ALLOWED_MIME_TYPES = {
    "application/vnd.ms-powerpoint",
    "application/vnd.openxmlformats-officedocument.presentationml.presentation",
}


def _max_upload_bytes() -> int:
    return settings.max_upload_bytes


def _human_size(num_bytes: int) -> str:
    if num_bytes >= 1024**3:
        return f"{num_bytes // 1024**3}GB"
    return f"{num_bytes // 1024**2}MB"

_UNSAFE_CHARS = re.compile(r"[^A-Za-z0-9_.-]+")


def _sanitize_for_filename(value: str) -> str:
    """team_name and the client-supplied original filename are both
    attacker-influenced strings. Collapse anything that isn't
    alnum/dash/underscore/dot to "_" — this also destroys every path
    separator ("/", "\\"), so the sanitized result can never contain a
    directory component and the final path can never escape ppt_directory,
    regardless of what "../../etc/passwd"-style input is thrown at it.
    """
    safe = _UNSAFE_CHARS.sub("_", value).strip("._")
    return safe or "file"


def _get_round4_deadline(db: Session) -> datetime | None:
    row = db.get(EventSettings, "round4_deadline")
    if row is None:
        return None
    iso_str = json.loads(row.value)
    deadline = datetime.fromisoformat(iso_str.replace("Z", "+00:00"))
    if deadline.tzinfo is None:
        deadline = deadline.replace(tzinfo=timezone.utc)
    return deadline


def _require_team(user: User = Depends(require_round_unlocked(UPLOAD_ROUND))) -> User:
    return user


def _to_out(submission: Submission) -> SubmissionOut:
    return SubmissionOut(
        id=submission.id,
        file_name=submission.file_name,
        file_size=submission.file_size,
        mime_type=submission.mime_type,
        version=submission.version,
        is_current=submission.is_current,
        submitted_at=submission.submitted_at,
    )


@router.post("", response_model=SubmissionOut)
async def upload_submission(
    file: UploadFile,
    user: User = Depends(_require_team),
    db: Session = Depends(get_db),
):
    deadline = _get_round4_deadline(db)
    if deadline is not None and datetime.now(timezone.utc) > deadline:
        raise HTTPException(status.HTTP_423_LOCKED, "Submission deadline has passed")

    ext = Path(file.filename or "").suffix.lower()
    if ext not in ALLOWED_EXTENSIONS:
        raise HTTPException(
            status.HTTP_400_BAD_REQUEST, "File must be a .ppt or .pptx file"
        )
    if file.content_type not in ALLOWED_MIME_TYPES:
        raise HTTPException(
            status.HTTP_415_UNSUPPORTED_MEDIA_TYPE,
            "File content-type is not a valid PowerPoint type",
        )

    team_id = user.team_id
    team = db.get(Team, team_id)
    if db.scalar(
        select(Submission.id).where(
            Submission.team_id == team_id, Submission.is_current.is_(True)
        )
    ):
        raise HTTPException(
            status.HTTP_409_CONFLICT,
            "A final submission already exists and cannot be replaced",
        )
    max_version = db.scalar(
        select(Submission.version)
        .where(Submission.team_id == team_id)
        .order_by(Submission.version.desc())
        .limit(1)
    )
    next_version = (max_version or 0) + 1

    # Flat backend/ppts/ directory (a new, separate location from the older
    # uploads/{team_code}/ layout — see settings.ppt_directory). The version
    # segment stays in the filename even on a re-upload: without it, a
    # re-upload would silently overwrite the previous version's physical
    # file on disk, while the DB keeps a Submission row (and download-by-id
    # route) pointing at a version that no longer exists as a distinct file.
    # Keeping "_v{n}_" in the name is what lets old versions stay downloadable
    # after a re-upload.
    safe_team_name = _sanitize_for_filename(team.team_name)
    safe_file_name = _sanitize_for_filename(file.filename or f"upload{ext}")
    ppt_dir = Path(settings.ppt_directory)
    ppt_dir.mkdir(parents=True, exist_ok=True)
    dest_path = ppt_dir / f"{safe_team_name}_v{next_version}_{safe_file_name}"
    # Defense in depth: confirm sanitization actually kept the file inside
    # ppt_dir before writing anything to disk.
    if ppt_dir.resolve() not in dest_path.resolve().parents:
        raise HTTPException(status.HTTP_400_BAD_REQUEST, "Invalid file name")

    # Stream to a temp file inside ppt_dir rather than accumulating the body
    # in memory. A 1GB upload buffered in RAM (and then joined into a single
    # bytes object) needs roughly twice that at peak and will OOM the
    # container. Creating the temp file in the destination directory keeps
    # the final os.replace on one filesystem, so it is an atomic rename
    # rather than a copy.
    limit = _max_upload_bytes()
    total = 0
    tmp_fd, tmp_name = tempfile.mkstemp(dir=ppt_dir, suffix=".part")
    try:
        with os.fdopen(tmp_fd, "wb") as tmp:
            while True:
                chunk = await file.read(1024 * 1024)
                if not chunk:
                    break
                total += len(chunk)
                if total > limit:
                    raise HTTPException(
                        status.HTTP_413_CONTENT_TOO_LARGE,
                        f"File exceeds the {_human_size(limit)} size limit",
                    )
                tmp.write(chunk)
        os.replace(tmp_name, dest_path)
    except BaseException:
        # Any failure (oversize, disconnect, disk error) must not leave a
        # partial .part file behind.
        try:
            os.unlink(tmp_name)
        except FileNotFoundError:
            pass
        raise

    submission = Submission(
        team_id=team_id,
        uploaded_by=user.id,
        file_name=file.filename,
        file_path=str(dest_path),
        file_size=total,
        mime_type=file.content_type,
        version=next_version,
        is_current=True,
    )
    db.add(submission)
    db.commit()
    db.refresh(submission)

    # upload_submission is `async def` (it awaits file.read()), so it runs
    # directly on the event loop — unlike questions.py's sync routes, there's
    # no anyio worker-thread context here for broadcast_from_sync's bridge to
    # hop through. Just await the coroutine directly.
    await manager.broadcast(
        team_id,
        {
            "type": "submission_uploaded" if next_version == 1 else "submission_replaced",
            "team_code": team.team_code,
            "version": next_version,
            "file_name": submission.file_name,
        },
    )

    return _to_out(submission)


@router.get("/current", response_model=SubmissionOut)
def get_current_submission(
    user: User = Depends(_require_team), db: Session = Depends(get_db)
):
    submission = db.scalar(
        select(Submission).where(
            Submission.team_id == user.team_id, Submission.is_current.is_(True)
        )
    )
    if submission is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "No submission yet")
    return _to_out(submission)


@router.get("/history", response_model=list[SubmissionOut])
def get_submission_history(
    user: User = Depends(_require_team), db: Session = Depends(get_db)
):
    submissions = db.scalars(
        select(Submission)
        .where(Submission.team_id == user.team_id)
        .order_by(Submission.version)
    ).all()
    return [_to_out(s) for s in submissions]


@router.get("/{submission_id}/download")
def download_submission(
    submission_id: uuid.UUID,
    user: User = Depends(_require_team),
    db: Session = Depends(get_db),
):
    submission = db.get(Submission, submission_id)
    if submission is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Submission not found")
    # SECURITY: id->path lookup is entirely server-side; never trust a path
    # from the client. Cross-team access is a hard 403, not a 404, so the
    # check itself is unambiguous in tests/logs.
    if submission.team_id != user.team_id:
        raise HTTPException(status.HTTP_403_FORBIDDEN, "Not your team's submission")
    return FileResponse(
        submission.file_path,
        filename=submission.file_name,
        media_type=submission.mime_type,
    )
