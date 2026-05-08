from fastapi import APIRouter, HTTPException, Header
from pydantic import BaseModel
from db import get_conn
from secrets import compare_digest
import os, time

router = APIRouter(prefix="/sync", tags=["sync"])

def verify_service_token(x_service_token: str = Header(...)):
    service_token = os.getenv("SERVICE_TOKEN")
    if not service_token:
        raise HTTPException(status_code=503, detail="Service token is not configured")
    if not compare_digest(x_service_token, service_token):
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
    """Admin assigns a branch to a developer (supports multiple)."""
    verify_service_token(x_service_token)
    with get_conn() as conn:
        with conn.cursor() as cur:
            cur.execute("""
                INSERT INTO branch_assignments (username, branch, active, assigned_at)
                VALUES (%s, %s, TRUE, %s)
            """, (payload.username, payload.branch, time.time()))
    return {"status": "assigned", "username": payload.username, "branch": payload.branch}

@router.patch("/assign/branch/{username}/active")
def set_active_branch(username: str, body: dict, x_service_token: str = Header(...)):
    """Admin sets which branch is active for a developer."""
    verify_service_token(x_service_token)
    branch = body.get("branch")
    with get_conn() as conn:
        with conn.cursor() as cur:
            cur.execute("UPDATE branch_assignments SET active = FALSE WHERE username = %s", (username,))
            cur.execute("UPDATE branch_assignments SET active = TRUE WHERE username = %s AND branch = %s", (username, branch))
    return {"status": "switched", "username": username, "branch": branch}

@router.delete("/assign/branch/{username}")
def unassign_branch(username: str, x_service_token: str = Header(...)):
    """Admin removes all branch assignments for a developer."""
    verify_service_token(x_service_token)
    with get_conn() as conn:
        with conn.cursor() as cur:
            cur.execute("DELETE FROM branch_assignments WHERE username = %s", (username,))
    return {"status": "unassigned", "username": username}

@router.get("/assign/branches")
def list_branch_assignments(x_service_token: str = Header(...)):
    """Admin views all branch assignments."""
    verify_service_token(x_service_token)
    with get_conn() as conn:
        with conn.cursor() as cur:
            cur.execute("SELECT username, branch, active, assigned_at FROM branch_assignments ORDER BY username, assigned_at DESC")
            return {"assignments": [{"username": r[0], "branch": r[1], "active": r[2], "assigned_at": r[3]} for r in cur.fetchall()]}

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
    # push instant notification over WebSocket if developer is connected
    try:
        from main import ws_manager
        import asyncio
        asyncio.get_event_loop().create_task(ws_manager.notify(payload.username, {
            "type": "new_task",
            "task_id": task_id,
            "function": payload.function,
            "branch": payload.branch,
        }))
    except Exception:
        pass
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
