import re

BLOCKED_PATTERNS = [
    r"rm\s+-rf",
    r"os\.system",
    r"subprocess",
    r"__import__",
    r"exec\(",
    r"eval\(",
]

DEPENDENCY_MAP = {
    "auth": ["security", "audit", "ai_risk"],
    "gateway": ["auth", "ai_risk"],
}

def process_code_submission(code: str, user: dict) -> dict:
    for pattern in BLOCKED_PATTERNS:
        if re.search(pattern, code, re.IGNORECASE):
            return {"allowed": False, "reason": f"Blocked pattern: {pattern}", "submitted_by": user["sub"]}
    return {"allowed": True, "submitted_by": user["sub"]}

def map_dependencies() -> dict:
    return DEPENDENCY_MAP
