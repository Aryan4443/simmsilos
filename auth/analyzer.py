import re
from fastapi import HTTPException

# ── prompt injection detection ─
INJECTION_PATTERNS = [
    r"ignore (previous|above|all) instructions",
    r"you are now",
    r"jailbreak",
    r"pretend (you are|to be)",
    r"disregard your",
    r"system prompt",
]

def detect_prompt_injection(text: str) -> bool:
    for pattern in INJECTION_PATTERNS:
        if re.search(pattern, text, re.IGNORECASE):
            return True
    return False

# ── PII detection ─
PII_PATTERNS = {
    "email":       r"[a-zA-Z0-9_.+-]+@[a-zA-Z0-9-]+\.[a-zA-Z0-9-.]+",
    "ssn":         r"\b\d{3}-\d{2}-\d{4}\b",
    "credit_card": r"\b(?:\d{4}[- ]?){3}\d{4}\b",
    "phone":       r"\b\d{3}[-.]?\d{3}[-.]?\d{4}\b",
}

def detect_pii(text: str) -> dict:
    found = {}
    for label, pattern in PII_PATTERNS.items():
        if re.search(pattern, text):
            found[label] = "detected"
    return found

# ── hallucination risk scoring ─
HALLUCINATION_FLAGS = [
    "as of my last update",
    "i believe",
    "i think",
    "i'm not sure but",
    "it's possible that",
]

def score_hallucination_risk(text: str) -> dict:
    text_lower = text.lower()
    flags = [f for f in HALLUCINATION_FLAGS if f in text_lower]
    score = len(flags) / len(HALLUCINATION_FLAGS)
    return {
        "risk_score": round(score, 2),
        "flags_found": flags,
        "risk_level": "high" if score > 0.4 else "medium" if score > 0.1 else "low"
    }

# ── combined analysis ──
def analyze(text: str) -> dict:
    injection = detect_prompt_injection(text)
    pii = detect_pii(text)
    hallucination = score_hallucination_risk(text)

    blocked = injection or bool(pii)

    return {
        "blocked": blocked,
        "prompt_injection": injection,
        "pii_detected": pii,
        "hallucination_risk": hallucination,
    }
