# checker.py
import requests
import subprocess
import time
from port_registry import tear_down, load

def get_port(branch):
    return load().get(branch)

def wait_for_container(port, retries=10, delay=2):
    """Wait until the container is actually ready to accept requests."""
    for i in range(retries):
        try:
            r = requests.get(f"http://localhost:{port}/health", timeout=2)
            if r.status_code == 200:
                print(f"Container ready on port {port}")
                return True
        except requests.exceptions.ConnectionError:
            print(f"Waiting for container... ({i+1}/{retries})")
            time.sleep(delay)
    return False

def run_checks(port, branch):
    """Run all validation checks against the container."""
    results = {}

    # 1. Health check
    try:
        r = requests.get(f"http://localhost:{port}/health", timeout=5)
        results["health"] = r.status_code == 200
    except:
        results["health"] = False

    # 2. Register a test user
    try:
        r = requests.post(f"http://localhost:{port}/auth/register", json={
            "username": "test-user",
            "password": "test-pass",
            "role": "developer"
        })
        results["register"] = r.status_code == 200
    except:
        results["register"] = False

    # 3. Login and get token
    token = None
    try:
        r = requests.post(f"http://localhost:{port}/auth/login", json={
            "username": "test-user",
            "password": "test-pass"
        })
        results["login"] = r.status_code == 200
        token = r.json().get("token")
    except:
        results["login"] = False

    # 4. Access protected route
    try:
        r = requests.get(
            f"http://localhost:{port}/secure/data",
            headers={"Authorization": f"Bearer {token}"},
            timeout=5
        )
        results["auth_access"] = r.status_code == 200
    except:
        results["auth_access"] = False

    # 5. Verify policy blocks unauthorized action (developer can't delete)
    try:
        r = requests.delete(
            f"http://localhost:{port}/secure/data",
            headers={"Authorization": f"Bearer {token}"},
            timeout=5
        )
        results["policy_enforced"] = r.status_code == 403
    except:
        results["policy_enforced"] = False

    # 6. Port conflict check
    active = subprocess.run(
        ["docker", "ps", "--filter", f"name=simmsilos-{branch}", "--format", "{{.Ports}}"],
        capture_output=True, text=True
    )
    results["port_owned"] = str(port) in active.stdout

    return results

def flush_results(branch, port, results):
    """Persist results before container is destroyed."""
    import json, os
    os.makedirs("results", exist_ok=True)
    path = f"results/{branch}.json"
    with open(path, "w") as f:
        json.dump({"branch": branch, "port": port, "checks": results}, f, indent=2)
    print(f"Results saved to {path}")

def run_and_teardown(branch, port=None):
    """Full lifecycle: wait → check → flush → destroy → free port."""
    if port is None:
        port = get_port(branch)
    if port is None:
        print(f"No port registered for branch '{branch}'")
        return False
    ready = wait_for_container(port)

    if not ready:
        print(f"Container never became ready — tearing down")
        flush_results(branch, port, {"ready": False})
        tear_down(branch)
        return False

    results = run_checks(port, branch)
    passed = all(results.values())

    print(f"Checks {'PASSED' if passed else 'FAILED'}:", results)

    # always flush before destroy — data must survive teardown
    flush_results(branch, port, results)
    tear_down(branch)

    return passed