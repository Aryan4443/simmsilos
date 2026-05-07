# main.py
import os
from port_registry import spin_up
from checker import run_and_teardown

branch = "feature-x"
image = "simmsilos-auth:latest"

port = spin_up(branch, image, env_vars={
    "NODE_ENV": "test",
    "JWT_SECRET": os.getenv("JWT_SECRET", "change-me-local-jwt-secret"),
    "SERVICE_TOKEN": os.getenv("SERVICE_TOKEN", "change-me-local-service-token"),
    "DB_HOST": "simmsilos-postgres",
    "DB_NAME": "simmsilos",
    "DB_USER": "postgres",
    "DB_PASSWORD": "secret",
    "REDIS_HOST": "simmsilos-redis",
})
passed = run_and_teardown(branch, port)

print("Pipeline result:", "✓ passed" if passed else "✗ failed")
