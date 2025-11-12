import os
import sys
import json

def resource_path(relative_path):
    if getattr(sys, 'frozen', False):
        base_path = os.path.dirname(sys.executable)
    else:
        base_path = os.path.abspath(os.path.join(os.path.dirname(__file__), "../../"))
    return os.path.join(base_path, relative_path)

config_path = resource_path('config/config.json')
with open(config_path, encoding='utf-8') as f:
    _config = json.load(f)

def get(key, default=None):
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
