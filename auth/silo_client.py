import os
import requests

SILO_BASE = os.getenv("SILO_SERVICE_URL", "http://simmsilos-vsc:5000")

def _url(path: str) -> str:
    return f"{SILO_BASE}{path}"

def health():
    return requests.get(_url("/health"), timeout=5).json()

def list_files(username: str, project_name: str, path: str = ""):
    return requests.get(_url("/files"), params={
        "username": username,
        "projectName": project_name,
        "path": path,
    }, timeout=5).json()

def read_file(username: str, project_name: str, path: str):
    return requests.get(_url("/file"), params={
        "username": username,
        "projectName": project_name,
        "path": path,
    }, timeout=5).json()

def write_file(username: str, project_name: str, path: str, content: str, overwrite: bool = True):
    return requests.post(_url("/file"), json={
        "username": username,
        "projectName": project_name,
        "path": path,
        "content": content,
        "overwrite": overwrite,
    }, timeout=5).json()

def sync_from_project(username: str, project_name: str, overwrite: bool = False):
    return requests.post(_url("/syncFromProject"), json={
        "username": username,
        "projectName": project_name,
        "overwrite": overwrite,
    }, timeout=5).json()
