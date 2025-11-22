# -*- mode: python ; coding: utf-8 -*-
"""
PyInstaller spec for the GUI (onedir).

This spec bundles `gui.py` into a windowed application and includes the
`assets/` and `config/` directories as data files so the GUI can load logos
and the configuration file at runtime. It's intentionally an onedir build
so resources remain as files next to the exe.

Run from the `backend/` folder:

  pyinstaller gui.spec

"""

from pathlib import Path
from PyInstaller.utils.hooks import collect_submodules
block_cipher = None

project_root = Path('.').resolve()

def _collect_tree(prefix_folder: str, target_prefix: str):
    files = []
    base = project_root / prefix_folder
    if base.exists() and base.is_dir():
        for p in base.rglob('*'):
            if p.is_file():
                rel = p.relative_to(base)
                files.append((str(p), str((Path(target_prefix) / rel).as_posix())))
    return files

# collect datas: assets/ and config/ (do not bundle backend src into GUI by default)
datas = []
datas += _collect_tree('assets', 'assets')
datas += _collect_tree('config', 'config')

# Hidden imports useful for the GUI (ttkbootstrap and its backends)
try:
    hidden_imports = collect_submodules('ttkbootstrap')
except Exception:
    hidden_imports = []

a = Analysis(
    ['gui.py'],
    pathex=[str(project_root)],
    binaries=[],
    datas=datas,
    hiddenimports=hidden_imports,
    hookspath=[],
    runtime_hooks=[],
    excludes=[],
    win_no_prefer_redirects=False,
    win_private_assemblies=False,
    cipher=block_cipher,
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
    console=False,
    disable_windowed_traceback=False,
    windowed=True,
    uac_admin=True
)

coll = COLLECT(
    exe,
    a.binaries,
    a.zipfiles,
    a.datas,
    strip=False,
    upx=True,
    name='gui_app',
)
