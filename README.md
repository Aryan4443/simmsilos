# SimmSilos

An internal developer management system. Admins assign developers to branches and tasks. Developers use a VS Code extension to view their work and edit files directly inside their isolated silo environment.

---

## Architecture

```
Developer → VS Code Extension → FastAPI (auth/silo/tasks)
                                        ↓
Admin → Admin Panel → /sync/* endpoints (service token)
                                        ↓
                         Postgres + Redis (shared state)
                                        ↓
                      Partner's silosvsc (file system)
                                        ↓
                      Apache (gateway — routes all traffic)
```

---

## Project Structure

```
simmsilos/
├── auth/
│   ├── main.py          # FastAPI app — all routes
│   ├── db.py            # Postgres connection + table setup
│   ├── security.py      # Rate limiting (Redis), threat detection, headers
│   ├── audit.py         # Audit logging → Postgres
│   ├── sync.py          # Service-to-service API (admin side)
│   ├── bridge.py        # Bridge API connecting both sides
│   ├── silo_client.py   # HTTP client for partner's silo service
│   ├── gateway.py       # Code submission scanner
│   ├── ai_risk.py       # Prompt injection, PII, hallucination detection
│   └── analyzer.py      # Combined AI analysis
├── extension/           # VS Code extension (TypeScript)
│   └── src/
│       ├── extension.ts       # Entry point
│       ├── api.ts             # API client
│       ├── auth.ts            # Login, token management
│       ├── tasksProvider.ts   # Tasks sidebar
│       ├── filesProvider.ts   # Silo file tree
│       └── siloFs.ts          # Virtual filesystem (save support)
├── apache/
│   └── httpd.conf       # Apache gateway config
├── .github/workflows/
│   ├── ci.yml           # Run pipeline checks on every PR
│   └── docker.yml       # Build + push Docker image on push to main
├── main.py              # Pipeline runner (spin up → check → tear down)
├── checker.py           # Automated checks (health, auth, policy)
├── port_registry.py     # Port assignment per branch
├── Dockerfile
└── docker-compose.yml
```

---

## Quick Start

**Prerequisites:** Docker, Docker Compose

```bash
# 1. Clone the repo
git clone https://github.com/Aryan4443/simmsilos.git
cd simmsilos

# 2. Create the Docker network
docker network create simmsilos-net

# 3. Start all services
docker compose up --build -d
```

Services that start:
| Service | Container | Port |
|---|---|---|
| FastAPI auth | simmsilos-feature-x | 3000 |
| Postgres | simmsilos-postgres | internal |
| Redis | simmsilos-redis | internal |
| Apache gateway | simmsilos-gateway | 80 |

---

## API Endpoints

### Auth (JWT required except login/register)

| Method | Endpoint | Description |
|---|---|---|
| `POST` | `/auth/register` | Register a new user |
| `POST` | `/auth/login` | Login, returns JWT token |
| `POST` | `/auth/refresh` | Refresh JWT before expiry |
| `GET` | `/me` | Get profile, branch, tasks, token expiry |
| `GET` | `/health` | Health check |

### Developer

| Method | Endpoint | Description |
|---|---|---|
| `GET` | `/my/branch` | See assigned branch |
| `GET` | `/my/tasks` | See assigned tasks |
| `PATCH` | `/my/tasks/{id}/status` | Update task status |

### Silo Files (VS Code extension)

| Method | Endpoint | Description |
|---|---|---|
| `GET` | `/silo/files?path=` | Browse file tree |
| `GET` | `/silo/file?path=` | Read a file |
| `POST` | `/silo/file` | Write/save a file |
| `POST` | `/silo/sync` | Sync from project master |

### Admin (JWT, admin role required)

| Method | Endpoint | Description |
|---|---|---|
| `GET` | `/admin/users` | List all users |
| `DELETE` | `/admin/users/{username}` | Delete a user |
| `GET` | `/admin/audit` | View audit logs |

### Sync (service token required)

Header: `X-Service-Token: <token>`

| Method | Endpoint | Description |
|---|---|---|
| `GET` | `/sync/users` | Get all users |
| `GET` | `/sync/audit` | Get audit logs |
| `POST` | `/sync/audit` | Push admin event to audit log |
| `PATCH` | `/sync/users/{username}/role` | Update user role |
| `POST` | `/sync/assign/branch` | Assign branch to developer |
| `DELETE` | `/sync/assign/branch/{username}` | Remove branch assignment |
| `GET` | `/sync/assign/branches` | List all branch assignments |
| `POST` | `/sync/assign/task` | Assign task to developer |
| `PATCH` | `/sync/assign/task/{id}/status` | Update task status |
| `GET` | `/sync/assign/tasks` | List all tasks |

### Bridge (connects both sides)

| Method | Endpoint | Description |
|---|---|---|
| `GET` | `/bridge/users` | Your users → partner |
| `GET` | `/bridge/audit` | Your audit logs → partner |
| `GET` | `/bridge/tasks` | Your tasks → partner |
| `GET` | `/bridge/branches` | Your branches → partner |
| `GET` | `/bridge/partner/health` | Partner service health |
| `GET` | `/bridge/partner/files` | Files from partner's silo |
| `POST` | `/bridge/partner/sync` | Trigger silo sync on partner's side |

---

## VS Code Extension

### Install
```bash
code --install-extension extension/simmsilos-0.0.1.vsix
```

### Usage
1. Open VS Code
2. Click the **SimmSilos** icon in the Activity Bar
3. `Cmd+Shift+P` → `SimmSilos: Login`
4. Enter your username and password
5. Your branch, tasks and silo files load automatically

### Commands
| Command | Description |
|---|---|
| `SimmSilos: Login` | Log in with credentials |
| `SimmSilos: Logout` | Log out |
| `SimmSilos: Refresh` | Reload tasks and files |
| `SimmSilos: Sync Silo from Project` | Pull latest project files |

---

## Partner Integration

Your partner's admin service connects using the service token:

```bash
# Assign a branch to a developer
curl -X POST http://YOUR_IP:3000/sync/assign/branch \
  -H "X-Service-Token: YOUR_SERVICE_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"username": "alice", "branch": "feature-x"}'

# Assign a task
curl -X POST http://YOUR_IP:3000/sync/assign/task \
  -H "X-Service-Token: YOUR_SERVICE_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"username": "alice", "branch": "feature-x", "function": "build_auth_module"}'
```

---

## CI/CD

- **Every PR to main** → runs automated pipeline checks (health, auth, policy enforcement)
- **Every push to main** → builds and pushes Docker image to GitHub Container Registry

---

## Environment Variables

| Variable | Default | Description |
|---|---|---|
| `JWT_SECRET` | `dev-secret` | JWT signing secret |
| `SERVICE_TOKEN` | — | Service-to-service auth token |
| `DB_HOST` | `localhost` | Postgres host |
| `DB_NAME` | `simmsilos` | Postgres database |
| `DB_USER` | `postgres` | Postgres user |
| `DB_PASSWORD` | — | Postgres password |
| `REDIS_HOST` | `localhost` | Redis host |
| `SILO_SERVICE_URL` | `http://simmsilos-vsc:5000` | Partner's silo service URL |
| `PARTNER_SERVICE_URL` | `http://simmsilos-admin:5000` | Partner's admin service URL |
| `BRANCH` | `unknown` | Current branch name |
