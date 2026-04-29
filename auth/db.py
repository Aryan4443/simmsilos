import os
import psycopg2
from psycopg2.extras import RealDictCursor

def get_conn():
    return psycopg2.connect(
        host=os.getenv("DB_HOST", "localhost"),
        port=os.getenv("DB_PORT", 5432),
        dbname=os.getenv("DB_NAME", "simmsilos"),
        user=os.getenv("DB_USER", "postgres"),
        password=os.getenv("DB_PASSWORD", ""),
    )

def init_db():
    with get_conn() as conn:
        with conn.cursor() as cur:
            cur.execute("""
                CREATE TABLE IF NOT EXISTS users (
                    username TEXT PRIMARY KEY,
                    password TEXT NOT NULL,
                    role     TEXT NOT NULL DEFAULT 'developer'
                )
            """)
            cur.execute("""
                CREATE TABLE IF NOT EXISTS audit_logs (
                    id        SERIAL PRIMARY KEY,
                    timestamp DOUBLE PRECISION NOT NULL,
                    event     TEXT NOT NULL,
                    username  TEXT NOT NULL,
                    branch    TEXT NOT NULL,
                    detail    JSONB
                )
            """)
            cur.execute("""
                CREATE TABLE IF NOT EXISTS branch_assignments (
                    id         SERIAL PRIMARY KEY,
                    username   TEXT NOT NULL REFERENCES users(username) ON DELETE CASCADE,
                    branch     TEXT NOT NULL,
                    assigned_at DOUBLE PRECISION NOT NULL,
                    UNIQUE(username)
                )
            """)
            cur.execute("""
                CREATE TABLE IF NOT EXISTS task_assignments (
                    id         SERIAL PRIMARY KEY,
                    username   TEXT NOT NULL REFERENCES users(username) ON DELETE CASCADE,
                    branch     TEXT NOT NULL,
                    function   TEXT NOT NULL,
                    status     TEXT NOT NULL DEFAULT 'pending',
                    assigned_at DOUBLE PRECISION NOT NULL
                )
            """)

def get_user(username: str) -> dict | None:
    with get_conn() as conn:
        with conn.cursor(cursor_factory=RealDictCursor) as cur:
            cur.execute("SELECT * FROM users WHERE username = %s", (username,))
            return cur.fetchone()

def create_user(username: str, password: str, role: str):
    with get_conn() as conn:
        with conn.cursor() as cur:
            cur.execute(
                "INSERT INTO users (username, password, role) VALUES (%s, %s, %s)",
                (username, password, role)
            )

def user_exists(username: str) -> bool:
    return get_user(username) is not None
