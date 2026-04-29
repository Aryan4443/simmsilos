from fastapi import FastAPI

app = FastAPI()

@app.get("/")
def root():
    return {"status": "ok", "branch": "simmsilos"}

@app.get("/health")
def health():
    return {"status": "ok"}

@app.get("/api/status")
def status():
    return {"status": "running"}

@app.get("/api/version")
def version():
    return {"version": "1.0.0"}
