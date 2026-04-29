# main.py
from port_registry import spin_up
from checker import run_and_teardown

branch = "feature-x"
image = "simmsilos-auth:latest"

port = spin_up(branch, image, env_vars={
    "NODE_ENV": "test",
    "JWT_SECRET": "dev-secret",
    "SERVICE_TOKEN": "NKN8pN4iVtWAKAyJqwHb5Xp4n397MFiCghUZEWDW9bw",
    "DB_HOST": "simmsilos-postgres",
    "DB_NAME": "simmsilos",
    "DB_USER": "postgres",
    "DB_PASSWORD": "secret",
})
passed = run_and_teardown(branch, port)

print("Pipeline result:", "✓ passed" if passed else "✗ failed")
