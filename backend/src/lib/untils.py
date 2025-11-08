import requests
from src.config.config import get as config
import base64

def image_to_data_uri(path: str, mime_type: str = "image/png") -> str:
    with open(path, "rb") as image_file:
        encoded = base64.b64encode(image_file.read()).decode("utf-8")
        return f"data:{mime_type};base64,{encoded}"

agent_url = config("NHSO_AGENT_URL")

def smartcard_status():
    try:
        response = requests.get(f"{agent_url}/api/smartcard/terminals")
        if response.status_code != 200:
            return False
        try:
            data = response.json()
        except ValueError:
            return False
        if isinstance(data, list):
            return bool(any(bool(item.get("terminalName")) and bool(item.get("isPresent")) for item in data))
        if isinstance(data, dict):
            return bool(data.get("terminalName")) and bool(data.get("isPresent", False))
        return False
    except requests.exceptions.RequestException:
        return False

def smartcard_read(readImageFlag: bool = False):
    try:
        response = requests.get(
            f"{agent_url}/api/smartcard/read", params={"readImageFlag": readImageFlag}
        )
        try:
            data = response.json()
        except ValueError:
            data = response.text
        return response.status_code, data
    except requests.exceptions.RequestException as e:
        return 500, {"error": str(e)}

def smartcard_readcardonly(readImageFlag: bool = False):
    try:
        response = requests.get(
            f"{agent_url}/api/smartcard/read-card-only", params={"readImageFlag": readImageFlag}
        )
        try:
            data = response.json()
        except ValueError:
            data = response.text
        return response.status_code, data
    except requests.exceptions.RequestException as e:
        return 500, {"error": str(e)}

def smartcard_probe(pid: str):
    try:
        response = requests.get(f"{agent_url}/api/smartcard/probe/{pid}")
        try:
            data = response.json()
        except ValueError:
            data = response.text
        return response.status_code, data
    except requests.exceptions.RequestException as e:
        return 500, {"error": str(e)}

def nhso_save_draft(pid: str, claim_type: str, mobile: str, correlation_id: str, hn: str = None, hcode: str = None):
    body = {
        "pid": pid,
        "claimType": claim_type,
        "mobile": mobile,
        "correlationId": correlation_id,
    }
    if hn is not None:
        body["hn"] = hn
    if hcode is not None:
        body["hcode"] = hcode
    try:
        response = requests.post(f"{agent_url}/api/nhso-service/save-as-draft", json=body, headers={"Content-Type": "application/json"})
        try:
            data = response.json()
        except ValueError:
            data = response.text
        return response.status_code, data
    except requests.exceptions.RequestException as e:
        return 500, {"error": str(e)}

def nhso_confirm_save(pid: str, claim_type: str, mobile: str, correlationId: str, hn: str = None, hcode: str = None):
    body = {
        "pid": pid,
        "claimType": claim_type,
        "mobile": mobile,
        "correlationId": correlationId,
    }
    if hn is not None:
        body["hn"] = hn
    if hcode is not None:
        body["hcode"] = hcode
    try:
        response = requests.post(f"{agent_url}/api/nhso-service/confirm-save", json=body, headers={"Content-Type": "application/json"})
        try:
            data = response.json()
        except ValueError:
            data = response.text
        return response.status_code, data
    except requests.exceptions.RequestException as e:
        return 500, {"error": str(e)}

def latest_authen_code(pid: str):
    try:
        response = requests.get(f"{agent_url}/api/nhso-service/latest-authen-code/{pid}")
        try:
            data = response.json()
        except ValueError:
            data = response.text
        return response.status_code, data
    except requests.exceptions.RequestException as e:
        return 500, {"error": str(e)}

def latest_5_authen_code_all_hospital(pid: str):
    try:
        response = requests.get(f"{agent_url}/api/nhso-service/latest-5-authen-code-all-hospital/{pid}")
        try:
            data = response.json()
        except ValueError:
            data = response.text
        return response.status_code, data
    except requests.exceptions.RequestException as e:
        return 500, {"error": str(e)}