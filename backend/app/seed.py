"""Demo-data seed script for DigiHunt (G8).

Standalone dev tool — not imported anywhere in the app's normal import graph.
Run with:

    venv/Scripts/python -m app.seed

Idempotent: re-running never duplicates teams/users/cases/submissions/scores
(each insert is guarded by a check-before-insert on a natural key). Question
and Round assignment reuse app.services.question_gen.assign_round and
app.services.case_gen.assign_case/seed_cases so seeded teams sit on the exact
same code path a real team goes through.

Round 2 for team 2: assign_round(...) is called (not left unassigned) so its
board is pre-populated in `available` status for the demo — a judge/organizer
poking at team 2 sees a populated-but-untouched Round 2 board immediately,
rather than an empty one that only appears after the team's first real GET.
Either choice is safe (the real endpoint calls assign_round too, which is
idempotent), this just makes the demo state visible without needing a login.
"""

import zipfile
from datetime import datetime, timedelta, timezone
from io import BytesIO
from pathlib import Path

from sqlalchemy import select
from sqlalchemy.orm import Session

from app.core.config import settings
from app.core.db import SessionLocal
from app.core.security import hash_password
from app.models import (
    Attempt,
    Question,
    RoundUnlock,
    Score,
    Submission,
    Team,
    TeamQuestion,
    User,
)
from app.models.enums import TeamQuestionStatus, UserRole
from app.services.case_gen import assign_case, seed_cases
from app.services.question_gen import BLUEPRINT, ROUND2_BLUEPRINT, ROUND3_BLUEPRINT, assign_round
from app.services.team_code import generate_team_code

PARTICIPANT_PASSWORD = "Demo1234!"
JUDGE_PASSWORD = "Judge1234!"

TEAM_SPECS = [
    ("DigiHunt Demo Team Alpha", "demo1"),
    ("DigiHunt Demo Team Beta", "demo2"),
    ("DigiHunt Demo Team Gamma", "demo3"),
]
MEMBER_SUFFIXES = ["a", "b", "c"]


# --------------------------------------------------------------------------
# minimal valid PPTX (no python-pptx dependency — hand-built OOXML skeleton)
# --------------------------------------------------------------------------

def _build_minimal_pptx() -> bytes:
    """A hand-rolled, structurally valid single-slide .pptx.

    Not routed through python-pptx (not an installed/required dependency) —
    a valid PPTX is just a zip with a handful of required OOXML parts, so
    this writes them directly. Verified openable via zipfile round-trip.
    """
    parts = {
        "[Content_Types].xml": """<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">
<Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/>
<Default Extension="xml" ContentType="application/xml"/>
<Override PartName="/ppt/presentation.xml" ContentType="application/vnd.openxmlformats-officedocument.presentationml.presentation.main+xml"/>
<Override PartName="/ppt/slideMasters/slideMaster1.xml" ContentType="application/vnd.openxmlformats-officedocument.presentationml.slideMaster+xml"/>
<Override PartName="/ppt/slideLayouts/slideLayout1.xml" ContentType="application/vnd.openxmlformats-officedocument.presentationml.slideLayout+xml"/>
<Override PartName="/ppt/slides/slide1.xml" ContentType="application/vnd.openxmlformats-officedocument.presentationml.slide+xml"/>
<Override PartName="/ppt/theme/theme1.xml" ContentType="application/vnd.openxmlformats-officedocument.theme+xml"/>
<Override PartName="/docProps/core.xml" ContentType="application/vnd.openxmlformats-package.core-properties+xml"/>
<Override PartName="/docProps/app.xml" ContentType="application/vnd.openxmlformats-officedocument.extended-properties+xml"/>
</Types>""",
        "_rels/.rels": """<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
<Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="ppt/presentation.xml"/>
<Relationship Id="rId2" Type="http://schemas.openxmlformats.org/package/2006/relationships/metadata/core-properties" Target="docProps/core.xml"/>
<Relationship Id="rId3" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/extended-properties" Target="docProps/app.xml"/>
</Relationships>""",
        "docProps/core.xml": """<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<cp:coreProperties xmlns:cp="http://schemas.openxmlformats.org/package/2006/metadata/core-properties" xmlns:dc="http://purl.org/dc/elements/1.1/" xmlns:dcterms="http://purl.org/dc/terms/" xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance">
<dc:title>DigiHunt Demo Submission</dc:title>
<dc:creator>DigiHunt Seed</dc:creator>
<cp:lastModifiedBy>DigiHunt Seed</cp:lastModifiedBy>
<dcterms:created xsi:type="dcterms:W3CDTF">2026-08-27T00:00:00Z</dcterms:created>
<dcterms:modified xsi:type="dcterms:W3CDTF">2026-08-27T00:00:00Z</dcterms:modified>
</cp:coreProperties>""",
        "docProps/app.xml": """<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Properties xmlns="http://schemas.openxmlformats.org/officeDocument/2006/extended-properties" xmlns:vt="http://schemas.openxmlformats.org/officeDocument/2006/docPropsVTypes">
<Application>DigiHunt Seed</Application>
<PresentationFormat>On-screen Show</PresentationFormat>
<Slides>1</Slides>
</Properties>""",
        "ppt/presentation.xml": """<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<p:presentation xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships" xmlns:p="http://schemas.openxmlformats.org/presentationml/2006/main">
<p:sldMasterIdLst><p:sldMasterId id="2147483648" r:id="rId1"/></p:sldMasterIdLst>
<p:sldIdLst><p:sldId id="256" r:id="rId2"/></p:sldIdLst>
<p:sldSz cx="9144000" cy="6858000"/>
<p:notesSz cx="6858000" cy="9144000"/>
</p:presentation>""",
        "ppt/_rels/presentation.xml.rels": """<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
<Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/slideMaster" Target="slideMasters/slideMaster1.xml"/>
<Relationship Id="rId2" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/slide" Target="slides/slide1.xml"/>
<Relationship Id="rId3" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/theme" Target="theme/theme1.xml"/>
</Relationships>""",
        "ppt/slideMasters/slideMaster1.xml": """<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<p:sldMaster xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships" xmlns:p="http://schemas.openxmlformats.org/presentationml/2006/main">
<p:cSld><p:spTree><p:nvGrpSpPr><p:cNvPr id="1" name=""/><p:cNvGrpSpPr/><p:nvPr/></p:nvGrpSpPr><p:grpSpPr/></p:spTree></p:cSld>
<p:clrMap bg1="lt1" tx1="dk1" bg2="lt2" tx2="dk2" accent1="accent1" accent2="accent2" accent3="accent3" accent4="accent4" accent5="accent5" accent6="accent6" hlink="hlink" folHlink="folHlink"/>
<p:sldLayoutIdLst><p:sldLayoutId id="2147483649" r:id="rId1"/></p:sldLayoutIdLst>
</p:sldMaster>""",
        "ppt/slideMasters/_rels/slideMaster1.xml.rels": """<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
<Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/slideLayout" Target="../slideLayouts/slideLayout1.xml"/>
<Relationship Id="rId2" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/theme" Target="../theme/theme1.xml"/>
</Relationships>""",
        "ppt/slideLayouts/slideLayout1.xml": """<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<p:sldLayout xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships" xmlns:p="http://schemas.openxmlformats.org/presentationml/2006/main" type="blank" preserve="1">
<p:cSld><p:spTree><p:nvGrpSpPr><p:cNvPr id="1" name=""/><p:cNvGrpSpPr/><p:nvPr/></p:nvGrpSpPr><p:grpSpPr/></p:spTree></p:cSld>
<p:clrMapOvr><a:masterClrMapping/></p:clrMapOvr>
</p:sldLayout>""",
        "ppt/slideLayouts/_rels/slideLayout1.xml.rels": """<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
<Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/slideMaster" Target="../slideMasters/slideMaster1.xml"/>
</Relationships>""",
        "ppt/slides/slide1.xml": """<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<p:sld xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships" xmlns:p="http://schemas.openxmlformats.org/presentationml/2006/main">
<p:cSld><p:spTree>
<p:nvGrpSpPr><p:cNvPr id="1" name=""/><p:cNvGrpSpPr/><p:nvPr/></p:nvGrpSpPr>
<p:grpSpPr/>
<p:sp>
<p:nvSpPr><p:cNvPr id="2" name="Title 1"/><p:cNvSpPr><a:spLocks noGrp="1"/></p:cNvSpPr><p:nvPr><p:ph type="title"/></p:nvPr></p:nvSpPr>
<p:spPr/>
<p:txBody><a:bodyPr/><a:lstStyle/><a:p><a:r><a:t>DigiHunt Demo Submission</a:t></a:r></a:p></p:txBody>
</p:sp>
</p:spTree></p:cSld>
<p:clrMapOvr><a:masterClrMapping/></p:clrMapOvr>
</p:sld>""",
        "ppt/slides/_rels/slide1.xml.rels": """<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
<Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/slideLayout" Target="../slideLayouts/slideLayout1.xml"/>
</Relationships>""",
        "ppt/theme/theme1.xml": """<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<a:theme xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main" name="Office Theme">
<a:themeElements>
<a:clrScheme name="Office">
<a:dk1><a:sysClr val="windowText" lastClr="000000"/></a:dk1>
<a:lt1><a:sysClr val="window" lastClr="FFFFFF"/></a:lt1>
<a:dk2><a:srgbClr val="1F497D"/></a:dk2>
<a:lt2><a:srgbClr val="EEECE1"/></a:lt2>
<a:accent1><a:srgbClr val="4F81BD"/></a:accent1>
<a:accent2><a:srgbClr val="C0504D"/></a:accent2>
<a:accent3><a:srgbClr val="9BBB59"/></a:accent3>
<a:accent4><a:srgbClr val="8064A2"/></a:accent4>
<a:accent5><a:srgbClr val="4BACC6"/></a:accent5>
<a:accent6><a:srgbClr val="F79646"/></a:accent6>
<a:hlink><a:srgbClr val="0000FF"/></a:hlink>
<a:folHlink><a:srgbClr val="800080"/></a:folHlink>
</a:clrScheme>
<a:fontScheme name="Office">
<a:majorFont><a:latin typeface="Calibri"/><a:ea typeface=""/><a:cs typeface=""/></a:majorFont>
<a:minorFont><a:latin typeface="Calibri"/><a:ea typeface=""/><a:cs typeface=""/></a:minorFont>
</a:fontScheme>
<a:fmtScheme name="Office">
<a:fillStyleLst>
<a:solidFill><a:schemeClr val="phClr"/></a:solidFill>
<a:solidFill><a:schemeClr val="phClr"/></a:solidFill>
<a:solidFill><a:schemeClr val="phClr"/></a:solidFill>
</a:fillStyleLst>
<a:lnStyleLst>
<a:ln><a:solidFill><a:schemeClr val="phClr"/></a:solidFill></a:ln>
<a:ln><a:solidFill><a:schemeClr val="phClr"/></a:solidFill></a:ln>
<a:ln><a:solidFill><a:schemeClr val="phClr"/></a:solidFill></a:ln>
</a:lnStyleLst>
<a:effectStyleLst>
<a:effectStyle><a:effectLst/></a:effectStyle>
<a:effectStyle><a:effectLst/></a:effectStyle>
<a:effectStyle><a:effectLst/></a:effectStyle>
</a:effectStyleLst>
<a:bgFillStyleLst>
<a:solidFill><a:schemeClr val="phClr"/></a:solidFill>
<a:solidFill><a:schemeClr val="phClr"/></a:solidFill>
<a:solidFill><a:schemeClr val="phClr"/></a:solidFill>
</a:bgFillStyleLst>
</a:fmtScheme>
</a:themeElements>
</a:theme>""",
    }

    buf = BytesIO()
    with zipfile.ZipFile(buf, "w", zipfile.ZIP_DEFLATED) as zf:
        for name, content in parts.items():
            zf.writestr(name, content)
    return buf.getvalue()


# --------------------------------------------------------------------------
# idempotent get-or-create helpers
# --------------------------------------------------------------------------

def _get_or_create_team(db: Session, team_name: str) -> Team:
    team = db.scalar(select(Team).where(Team.team_name == team_name))
    if team is not None:
        return team
    team = Team(team_code=generate_team_code(db), team_name=team_name)
    db.add(team)
    db.commit()
    db.refresh(team)
    return team


def _get_or_create_user(
    db: Session, *, name: str, email: str, team_id, role: UserRole, password: str
) -> User:
    user = db.scalar(select(User).where(User.email == email))
    if user is not None:
        return user
    user = User(
        name=name,
        email=email,
        password_hash=hash_password(password),
        role=role,
        team_id=team_id,
    )
    db.add(user)
    db.commit()
    db.refresh(user)
    return user


def _solve_all(db: Session, team_questions: list[TeamQuestion], solver: User) -> int:
    """Mirror POST /questions/{id}/answer for a correct submission: a claim
    (assigned_to/claim_expires_at) followed by a solve (status/solved_by/
    solved_at) and an Attempt row — same fields the real endpoint writes.
    Idempotent: already-solved rows are left untouched. Returns count solved.
    """
    now = datetime.now(timezone.utc)
    solved = 0
    for tq in team_questions:
        if tq.status == TeamQuestionStatus.solved:
            continue
        question = db.get(Question, tq.question_id)
        tq.assigned_to = solver.id
        tq.claim_expires_at = now + timedelta(minutes=5)
        db.add(
            Attempt(
                team_question_id=tq.id,
                user_id=solver.id,
                selected_answer=question.correct_answer,
                correct=True,
            )
        )
        tq.status = TeamQuestionStatus.solved
        tq.solved_by = solver.id
        tq.solved_at = now
        solved += 1
    db.commit()
    return solved


def _ensure_round_unlock(db: Session, team: Team, round_number: int) -> None:
    existing = db.scalar(
        select(RoundUnlock).where(
            RoundUnlock.team_id == team.id, RoundUnlock.round_number == round_number
        )
    )
    if existing is None:
        db.add(RoundUnlock(team_id=team.id, round_number=round_number))
        db.commit()


def _ensure_submission(db: Session, team: Team, uploaded_by: User) -> Submission:
    existing = db.scalar(
        select(Submission).where(Submission.team_id == team.id, Submission.version == 1)
    )
    if existing is not None:
        return existing

    content = _build_minimal_pptx()
    team_dir = Path(settings.upload_directory) / team.team_code
    team_dir.mkdir(parents=True, exist_ok=True)
    dest_path = team_dir / "submission_v1.pptx"
    dest_path.write_bytes(content)

    submission = Submission(
        team_id=team.id,
        uploaded_by=uploaded_by.id,
        file_name="submission_v1.pptx",
        file_path=str(dest_path),
        file_size=len(content),
        mime_type="application/vnd.openxmlformats-officedocument.presentationml.presentation",
        version=1,
        is_current=True,
    )
    db.add(submission)
    db.commit()
    db.refresh(submission)
    return submission


def _ensure_score(
    db: Session,
    *,
    team: Team,
    judge: User,
    problem_understanding: int,
    technical_solution: int,
    creativity: int,
    presentation: int,
    feasibility: int,
    comments: str,
    finalized: bool,
) -> Score:
    existing = db.scalar(
        select(Score).where(Score.team_id == team.id, Score.judge_id == judge.id)
    )
    if existing is not None:
        return existing

    total = (
        problem_understanding + technical_solution + creativity + presentation + feasibility
    )
    score = Score(
        team_id=team.id,
        judge_id=judge.id,
        problem_understanding=problem_understanding,
        technical_solution=technical_solution,
        creativity=creativity,
        presentation=presentation,
        feasibility=feasibility,
        total=total,
        comments=comments,
        finalized=finalized,
        finalized_at=datetime.now(timezone.utc) if finalized else None,
    )
    db.add(score)
    db.commit()
    db.refresh(score)
    return score


# --------------------------------------------------------------------------
# main
# --------------------------------------------------------------------------

def main() -> None:
    db = SessionLocal()
    try:
        seed_cases(db)

        teams_and_users: list[tuple[Team, list[User]]] = []
        for team_name, email_prefix in TEAM_SPECS:
            team = _get_or_create_team(db, team_name)
            users = [
                _get_or_create_user(
                    db,
                    name=f"Demo Participant {email_prefix}{suffix.upper()}",
                    email=f"{email_prefix}{suffix}@digihunt.demo",
                    team_id=team.id,
                    role=UserRole.participant,
                    password=PARTICIPANT_PASSWORD,
                )
                for suffix in MEMBER_SUFFIXES
            ]
            teams_and_users.append((team, users))

        (team1, team1_users), (team2, team2_users), (team3, _team3_users) = teams_and_users

        # --- Team 1: full playthrough — Round 1, 2, 3, case, submission ---
        r1_t1 = assign_round(db, team1, 1, BLUEPRINT)
        _solve_all(db, r1_t1, team1_users[0])
        _ensure_round_unlock(db, team1, 2)
        r2_t1 = assign_round(db, team1, 2, ROUND2_BLUEPRINT)
        _solve_all(db, r2_t1, team1_users[1])
        _ensure_round_unlock(db, team1, 3)
        r3_t1 = assign_round(db, team1, 3, ROUND3_BLUEPRINT)
        _solve_all(db, r3_t1, team1_users[2])
        _ensure_round_unlock(db, team1, 4)
        case1 = assign_case(db, team1)
        submission1 = _ensure_submission(db, team1, team1_users[0])

        # --- Team 2: Round 1 complete, Round 2 pre-populated but untouched ---
        r1_t2 = assign_round(db, team2, 1, BLUEPRINT)
        _solve_all(db, r1_t2, team2_users[0])
        _ensure_round_unlock(db, team2, 2)
        assign_round(db, team2, 2, ROUND2_BLUEPRINT)  # board populated, all 'available'

        # --- Team 3: fresh, nothing assigned ---

        # --- Judges ---
        judge1 = _get_or_create_user(
            db, name="Judge One", email="judge1@digihunt.demo",
            team_id=None, role=UserRole.judge, password=JUDGE_PASSWORD,
        )
        judge2 = _get_or_create_user(
            db, name="Judge Two", email="judge2@digihunt.demo",
            team_id=None, role=UserRole.judge, password=JUDGE_PASSWORD,
        )

        # --- Scores for team 1 ---
        _ensure_score(
            db, team=team1, judge=judge1,
            problem_understanding=8, technical_solution=16, creativity=7,
            presentation=8, feasibility=8,
            comments="Clear problem framing and a working end-to-end demo. "
                     "Presentation could tighten the middle section.",
            finalized=True,
        )
        _ensure_score(
            db, team=team1, judge=judge2,
            problem_understanding=7, technical_solution=15, creativity=6,
            presentation=7, feasibility=7,
            comments="Draft pass — solid technical depth, want to see the "
                     "live demo before finalizing creativity/feasibility.",
            finalized=False,
        )

        # --- Summary ---
        print("=" * 72)
        print("DigiHunt demo seed complete")
        print("=" * 72)
        print(f"Participant password (all teams): {PARTICIPANT_PASSWORD}")
        print(f"Judge password (both judges):      {JUDGE_PASSWORD}")
        print()
        print(f"Team {team1.team_code} ({team1.team_name}):")
        for u in team1_users:
            print(f"  - {u.email}")
        print(
            f"  Status: Round 1+2+3 complete, Round 4 unlocked, case #{case1.case_number} "
            f"({case1.title}) assigned, submission v1 uploaded "
            f"({submission1.file_path})"
        )
        print()
        print(f"Team {team2.team_code} ({team2.team_name}):")
        for u in team2_users:
            print(f"  - {u.email}")
        print("  Status: Round 1 complete, Round 2 available (not started)")
        print()
        print(f"Team {team3.team_code} ({team3.team_name}):")
        for u in _team3_users:
            print(f"  - {u.email}")
        print("  Status: fresh, not started")
        print()
        print(f"Judges: {judge1.email}, {judge2.email}")
        print("=" * 72)
    finally:
        db.close()


if __name__ == "__main__":
    main()
