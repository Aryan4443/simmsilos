from fastapi import APIRouter, HTTPException, Header
from pydantic import BaseModel
from db import get_conn
import os, time

router = APIRouter(prefix="/sync", tags=["sync"])

SERVICE_TOKEN = os.getenv("SERVICE_TOKEN", "NKN8pN4iVtWAKAyJqwHb5Xp4n397MFiCghUZEWDW9bw")

def verify_service_token(x_service_token: str = Header(...)):
    if x_service_token != SERVICE_TOKEN:
        raise HTTPException(status_code=403, detail="Invalid service token")


# ── models   

class AdminEvent(BaseModel):
    event: str
    username: str
    detail: dict = {}

class BranchAssignment(BaseModel):
    username: str
    branch: str

class TaskAssignment(BaseModel):
    username: str
    branch: str
    function: str

# ── endpoints for admin side to call ─────────────────────

@router.get("/users", dependencies=[])
def sync_get_users(x_service_token: str = Header(...)):
    verify_service_token(x_service_token)
    with get_conn() as conn:
        with conn.cursor() as cur:
            cur.execute("SELECT username, role FROM users")
            return {"users": [{"username": r[0], "role": r[1]} for r in cur.fetchall()]}

@router.get("/audit", dependencies=[])
def sync_get_audit(x_service_token: str = Header(...)):
    verify_service_token(x_service_token)
    with get_conn() as conn:
        with conn.cursor() as cur:
            cur.execute("""
                SELECT event, username, branch, detail, timestamp
                FROM audit_logs ORDER BY timestamp DESC LIMIT 200
            """)
            rows = cur.fetchall()
            return {"logs": [
                {"event": r[0], "user": r[1], "branch": r[2], "detail": r[3], "timestamp": r[4]}
                for r in rows
            ]}

@router.post("/audit")
def sync_push_event(payload: AdminEvent, x_service_token: str = Header(...)):

    verify_service_token(x_service_token)
    with get_conn() as conn:
        with conn.cursor() as cur:
            cur.execute(
                """INSERT INTO audit_logs (timestamp, event, username, branch, detail)
                   VALUES (%s, %s, %s, %s, %s)""",
                (time.time(), payload.event, payload.username, "admin", str(payload.detail))
            )
    return {"status": "recorded"}

@router.patch("/users/{username}/role")
def sync_update_role(username: str, body: dict, x_service_token: str = Header(...)):
    verify_service_token(x_service_token)
    role = body.get("role")
    if not role:
        raise HTTPException(status_code=400, detail="role required")
    with get_conn() as conn:
        with conn.cursor() as cur:
            cur.execute("UPDATE users SET role = %s WHERE username = %s", (role, username))
    return {"status": "updated", "username": username, "role": role}

# ── branch assignment ─────────────────────────────────────

@router.post("/assign/branch")
def assign_branch(payload: BranchAssignment, x_service_token: str = Header(...)):
    """Admin assigns a branch to a developer."""
    verify_service_token(x_service_token)
    with get_conn() as conn:
        with conn.cursor() as cur:
            cur.execute("""
                INSERT INTO branch_assignments (username, branch, assigned_at)
                VALUES (%s, %s, %s)
                ON CONFLICT (username) DO UPDATE SET branch = EXCLUDED.branch, assigned_at = EXCLUDED.assigned_at
            """, (payload.username, payload.branch, time.time()))
    return {"status": "assigned", "username": payload.username, "branch": payload.branch}

@router.delete("/assign/branch/{username}")
def unassign_branch(username: str, x_service_token: str = Header(...)):
    """Admin removes a developer's branch assignment."""
    verify_service_token(x_service_token)
    with get_conn() as conn:
        with conn.cursor() as cur:
            cur.execute("DELETE FROM branch_assignments WHERE username = %s", (username,))
    return {"status": "unassigned", "username": username}

@router.get("/assign/branches")
def list_branch_assignments(x_service_token: str = Header(...)):
    """Admin views all current branch assignments."""
    verify_service_token(x_service_token)
    with get_conn() as conn:
        with conn.cursor() as cur:
            cur.execute("SELECT username, branch, assigned_at FROM branch_assignments")
            return {"assignments": [{"username": r[0], "branch": r[1], "assigned_at": r[2]} for r in cur.fetchall()]}

# ── task assignment ───────────────────────────────────────

@router.post("/assign/task")
def assign_task(payload: TaskAssignment, x_service_token: str = Header(...)):
    """Admin assigns a function/task to a developer on their branch."""
    verify_service_token(x_service_token)
    with get_conn() as conn:
        with conn.cursor() as cur:
            cur.execute("""
                INSERT INTO task_assignments (username, branch, function, assigned_at)
                VALUES (%s, %s, %s, %s)
            """, (payload.username, payload.branch, payload.function, time.time()))
            cur.execute("SELECT lastval()")
            task_id = cur.fetchone()[0]
    return {"status": "assigned", "task_id": task_id, "username": payload.username, "function": payload.function}

@router.patch("/assign/task/{task_id}/status")
def update_task_status(task_id: int, body: dict, x_service_token: str = Header(...)):
    """Admin updates task status (pending/in_progress/done)."""
    verify_service_token(x_service_token)
    status = body.get("status")
    if status not in ("pending", "in_progress", "done"):
        raise HTTPException(status_code=400, detail="status must be pending, in_progress, or done")
    with get_conn() as conn:
        with conn.cursor() as cur:
            cur.execute("UPDATE task_assignments SET status = %s WHERE id = %s", (status, task_id))
    return {"status": "updated", "task_id": task_id}

@router.get("/assign/tasks")
def list_tasks(x_service_token: str = Header(...)):
    """Admin views all task assignments."""
    verify_service_token(x_service_token)
    with get_conn() as conn:
        with conn.cursor() as cur:
            cur.execute("SELECT id, username, branch, function, status, assigned_at FROM task_assignments ORDER BY assigned_at DESC")
            return {"tasks": [{"id": r[0], "username": r[1], "branch": r[2], "function": r[3], "status": r[4], "assigned_at": r[5]} for r in cur.fetchall()]}
