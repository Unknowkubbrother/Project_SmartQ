# -*- mode: python ; coding: utf-8 -*-
from PyInstaller.utils.hooks import collect_submodules
block_cipher = None

# collect all submodules under the 'src' package and keep explicit non-package imports
hidden_imports = collect_submodules('src') + ['pymysql']

from pathlib import Path
import os

def _collect_tree(prefix_folder: str, target_prefix: str):
    files = []
    # When PyInstaller executes the spec, __file__ may not be defined in that context.
    # Use the current working directory (the location where the spec is run) as the project root.
    project_root = Path('.').resolve()
    base = project_root / prefix_folder
    if base.exists() and base.is_dir():
        for p in base.rglob('*'):
            if p.is_file():
                rel = p.relative_to(base)
                files.append((str(p), str((Path(target_prefix) / rel).as_posix())))
    return files

# include src and assets/config as data so bundled exe has the backend sources and resources
datas = []
datas += _collect_tree('assets', 'assets')
datas += _collect_tree('config', 'config')
datas += _collect_tree('src', 'src')

a = Analysis(
    ['gui.py'],
    pathex=[r'E:\Dirve D\Coding\Project_SmartQ\backend'],
    binaries=[],
    datas=datas,
    hiddenimports=hidden_imports,
    hookspath=[],
    hooksconfig={},
    runtime_hooks=[],
    excludes=[],
    noarchive=False,
    optimize=0,
    cipher=block_cipher
)
pyz = PYZ(a.pure, a.zipped_data, cipher=block_cipher)

exe = EXE(
    pyz,
    a.scripts,
    [],
    exclude_binaries=True,
    name='gui_app',
    debug=False,
    bootloader_ignore_signals=False,
    strip=False,
    upx=True,
    console=True,
    disable_windowed_traceback=False,
    argv_emulation=False,
    target_arch=None,
    codesign_identity=None,
    entitlements_file=None,
    windowed=False,
)
coll = COLLECT(
    exe,
    a.binaries,
    a.datas,
    strip=False,
    upx=True,
    upx_exclude=[],
    name='gui_app',
)
