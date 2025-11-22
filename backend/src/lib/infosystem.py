from getmac import get_mac_address
import socket

def get_system_mac() -> str:
    mac = get_mac_address()
    if mac:
        return mac.upper()
    return "00-00-00-00-00-00"

def get_local_ipv4():
    s = socket.socket(socket.AF_INET, socket.SOCK_DGRAM)
    try:
        s.connect(("8.8.8.8", 80))
        ip = s.getsockname()[0]
    except Exception:
        ip = "127.0.0.1"
    finally:
        s.close()
    return ip


if __name__ == "__main__":
    print("System MAC Address:", get_system_mac())
    print("System IP Address:", get_local_ipv4())