import re, os
from pathlib import PurePosixPath
from fastapi import HTTPException, Request
import redis

# ── rate limiting (Redis-backed) ──────────────────────────
RATE_LIMIT = 60  # requests per minute per IP
_redis = redis.Redis(host=os.getenv("REDIS_HOST", "localhost"), port=6379, decode_responses=True)

def check_rate_limit(ip: str):
    key = f"rate:{ip}"
    count = _redis.incr(key)
    if count == 1:
        _redis.expire(key, 60)
    if count > RATE_LIMIT:
        raise HTTPException(status_code=429, detail="Rate limit exceeded")

# ── threat detection ──────────────────────────────────────
THREAT_PATTERNS = [
    r"(--|;|'|\"|\/\*)",          # SQL injection
    r"(<script|javascript:)",     # XSS
    r"(\.\./|\.\.\\)",            # path traversal
    r"(eval\(|exec\(|import os)", # code injection
]

def scan_input(value: str):
    for pattern in THREAT_PATTERNS:
        if re.search(pattern, value, re.IGNORECASE):
            raise HTTPException(status_code=400, detail="Threat pattern detected in input")

def validate_relative_path(path: str) -> str:
    """Allow only normalized relative POSIX paths for silo file access."""
    if not isinstance(path, str):
        raise HTTPException(status_code=400, detail="path must be a string")
    if "\x00" in path or ":" in path:
        raise HTTPException(status_code=400, detail="Invalid silo path")
    normalized = PurePosixPath(path.replace("\\", "/"))
    parts = normalized.parts
    if path.startswith("/") or any(part in ("..", "") for part in parts):
        raise HTTPException(status_code=400, detail="Invalid silo path")
    return normalized.as_posix() if normalized.as_posix() != "." else ""

def scan_request(request: Request):
    check_rate_limit(request.client.host)
    for key, val in request.query_params.items():
        scan_input(val)

# ── middleware to attach to FastAPI ───────────────────────
async def security_middleware(request: Request, call_next):
    scan_request(request)
    response = await call_next(request)
    response.headers["X-Content-Type-Options"] = "nosniff"
    response.headers["X-Frame-Options"] = "DENY"
    response.headers["X-Branch"] = os.getenv("BRANCH", "unknown")
    return response
