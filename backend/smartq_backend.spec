# -*- mode: python ; coding: utf-8 -*-
from PyInstaller.utils.hooks import collect_submodules
block_cipher = None

hidden_imports = [
    'src.router.nsho',
    'src.router.jhcis',
    'src.router.queue',
    'src.lib.utils',
    'src.database.database',
    'src.models.models',
    'src.config.config'
]

a = Analysis(
    ['src/main.py'],
    pathex=['.'],
    datas=[],                            # config + assets ไม่รวม
    hiddenimports=hidden_imports,
    hookspath=[],
    runtime_hooks=[],
    excludes=[],
    cipher=block_cipher
)

pyz = PYZ(a.pure, a.zipped_data, cipher=block_cipher)

exe = EXE(
    pyz,
    a.scripts,
    [],
    exclude_binaries=True,
    name='smartq-backend',
    debug=False,
    bootloader_ignore_signals=False,
    strip=False,
    upx=True,
    console=True
)

coll = COLLECT(
    exe,
    a.binaries,
    a.zipfiles,
    a.datas,
    strip=False,
    upx=True,
    name='smartq-backend'
)
