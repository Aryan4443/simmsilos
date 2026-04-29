import os, time, json
from db import get_conn

def record(event: str, user: str, detail: dict = {}):
    branch = os.getenv("BRANCH", "unknown")
    with get_conn() as conn:
        with conn.cursor() as cur:
            cur.execute(
                """INSERT INTO audit_logs (timestamp, event, username, branch, detail)
                   VALUES (%s, %s, %s, %s, %s)""",
                (time.time(), event, user, branch, json.dumps(detail))
            )

def flush(branch: str):
    # no-op — logs go directly to Postgres now
    print(f"Audit log is live in Postgres (branch={branch})")
