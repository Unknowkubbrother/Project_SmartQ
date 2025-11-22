import requests

secure_api = "https://lock-software-api.unknowkubbrother.net"

def validate_token(license_key: str, mac_address: str = None, ip_address: str = None) -> tuple:
    try:
        payload = {"license_key": license_key}
        if mac_address is not None:
            payload["mac_address"] = mac_address
        if ip_address is not None:
            payload["ip_address"] = ip_address

        response = requests.post(
            f"{secure_api}/license/validate",
            json=payload,
            timeout=5,
            headers={"Content-Type": "application/json"},
        )

        try:
            data = response.json()
        except ValueError:
            data = None

        msg = (data or {}).get("msg") or response.text

        return bool((data or {}).get("valid", False)), msg, response.status_code
    except requests.RequestException as e:
        print(f"Failed to validate token: {e}")
        return False, str(e), None

if __name__ == "__main__":
    result, msg, status_code = validate_token("834612429eacc88bc1536056a299eb7215aac2e0061711ed7a8ff819212c8010", "0A-00-27-00-00-15")
