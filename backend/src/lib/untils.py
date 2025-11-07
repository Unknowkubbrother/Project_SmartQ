import requests
from dotenv import load_dotenv
import os

load_dotenv()
agent_url = os.getenv("NHSO_AGENT_URL")

# TODO : secure-smart-card-agent-resource

def smartcard_status():
    response = requests.get(f"{agent_url}/api/smartcard/terminals")
    if response.status_code != 200:
        return False

    data = response.json()
    if isinstance(data, list):
        return bool(any(bool(item.get("terminalName")) and bool(item.get("isPresent")) for item in data))
    if isinstance(data, dict):
        return bool(data.get("terminalName")) and bool(data.get("isPresent", False))

    return False

def smartcard_read(readImageFlag: bool = False):
    response = requests.get(f"{agent_url}/api/smartcard/read", params={"readImageFlag": readImageFlag})
    return response.status_code, response.json()


def smartcard_readcardonly(readImageFlag: bool = False):
    response = requests.get(f"{agent_url}/api/smartcard/read-card-only", params={"readImageFlag": readImageFlag})
    return response.status_code, response.json()


def smartcard_probe(pid: str):
    response = requests.get(f"{agent_url}/api/smartcard/probe/{pid}")
    return response.status_code, response.json()


# TODO: nhso-service-resource

def nhso_save_draft(pid: str, claim_type: str, mobile: str, correlation_id: str,hn: str = None, hcode: str = None):
    body = {
        "pid": pid,
        "claimType": claim_type,
        "mobile": mobile,
        "correlationId": correlation_id,
    }
    if hn is not None:
        body["hn"] = hn

    if hcode is not None:
        body['hcode'] = hcode

    response = requests.post(f"{agent_url}/api/nhso-service/save-as-draft", json=body, headers={"Content-Type": "application/json"})
    return response.status_code, response.json()



def nhso_confirm_save(pid: str, claim_type: str, mobile: str, correlation_id: str,hn: str = None, hcode: str = None):
    body = {
        "pid": pid,
        "claimType": claim_type,
        "mobile": mobile,
        "correlationId": correlation_id,
    }
    if hn is not None:
        body["hn"] = hn

    if hcode is not None:
        body['hcode'] = hcode

    response = requests.post(f"{agent_url}/api/nhso-service/confirm-save", json=body, headers={"Content-Type": "application/json"})
    return response.status_code, response.json()

def latest_authen_code(pid : str):
    response =  requests.get(f"{agent_url}/api/nhso-service/latest-authen-code/{pid}")
    return response.status_code, response.json()

def latest_5_authen_code_all_hospital(pid : str):
    response = requests.get(f"{agent_url}/api/nhso-service/latest-5-authen-code-all-hospital/{pid}")
    return response.status_code, response.json()