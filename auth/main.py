# auth/main.py
from contextlib import asynccontextmanager
from fastapi import FastAPI, HTTPException, Depends
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from starlette.middleware.base import BaseHTTPMiddleware
from pydantic import BaseModel
import jwt, hashlib, os, time
from security import security_middleware
from gateway import process_code_submission
from ai_risk import analyze
from audit import record, flush
from db import init_db, get_conn, get_user, create_user, user_exists
from sync import router as sync_router
import silo_client

@asynccontextmanager
async def lifespan(_):
    init_db()
    yield
    flush(os.getenv("BRANCH", "unknown"))

app = FastAPI(lifespan=lifespan)
app.add_middleware(BaseHTTPMiddleware, dispatch=security_middleware)
app.include_router(sync_router)
security = HTTPBearer()

SECRET = os.getenv("JWT_SECRET", "dev-secret")

def hash_password(pw):
    return hashlib.sha256(pw.encode()).hexdigest()

def make_token(user_id, role):
    payload = {
        "sub": user_id,
        "role": role,
        "branch": os.getenv("BRANCH", "unknown"),
        "exp": time.time() + 3600  # 1 hour
    }
    return jwt.encode(payload, SECRET, algorithm="HS256")

def decode_token(token):
    try:
        return jwt.decode(token, SECRET, algorithms=["HS256"])
    except jwt.ExpiredSignatureError:
        raise HTTPException(status_code=401, detail="Token expired")
    except jwt.InvalidTokenError:
        raise HTTPException(status_code=401, detail="Invalid token")

# ── policy layer ─────────────────────────────────────────

POLICIES = {
    "admin": ["read", "write", "delete", "deploy"],
    "developer": ["read", "write"],
    "viewer": ["read"],
}

def enforce(role: str, action: str):
    allowed = POLICIES.get(role, [])
    if action not in allowed:
        raise HTTPException(
            status_code=403,
            detail=f"Role '{role}' is not permitted to '{action}'"
        )

def get_current_user(
    credentials: HTTPAuthorizationCredentials = Depends(security)
):
    return decode_token(credentials.credentials)

# ── routes ───────────────────────────────────────────────

class RegisterRequest(BaseModel):
    username: str
    password: str
    role: str = "developer"  # default role

class LoginRequest(BaseModel):
    username: str
    password: str

@app.get("/health")
def health():
    return {"status": "ok", "branch": os.getenv("BRANCH")}

@app.post("/auth/register")
def register(req: RegisterRequest):
    if req.role not in POLICIES:
        raise HTTPException(status_code=400, detail=f"Unknown role '{req.role}'")
    if user_exists(req.username):
        raise HTTPException(status_code=400, detail="User already exists")
    create_user(req.username, hash_password(req.password), req.role)
    return {"message": f"User '{req.username}' created with role '{req.role}'"}

@app.post("/auth/login")
def login(req: LoginRequest):
    user = get_user(req.username)
    if not user or user["password"] != hash_password(req.password):
        raise HTTPException(status_code=401, detail="Invalid credentials")
    token = make_token(req.username, user["role"])
    return {"token": token, "role": user["role"]}

@app.post("/auth/refresh")
def refresh(user=Depends(get_current_user)):
    token = make_token(user["sub"], user["role"])
    return {"token": token, "role": user["role"]}

@app.get("/secure/data")
def read_data(user=Depends(get_current_user)):
    enforce(user["role"], "read")
    return {"data": "sensitive content", "accessed_by": user["sub"]}

@app.delete("/secure/data")
def delete_data(user=Depends(get_current_user)):
    enforce(user["role"], "delete")
    return {"message": f"Deleted by {user['sub']}"}

# ── gateway routes ────────────────────────────────────────

class CodeRequest(BaseModel):
    code: str

class AIRequest(BaseModel):
    text: str

@app.post("/gateway/submit")
def submit_code(req: CodeRequest, user=Depends(get_current_user)):
    result = process_code_submission(req.code, user)
    record("code_submission", user["sub"], result)
    if not result["allowed"]:
        raise HTTPException(status_code=400, detail=result)
    return result

@app.post("/gateway/ai-risk")
def ai_risk(req: AIRequest, user=Depends(get_current_user)):
    result = analyze(req.text)
    record("ai_risk_check", user["sub"], result)
    if result["blocked"]:
        raise HTTPException(status_code=400, detail=result)
    return result

@app.get("/gateway/dependencies")
def dependencies(user=Depends(get_current_user)):
    from gateway import map_dependencies
    enforce(user["role"], "read")
    return map_dependencies()

# ── developer endpoints ───────────────────────────────────

@app.get("/my/branch")
def my_branch(user=Depends(get_current_user)):
    """Developer sees their assigned branch."""
    with get_conn() as conn:
        with conn.cursor() as cur:
            cur.execute("SELECT branch FROM branch_assignments WHERE username = %s", (user["sub"],))
            row = cur.fetchone()
    if not row:
        raise HTTPException(status_code=404, detail="No branch assigned yet")
    return {"username": user["sub"], "branch": row[0]}

@app.get("/my/tasks")
def my_tasks(user=Depends(get_current_user)):
    """Developer sees their assigned tasks."""
    with get_conn() as conn:
        with conn.cursor() as cur:
            cur.execute("""
                SELECT id, branch, function, status, assigned_at
                FROM task_assignments WHERE username = %s ORDER BY assigned_at DESC
            """, (user["sub"],))
            rows = cur.fetchall()
    return {"tasks": [{"id": r[0], "branch": r[1], "function": r[2], "status": r[3], "assigned_at": r[4]} for r in rows]}

# ── vscode extension bootstrap endpoints ─────────────────

@app.get("/me")
def me(user=Depends(get_current_user)):
    """Single call on extension startup — returns everything the extension needs."""
    with get_conn() as conn:
        with conn.cursor() as cur:
            cur.execute("SELECT branch FROM branch_assignments WHERE username = %s", (user["sub"],))
            branch_row = cur.fetchone()
            cur.execute("""
                SELECT id, branch, function, status, assigned_at
                FROM task_assignments WHERE username = %s ORDER BY assigned_at DESC
            """, (user["sub"],))
            tasks = cur.fetchall()
    token_expires_in = int(user["exp"] - time.time())
    return {
        "username": user["sub"],
        "role": user["role"],
        "branch": branch_row[0] if branch_row else None,
        "tasks": [{"id": r[0], "branch": r[1], "function": r[2], "status": r[3], "assigned_at": r[4]} for r in tasks],
        "token_expires_in": token_expires_in,
        "should_refresh": token_expires_in < 300,
    }

@app.patch("/my/tasks/{task_id}/status")
def update_my_task_status(task_id: int, body: dict, user=Depends(get_current_user)):
    """Developer marks their own task as in_progress or done from VS Code."""
    status = body.get("status")
    if status not in ("in_progress", "done"):
        raise HTTPException(status_code=400, detail="status must be in_progress or done")
    with get_conn() as conn:
        with conn.cursor() as cur:
            cur.execute("""
                UPDATE task_assignments SET status = %s
                WHERE id = %s AND username = %s
            """, (status, task_id, user["sub"]))
            if cur.rowcount == 0:
                raise HTTPException(status_code=404, detail="Task not found or not yours")
    record("task_status_update", user["sub"], {"task_id": task_id, "status": status})
    return {"task_id": task_id, "status": status}

# ── silo endpoints (VS Code extension) ───────────────────

def _get_assigned_project(username: str) -> str:
    with get_conn() as conn:
        with conn.cursor() as cur:
            cur.execute("SELECT branch FROM branch_assignments WHERE username = %s", (username,))
            row = cur.fetchone()
    if not row:
        raise HTTPException(status_code=404, detail="No branch assigned — contact admin")
    return row[0]

@app.get("/silo/files")
def silo_list_files(path: str = "", user=Depends(get_current_user)):
    project = _get_assigned_project(user["sub"])
    return silo_client.list_files(user["sub"], project, path)

@app.get("/silo/file")
def silo_read_file(path: str, user=Depends(get_current_user)):
    project = _get_assigned_project(user["sub"])
    return silo_client.read_file(user["sub"], project, path)

class WriteFileRequest(BaseModel):
    path: str
    content: str
    overwrite: bool = True

@app.post("/silo/file")
def silo_write_file(req: WriteFileRequest, user=Depends(get_current_user)):
    project = _get_assigned_project(user["sub"])
    result = silo_client.write_file(user["sub"], project, req.path, req.content, req.overwrite)
    record("silo_write", user["sub"], {"project": project, "path": req.path})
    return result

@app.post("/silo/sync")
def silo_sync(user=Depends(get_current_user)):
    project = _get_assigned_project(user["sub"])
    result = silo_client.sync_from_project(user["sub"], project)
    record("silo_sync", user["sub"], {"project": project})
    return result

# ── admin endpoints (require admin role) ─────────────────

@app.get("/admin/users")
def list_users(user=Depends(get_current_user)):
    enforce(user["role"], "delete")  # only admins have delete
    with get_conn() as conn:
        with conn.cursor() as cur:
            cur.execute("SELECT username, role FROM users")
            return {"users": [{"username": r[0], "role": r[1]} for r in cur.fetchall()]}

@app.delete("/admin/users/{username}")
def delete_user(username: str, user=Depends(get_current_user)):
    enforce(user["role"], "delete")
    with get_conn() as conn:
        with conn.cursor() as cur:
            cur.execute("DELETE FROM users WHERE username = %s", (username,))
    record("admin_delete_user", user["sub"], {"target": username})
    return {"message": f"User '{username}' deleted"}

@app.get("/admin/audit")
def get_audit_logs(user=Depends(get_current_user)):
    enforce(user["role"], "delete")
    with get_conn() as conn:
        with conn.cursor() as cur:
            cur.execute("SELECT event, username, branch, detail, timestamp FROM audit_logs ORDER BY timestamp DESC LIMIT 100")
            rows = cur.fetchall()
            return {"logs": [{"event": r[0], "user": r[1], "branch": r[2], "detail": r[3], "timestamp": r[4]} for r in rows]}