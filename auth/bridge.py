import os
import requests
from fastapi import APIRouter, HTTPException, Depends
from security import validate_relative_path
from sync import verify_service_token

router = APIRouter(
    prefix="/bridge",
    tags=["bridge"],
    dependencies=[Depends(verify_service_token)],
)

YOUR_API     = os.getenv("OWN_SERVICE_URL", "http://simmsilos-feature-x:3000")
PARTNER_API  = os.getenv("PARTNER_SERVICE_URL", "http://simmsilos-admin:5000")

def _service_headers():
    token = os.getenv("SERVICE_TOKEN")
    return {"X-Service-Token": token} if token else {}

def _get(base: str, path: str, **kwargs):
    try:
        r = requests.get(f"{base}{path}", timeout=5, **kwargs)
        r.raise_for_status()
        return r.json()
    except Exception as e:
        raise HTTPException(status_code=502, detail=f"Upstream error: {str(e)}")

def _post(base: str, path: str, **kwargs):
    try:
        r = requests.post(f"{base}{path}", timeout=5, **kwargs)
        r.raise_for_status()
        return r.json()
    except Exception as e:
        raise HTTPException(status_code=502, detail=f"Upstream error: {str(e)}")

# ── your endpoints exposed to partner ────────────────────

@router.get("/users")
def bridge_get_users():
    """Partner calls this to get all users from your side."""
    return _get(YOUR_API, "/sync/users", headers=_service_headers())

@router.get("/audit")
def bridge_get_audit():
    """Partner calls this to get audit logs from your side."""
    return _get(YOUR_API, "/sync/audit", headers=_service_headers())

@router.get("/tasks")
def bridge_get_tasks():
    """Partner calls this to see all task assignments."""
    return _get(YOUR_API, "/sync/assign/tasks", headers=_service_headers())

@router.get("/branches")
def bridge_get_branches():
    """Partner calls this to see all branch assignments."""
    return _get(YOUR_API, "/sync/assign/branches", headers=_service_headers())

# ── partner endpoints exposed to your side ───────────────

@router.get("/partner/health")
def bridge_partner_health():
    """Check if partner's service is up."""
    return _get(PARTNER_API, "/health")

@router.get("/partner/files")
def bridge_partner_files(username: str, projectName: str, path: str = ""):
    """Get files from partner's silo service."""
    path = validate_relative_path(path)
    return _get(PARTNER_API, "/files", params={
        "username": username,
        "projectName": projectName,
        "path": path
    })

@router.post("/partner/sync")
def bridge_partner_sync(body: dict):
    """Trigger a silo sync on partner's side."""
    return _post(PARTNER_API, "/syncFromProject", json=body)
