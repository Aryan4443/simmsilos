from flask import Flask, request, jsonify
import os

app = Flask(__name__)

# in-memory file store for testing
FILES = {
    "main.py": "from fastapi import FastAPI\n\napp = FastAPI()\n",
    "utils.py": "def hello():\n    return 'hello world'\n",
    "README.md": "# My Project\nThis is a test silo.\n",
}

@app.get("/health")
def health():
    return jsonify({"service": "mock-silosvsc"})

@app.get("/files")
def list_files():
    path = request.args.get("path", "")
    entries = [{"name": k, "path": k, "type": "file", "size": len(v)} for k, v in FILES.items()]
    return jsonify({"type": "dir", "entries": entries})

@app.get("/file")
def read_file():
    path = request.args.get("path", "")
    content = FILES.get(path, "# file not found")
    return jsonify({"path": path, "content": content})

@app.post("/file")
def write_file():
    data = request.get_json()
    FILES[data["path"]] = data["content"]
    return jsonify({"saved": data["path"]})

@app.post("/syncFromProject")
def sync():
    return jsonify({"copied": list(FILES.keys()), "skipped": []})

if __name__ == "__main__":
    app.run(host="0.0.0.0", port=5000)
