from flask import Flask, render_template, request, redirect, session, url_for, flash
import requests, os

app = Flask(__name__)
app.secret_key = os.getenv("ADMIN_SECRET", "admin-dev-secret")

API = os.getenv("API_URL", "http://localhost:3000")
SERVICE_TOKEN = os.getenv("SERVICE_TOKEN", "NKN8pN4iVtWAKAyJqwHb5Xp4n397MFiCghUZEWDW9bw")

def svc_headers():
    return {"X-Service-Token": SERVICE_TOKEN}

def api_headers():
    return {"Authorization": f"Bearer {session.get('token', '')}"}

def svc(method, path, **kwargs):
    r = getattr(requests, method)(f"{API}{path}", headers=svc_headers(), timeout=5, **kwargs)
    r.raise_for_status()
    return r.json()

def apicall(method, path, **kwargs):
    r = getattr(requests, method)(f"{API}{path}", headers=api_headers(), timeout=5, **kwargs)
    r.raise_for_status()
    return r.json()

def login_required(f):
    from functools import wraps
    @wraps(f)
    def wrapper(*args, **kwargs):
        if "token" not in session:
            return redirect(url_for("login"))
        return f(*args, **kwargs)
    return wrapper

# ── auth ──────────────────────────────────────────────────

@app.route("/", methods=["GET", "POST"])
def login():
    if request.method == "POST":
        try:
            r = requests.post(f"{API}/auth/login", json={
                "username": request.form["username"],
                "password": request.form["password"],
            }, timeout=5)
            r.raise_for_status()
            data = r.json()
            if data.get("role") != "admin":
                flash("Access denied — admin role required")
                return render_template("login.html")
            session["token"] = data["token"]
            session["username"] = request.form["username"]
            return redirect(url_for("dashboard"))
        except:
            flash("Invalid credentials")
    return render_template("login.html")

@app.route("/logout")
def logout():
    session.clear()
    return redirect(url_for("login"))

# ── dashboard ─────────────────────────────────────────────

@app.route("/dashboard")
@login_required
def dashboard():
    users = svc("get", "/sync/users").get("users", [])
    tasks = svc("get", "/sync/assign/tasks").get("tasks", [])
    branches = svc("get", "/sync/assign/branches").get("assignments", [])
    logs = svc("get", "/sync/audit").get("logs", [])[:5]
    stats = {
        "total_users": len(users),
        "total_tasks": len(tasks),
        "pending": sum(1 for t in tasks if t["status"] == "pending"),
        "in_progress": sum(1 for t in tasks if t["status"] == "in_progress"),
        "done": sum(1 for t in tasks if t["status"] == "done"),
        "assigned_branches": len(branches),
    }
    return render_template("dashboard.html", stats=stats, recent_logs=logs, username=session["username"])

# ── users ─────────────────────────────────────────────────

@app.route("/users")
@login_required
def users():
    users = svc("get", "/sync/users").get("users", [])
    branches = {a["username"]: a["branch"] for a in svc("get", "/sync/assign/branches").get("assignments", [])}
    return render_template("users.html", users=users, branches=branches)

@app.route("/users/register", methods=["POST"])
@login_required
def register_user():
    username = request.form["username"]
    try:
        requests.post(f"{API}/auth/register", json={
            "username": username,
            "password": request.form["password"],
            "role": request.form["role"],
        }, timeout=5).raise_for_status()
        flash(f"User '{username}' created")

        branch = request.form.get("branch", "").strip()
        if branch:
            svc("post", "/sync/assign/branch", json={"username": username, "branch": branch})
            flash(f"Branch '{branch}' assigned")

        first_task = request.form.get("first_task", "").strip()
        if first_task and branch:
            svc("post", "/sync/assign/task", json={"username": username, "branch": branch, "function": first_task})
            flash(f"Task '{first_task}' assigned")
    except Exception as e:
        flash(f"Error: {e}")
    return redirect(url_for("users"))

@app.route("/users/<username>/delete", methods=["POST"])
@login_required
def delete_user(username):
    try:
        apicall("delete", f"/admin/users/{username}")
        flash(f"User '{username}' deleted")
    except Exception as e:
        flash(f"Error: {e}")
    return redirect(url_for("users"))

@app.route("/users/<username>/role", methods=["POST"])
@login_required
def update_role(username):
    try:
        svc("patch", f"/sync/users/{username}/role", json={"role": request.form["role"]})
        flash(f"Role updated for '{username}'")
    except Exception as e:
        flash(f"Error: {e}")
    return redirect(url_for("users"))

# ── branch assignment ─────────────────────────────────────

@app.route("/branches")
@login_required
def branches():
    assignments = svc("get", "/sync/assign/branches").get("assignments", [])
    users = svc("get", "/sync/users").get("users", [])
    return render_template("branches.html", assignments=assignments, users=users)

@app.route("/branches/assign", methods=["POST"])
@login_required
def assign_branch():
    try:
        svc("post", "/sync/assign/branch", json={
            "username": request.form["username"],
            "branch": request.form["branch"],
        })
        flash(f"Branch '{request.form['branch']}' assigned to '{request.form['username']}'")
    except Exception as e:
        flash(f"Error: {e}")
    return redirect(url_for("branches"))

@app.route("/branches/<username>/unassign", methods=["POST"])
@login_required
def unassign_branch(username):
    try:
        svc("delete", f"/sync/assign/branch/{username}")
        flash(f"Branch unassigned from '{username}'")
    except Exception as e:
        flash(f"Error: {e}")
    return redirect(url_for("branches"))

# ── tasks ─────────────────────────────────────────────────

@app.route("/tasks")
@login_required
def tasks():
    tasks = svc("get", "/sync/assign/tasks").get("tasks", [])
    users = svc("get", "/sync/users").get("users", [])
    return render_template("tasks.html", tasks=tasks, users=users)

@app.route("/tasks/assign", methods=["POST"])
@login_required
def assign_task():
    try:
        svc("post", "/sync/assign/task", json={
            "username": request.form["username"],
            "branch": request.form["branch"],
            "function": request.form["function"],
        })
        flash("Task assigned")
    except Exception as e:
        flash(f"Error: {e}")
    return redirect(url_for("tasks"))

@app.route("/tasks/<int:task_id>/status", methods=["POST"])
@login_required
def update_task_status(task_id):
    try:
        svc("patch", f"/sync/assign/task/{task_id}/status", json={"status": request.form["status"]})
        flash("Task status updated")
    except Exception as e:
        flash(f"Error: {e}")
    return redirect(url_for("tasks"))

# ── audit log ─────────────────────────────────────────────

@app.route("/audit")
@login_required
def audit():
    logs = svc("get", "/sync/audit").get("logs", [])
    return render_template("audit.html", logs=logs)

if __name__ == "__main__":
    app.run(host="0.0.0.0", port=8000, debug=True)
