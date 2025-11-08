import json

with open('src/config/config.json', encoding='utf-8') as f:
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
