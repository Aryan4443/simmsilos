# port_registry.py
import subprocess, json, os, time, urllib.request

PORT_RANGE = range(3000, 4000)
REGISTRY_FILE = "ports.json"
NGINX_CONF = "nginx/nginx.conf"
NGINX_CONTAINER = "simmsilos-gateway"
DOCKER_NETWORK = "simmsilos-net"

def _render_nginx(registry):
    locations = ""
    for branch in registry:
        locations += f"""
        location /branch/{branch}/ {{
            rewrite ^/branch/{branch}/(.*) /$1 break;
            proxy_pass http://simmsilos-{branch}:3000;
            proxy_set_header Host $host;
            proxy_set_header X-Real-IP $remote_addr;
            proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
            proxy_set_header X-Branch {branch};
        }}
"""
    return f"""events {{}}

http {{
    server {{
        listen 80;

        location /gateway/health {{
            return 200 '{{"status":"ok","gateway":"nginx"}}';
            add_header Content-Type application/json;
        }}
{locations}
        location / {{
            return 404 '{{"error":"unknown branch — use /branch/<name>/"}}';
            add_header Content-Type application/json;
        }}
    }}
}}
"""

def _reload_nginx():
    subprocess.run(
        ["docker", "exec", NGINX_CONTAINER, "nginx", "-s", "reload"],
        capture_output=True
    )

def _sync_nginx():
    registry = load()
    os.makedirs("nginx", exist_ok=True)
    with open(NGINX_CONF, "w") as f:
        f.write(_render_nginx(registry))
    _reload_nginx()
    print(f"Nginx config updated ({len(registry)} branches)")

def load():
    if not os.path.exists(REGISTRY_FILE):
        return {}
    return json.load(open(REGISTRY_FILE))

def save(data):
    json.dump(data, open(REGISTRY_FILE, "w"))

def assign(branch):
    registry = load()
    used = set(registry.values())
    for port in PORT_RANGE:
        if port not in used:
            registry[branch] = port
            save(registry)
            return port
    raise Exception("No free ports")

def release(branch):
    registry = load()
    registry.pop(branch, None)
    save(registry)

def _wait_ready(port, retries=15, delay=2):
    for i in range(retries):
        try:
            urllib.request.urlopen(f"http://localhost:{port}/health", timeout=2)
            print(f"Container ready on port {port}")
            return
        except Exception:
            print(f"Waiting for container... ({i+1}/{retries})")
            time.sleep(delay)
    raise Exception(f"Container on port {port} never became ready")

def spin_up(branch, image, env_file=".env", env_vars=None):
    # remove any existing container for this branch before starting fresh
    subprocess.run(["docker", "rm", "-f", f"simmsilos-{branch}"],
                   capture_output=True)
    release(branch)
    port = assign(branch)
    cmd = [
        "docker", "run", "-d",
        "--name", f"simmsilos-{branch}",
        "--network", DOCKER_NETWORK,
        "-p", f"{port}:3000",
        "-e", f"BRANCH={branch}",
    ]
    if os.path.exists(env_file):
        cmd += ["--env-file", env_file]
    for k, v in (env_vars or {}).items():
        cmd += ["-e", f"{k}={v}"]
    cmd.append(image)
    result = subprocess.run(cmd, capture_output=True, text=True)
    if result.returncode != 0:
        release(branch)
        raise Exception(f"docker run failed: {result.stderr.strip()}")
    _sync_nginx()
    _wait_ready(port)
    return port

def restart(branch, image, env_file=".env", env_vars=None):
    tear_down(branch)
    return spin_up(branch, image, env_file, env_vars)

def tear_down(branch):
    subprocess.run(["docker", "rm", "-f", f"simmsilos-{branch}"])
    release(branch)
    _sync_nginx()
    print(f"Port freed for branch {branch}")