import json, os, sys

def resource_path(relative_path):
    """หา path ของไฟล์ config ไม่ว่ารันจาก .py หรือ .exe"""
    if getattr(sys, 'frozen', False):
        # กรณีรันจาก exe
        base_path = os.path.dirname(sys.executable)
    else:
        # กรณีรันจากโค้ดปกติ
        base_path = os.path.abspath(".")
    return os.path.join(base_path, relative_path)

# โหลด config.json
config_path = resource_path('src/config/config.json')
with open(config_path, encoding='utf-8') as f:
    _config = json.load(f)

def get(key, default=None):
    """ดึงค่าจาก config ด้วย dot notation เช่น 'DB.HOST'"""
    keys = key.split('.')
    value = _config
    for k in keys:
        if isinstance(value, dict):
            value = value.get(k)
        else:
            return default
        if value is None:
            return default
    return value
