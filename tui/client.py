import requests
from typing import Dict, Any, List

class ARAGClient:
    def __init__(self, base_url: str = "http://127.0.0.1:8082"):
        self.base_url = base_url
        self.token = None
        self.headers = {}

    def login(self, username: str = "admin", password: str = "Ats@123*") -> bool:
        try:
            res = requests.post(
                f"{self.base_url}/auth/login",
                data={"username": username, "password": password},
                timeout=5
            )
            if res.status_code == 200:
                data = res.json()
                self.token = data["access_token"]
                self.headers = {"Authorization": f"Bearer {self.token}"}
                return True
        except Exception:
            pass
        return False

    def upload(self, file_path: str) -> Dict[str, Any]:
        try:
            import os
            with open(file_path, "rb") as f:
                filename = os.path.basename(file_path)
                res = requests.post(
                    f"{self.base_url}/upload/",
                    files={"file": (filename, f, "application/octet-stream")},
                    headers=self.headers,
                    timeout=10
                )
                return res.json()
        except Exception as e:
            return {"error": str(e)}

    def query(self, text: str) -> Dict[str, Any]:
        try:
            res = requests.post(
                f"{self.base_url}/search/query",
                json={"query": text},
                headers=self.headers,
                timeout=30
            )
            return res.json()
        except Exception as e:
            return {"error": str(e)}

    def get_documents(self) -> List[Dict[str, Any]]:
        try:
            res = requests.get(f"{self.base_url}/documents/", headers=self.headers, timeout=5)
            return res.json()
        except Exception:
            return []

    def get_telemetry(self) -> Dict[str, Any]:
        try:
            res = requests.get(f"{self.base_url}/monitoring/telemetry", headers=self.headers, timeout=3)
            return res.json()
        except Exception as e:
            return {"error": str(e)}

    def get_health(self) -> Dict[str, Any]:
        try:
            res = requests.get(f"{self.base_url}/monitoring/health", headers=self.headers, timeout=3)
            return res.json()
        except Exception as e:
            return {"error": str(e)}
