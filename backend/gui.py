import json
import os
import subprocess
import threading
import queue
import sys
import time
import shutil
import tkinter as tk
from tkinter import messagebox, filedialog, simpledialog
from tkinter.colorchooser import askcolor
import ttkbootstrap as tb
from ttkbootstrap.constants import *
from tkinter.scrolledtext import ScrolledText
import re
from src.config import config as cfg

# --- START OF EDIT ---
# ตรวจสอบว่ากำลังรันเป็น .exe (PyInstaller bundle) หรือไม่
if getattr(sys, 'frozen', False):
    # ถ้าใช่ HERE คือที่อยู่ของไฟล์ .exe
    HERE = os.path.dirname(sys.executable)
else:
    # ถ้าไม่ใช่ (รันเป็น .py) HERE คือที่อยู่ของไฟล์สคริปต์
    HERE = os.path.dirname(os.path.abspath(__file__))
# --- END OF EDIT ---

CONFIG_PATH = getattr(cfg, 'config_path', os.path.join(HERE, 'config', 'config.json'))

class BackendGUI:
    def __init__(self, root):
        self.root = root
        self.root.title('SmartQ Server Control')
        
        self.proc = None
        self.thread = None
        self.queue = queue.Queue()
        self.config = {}
        self.current_service_index = None

        self.ansi_escape_regex = re.compile(r'\x1b\[([\d;]*)m')
        self.current_tags = [] 

        self._build_ui()
        self._load_config()
        self._poll_queue()
        self.root.protocol('WM_DELETE_WINDOW', self._on_close)

    def _build_ui(self):
        notebook = tb.Notebook(self.root)
        notebook.pack(fill=BOTH, expand=True, padx=15, pady=15)

        cfg_frame = tb.Frame(notebook, padding=15)
        notebook.add(cfg_frame, text='Config')
        
        cfg_frame.columnconfigure(1, weight=1)

        tb.Label(cfg_frame, text='Hospital name:').grid(row=0, column=0, sticky=W, padx=5, pady=5)
        self.hospital_entry = tb.Entry(cfg_frame, width=60)
        self.hospital_entry.grid(row=0, column=1, columnspan=3, sticky='ew', pady=5, padx=5)

        tb.Label(cfg_frame, text='Video URL:').grid(row=1, column=0, sticky=W, padx=5, pady=5)
        self.video_url_entry = tb.Entry(cfg_frame, width=60)
        self.video_url_entry.grid(row=1, column=1, columnspan=3, sticky='ew', pady=5, padx=5)

        tb.Label(cfg_frame, text='Logo File:').grid(row=2, column=0, sticky=W, padx=5, pady=5)
        self.logo_entry = tb.Entry(cfg_frame, width=60)
        self.logo_entry.grid(row=2, column=1, columnspan=2, sticky='ew', pady=5, padx=5)
        self.logo_browse_btn = tb.Button(cfg_frame, text='Upload Logo...', command=self._browse_logo, bootstyle=SECONDARY)
        self.logo_browse_btn.grid(row=2, column=3, sticky=W, padx=5, pady=5)

        db_group = tb.Labelframe(cfg_frame, text='Database Configuration', padding=15)
        db_group.grid(row=3, column=0, columnspan=4, sticky='ew', pady=10, padx=5)
        db_group.columnconfigure(1, weight=1)
        db_group.columnconfigure(3, weight=1)

        tb.Label(db_group, text='DB Host:').grid(row=0, column=0, sticky=W, padx=5, pady=5)
        self.dbhost_entry = tb.Entry(db_group)
        self.dbhost_entry.grid(row=0, column=1, sticky='ew', padx=5, pady=5)

        tb.Label(db_group, text='DB Port:').grid(row=0, column=2, sticky=W, padx=5, pady=5)
        self.dbport_entry = tb.Entry(db_group, width=10)
        self.dbport_entry.grid(row=0, column=3, sticky=W, padx=5, pady=5)

        tb.Label(db_group, text='DB User:').grid(row=1, column=0, sticky=W, padx=5, pady=5)
        self.dbuser_entry = tb.Entry(db_group)
        self.dbuser_entry.grid(row=1, column=1, sticky='ew', padx=5, pady=5)

        tb.Label(db_group, text='DB Password:').grid(row=1, column=2, sticky=W, padx=5, pady=5)
        self.dbpass_entry = tb.Entry(db_group, show='*')
        self.dbpass_entry.grid(row=1, column=3, sticky='ew', padx=5, pady=5)

        tb.Label(db_group, text='DB Name:').grid(row=2, column=0, sticky=W, padx=5, pady=5)
        self.dbname_entry = tb.Entry(db_group)
        self.dbname_entry.grid(row=2, column=1, sticky='ew', padx=5, pady=5)

        btn_frame = tb.Frame(cfg_frame)
        btn_frame.grid(row=4, column=0, columnspan=4, pady=15)
        
        tb.Button(btn_frame, text='Save Config', command=self._save_config, bootstyle=PRIMARY).pack(side=LEFT, padx=5)
        tb.Button(btn_frame, text='Reload Config', command=self._load_config, bootstyle=INFO).pack(side=LEFT, padx=5)
        tb.Button(btn_frame, text='Open Config File', command=self._open_config_file, bootstyle=SECONDARY).pack(side=LEFT, padx=5)

        svc_frame = tb.Frame(notebook, padding=15)
        notebook.add(svc_frame, text='Services')

        left = tb.Frame(svc_frame)
        left.pack(side=LEFT, fill=Y, padx=(0, 15), pady=5)
        tb.Label(left, text='Services', bootstyle=PRIMARY).pack(anchor=W, pady=(0, 5))
        self.svc_tree = tb.Treeview(left, columns=('name',), show='tree', height=15, bootstyle=PRIMARY)
        self.svc_tree.pack(fill=Y, expand=True)
        svc_btns = tb.Frame(left)
        svc_btns.pack(fill=X, pady=10)
        tb.Button(svc_btns, text='Add', command=self._add_service, bootstyle=SUCCESS).pack(side=LEFT, padx=2)
        tb.Button(svc_btns, text='Remove', command=self._remove_service, bootstyle=DANGER).pack(side=LEFT, padx=2)

        right = tb.Frame(svc_frame)
        right.pack(side=LEFT, fill=BOTH, expand=True, pady=5)
        
        detail_group = tb.Labelframe(right, text='Service Details', padding=15)
        detail_group.pack(fill=X, pady=(0, 10))
        detail_group.columnconfigure(1, weight=1)

        tb.Label(detail_group, text='Label').grid(row=0, column=0, sticky=W, padx=5, pady=5)
        self.svc_label_entry = tb.Entry(detail_group)
        self.svc_label_entry.grid(row=0, column=1, sticky='ew', padx=5, pady=5)
        tb.Label(detail_group, text='Name').grid(row=1, column=0, sticky=W, padx=5, pady=5)
        self.svc_name_entry = tb.Entry(detail_group)
        self.svc_name_entry.grid(row=1, column=1, sticky='ew', padx=5, pady=5)

        tb.Label(detail_group, text='Color').grid(row=2, column=0, sticky=W, padx=5, pady=5)
        color_frame = tb.Frame(detail_group)
        color_frame.grid(row=2, column=1, sticky='ew', pady=5)
        
        self.svc_color_entry = tb.Entry(color_frame, width=10)
        self.svc_color_entry.pack(side=LEFT, padx=(0, 5))
        
        self.svc_color_preview = tk.Label(color_frame, text='', width=3, background='#FFFFFF', relief='sunken', bd=1)
        self.svc_color_preview.pack(side=LEFT, padx=5, ipady=3)
        
        tb.Button(color_frame, text='Choose...', command=self._choose_color, bootstyle=SECONDARY).pack(side=LEFT, padx=5)

        counter_group = tb.Labelframe(right, text='Counters', padding=15)
        counter_group.pack(fill=X, pady=(10, 0))
        
        self.counters_listbox = tk.Listbox(counter_group, height=6, relief=tk.FLAT, bd=2)
        self.counters_listbox.pack(fill=X, pady=4, expand=True)
        cnt_btns = tb.Frame(counter_group)
        cnt_btns.pack(fill=X, pady=(5,0))
        tb.Button(cnt_btns, text='Add Counter', command=self._add_counter, bootstyle=SUCCESS).pack(side=LEFT, padx=2)
        tb.Button(cnt_btns, text='Edit', command=self._edit_counter, bootstyle=INFO).pack(side=LEFT, padx=2)
        tb.Button(cnt_btns, text='Remove Counter', command=self._remove_counter, bootstyle=DANGER).pack(side=LEFT, padx=2)

        tb.Button(right, text='Save Service (and Save Config)', command=self._save_service, bootstyle=PRIMARY).pack(pady=15, anchor=E)

        self.svc_tree.bind('<<TreeviewSelect>>', self._on_service_select)

        ctrl_term_frame = tb.Frame(notebook, padding=15)
        notebook.add(ctrl_term_frame, text='Control & Log')

        ctrl_group = tb.Frame(ctrl_term_frame)
        ctrl_group.pack(side=TOP, fill=X, pady=(0, 15))
        
        tb.Button(ctrl_group, text='Start Server', command=self._start_backend, bootstyle=SUCCESS).pack(side=LEFT, padx=8, ipady=4)
        tb.Button(ctrl_group, text='Stop Server', command=self._stop_backend, bootstyle=DANGER).pack(side=LEFT, padx=8, ipady=4)
        tb.Button(ctrl_group, text='Clear Terminal', command=self._clear_terminal, bootstyle=WARNING).pack(side=LEFT, padx=8, ipady=4)
        tb.Button(ctrl_group, text='Choose Config...', command=self._choose_config, bootstyle=INFO).pack(side=LEFT, padx=8, ipady=4)

        term_group = tb.Labelframe(ctrl_term_frame, text='Terminal Log', padding=10)
        term_group.pack(side=TOP, fill=BOTH, expand=True)
        
        self.terminal_font_tuple = ('Consolas', 10) if os.name == 'nt' else ('Monaco', 11)
        self.terminal = ScrolledText(term_group, wrap='word', height=20, state='disabled', bg='black', fg='white', font=self.terminal_font_tuple)
        self.terminal.pack(fill=BOTH, expand=True)
        
        self._configure_ansi_tags()

    def _choose_color(self):
        initial_color = self.svc_color_entry.get()
        if not initial_color.startswith('#'):
            initial_color = '#FFFFFF'
            
        color_tuple = askcolor(color=initial_color, title="Choose service color", parent=self.root)
        
        if color_tuple and color_tuple[1]:
            hex_color = color_tuple[1]
            self.svc_color_entry.delete(0, tk.END)
            self.svc_color_entry.insert(0, hex_color)
            try:
                self.svc_color_preview.config(background=hex_color)
            except Exception:
                self.svc_color_preview.config(background='#FFFFFF')

    def _browse_logo(self):
        assets_dir = os.path.join(HERE, 'assets')
        
        try:
            os.makedirs(assets_dir, exist_ok=True)
        except OSError as e:
            messagebox.showerror('Error', f'Could not create assets directory: {e}')
            return

        filetypes = [('Image files', '*.png *.jpg *.jpeg *.gif'), ('All files', '*.*')]
        source_path = filedialog.askopenfilename(title='Select Logo File to Upload', initialdir=os.path.expanduser('~'), filetypes=filetypes)
        
        if not source_path:
            return

        filename = os.path.basename(source_path)
        dest_path = os.path.join(assets_dir, filename)

        try:
            if os.path.normpath(source_path) == os.path.normpath(dest_path):
                self._write_to_terminal(f"Logo '{filename}' is already in assets folder.\n")
            else:
                shutil.copy2(source_path, dest_path)
                self._write_to_terminal(f"Copied '{filename}' to assets folder.\n")

            self.logo_entry.delete(0, tk.END)
            self.logo_entry.insert(0, filename)
            
        except Exception as e:
            messagebox.showerror('Upload Error', f'Failed to copy file to assets: {e}')
            self._write_to_terminal(f"ERROR: Failed to copy logo: {e}\n")

    def _open_config_file(self):
        try:
            if sys.platform == 'darwin':
                subprocess.Popen(['open', CONFIG_PATH])
            elif sys.platform == 'win32':
                os.startfile(CONFIG_PATH)
            else:
                subprocess.Popen(['xdg-open', CONFIG_PATH])
        except Exception:
            messagebox.showinfo('Open config', f'Config path: {CONFIG_PATH}')

    def _choose_config(self):
        path = filedialog.askopenfilename(title='Select config.json', initialdir=HERE, filetypes=[('JSON files','*.json')])
        if path:
            global CONFIG_PATH
            CONFIG_PATH = path
            # update module loader's metadata if present
            try:
                with open(CONFIG_PATH, 'r', encoding='utf-8') as f:
                    cfg._config = json.load(f)
                cfg.config_path = CONFIG_PATH
            except Exception:
                # ignore; _load_config will show error if cannot read
                pass
            self._load_config()
            self.root.title(f'SmartQ Server Control - {os.path.basename(CONFIG_PATH)}')
            self._write_to_terminal(f'Using config: {CONFIG_PATH}\n')

    def _load_config(self):
        # Prefer the src.config.config module's loaded config; fall back to reading CONFIG_PATH
        try:
            # if module has _config, use it; else read file
            conf_data = None
            if hasattr(cfg, '_config') and isinstance(getattr(cfg, '_config'), dict):
                conf_data = cfg._config
            else:
                with open(CONFIG_PATH, 'r', encoding='utf-8') as f:
                    conf_data = json.load(f)
                    cfg._config = conf_data
                    cfg.config_path = CONFIG_PATH
        except Exception as e:
            messagebox.showerror('Error', f'Failed to load config: {e}')
            return

        self.config = conf_data
        self.root.title(f'SmartQ Server Control - {os.path.basename(CONFIG_PATH)}')
        
        self.hospital_entry.delete(0, tk.END)
        self.hospital_entry.insert(0, self.config.get('HOSPITAL_NAME', ''))

        self.video_url_entry.delete(0, tk.END)
        self.video_url_entry.insert(0, self.config.get('VIDEO_URL', ''))
        
        self.logo_entry.delete(0, tk.END)
        self.logo_entry.insert(0, self.config.get('LOGO_FILE', ''))
        
        db = self.config.get('DB', {})
        self.dbhost_entry.delete(0, tk.END); self.dbhost_entry.insert(0, db.get('HOST', ''))
        self.dbport_entry.delete(0, tk.END); self.dbport_entry.insert(0, str(db.get('PORT', '')))
        self.dbuser_entry.delete(0, tk.END); self.dbuser_entry.insert(0, db.get('USERNAME', ''))
        self.dbpass_entry.delete(0, tk.END); self.dbpass_entry.insert(0, db.get('PASSWORD', ''))
        self.dbname_entry.delete(0, tk.END); self.dbname_entry.insert(0, db.get('DATABASE', ''))
        self._write_to_terminal('Config loaded.\n')
        self._reload_services_tree()

    def _save_config(self):
        try:
            self.config['HOSPITAL_NAME'] = self.hospital_entry.get()

            self.config['VIDEO_URL'] = self.video_url_entry.get()
            
            self.config['LOGO_FILE'] = self.logo_entry.get()

            self.config.setdefault('DB', {})
            self.config['DB']['HOST'] = self.dbhost_entry.get()
            try:
                self.config['DB']['PORT'] = int(self.dbport_entry.get())
            except Exception:
                self.config['DB']['PORT'] = self.dbport_entry.get()
            self.config['DB']['USERNAME'] = self.dbuser_entry.get()
            self.config['DB']['PASSWORD'] = self.dbpass_entry.get()
            self.config['DB']['DATABASE'] = self.dbname_entry.get()

            # write to the active config path (use module path if available)
            target_path = getattr(cfg, 'config_path', CONFIG_PATH)
            with open(target_path, 'w', encoding='utf-8') as f:
                json.dump(self.config, f, ensure_ascii=False, indent=4)

            # update module cache
            try:
                cfg._config = self.config
                cfg.config_path = target_path
            except Exception:
                pass

            self._write_to_terminal('Config saved.\n')
            self._reload_services_tree()
        except Exception as e:
            messagebox.showerror('Error', f'Failed to save config: {e}')

    def _reload_services_tree(self):
        for item in self.svc_tree.get_children():
            self.svc_tree.delete(item)
        services = self.config.get('SERVICES', [])
        for idx, s in enumerate(services):
            text = f"{s.get('label','')} ({s.get('name','')})"
            self.svc_tree.insert('', 'end', iid=str(idx), text=text)

    def _add_service(self):
        services = self.config.setdefault('SERVICES', [])
        new = {'label': 'ใหม่', 'name': f'service_{len(services)+1}', 'color': '#888888', 'counters': []}
        services.append(new)
        self._reload_services_tree()
        self._write_to_terminal('Added new service (in-memory). Save config to persist.\n')

    def _remove_service(self):
        sel = self.svc_tree.selection()
        if not sel:
            return
        idx = int(sel[0])
        services = self.config.get('SERVICES', [])
        if 0 <= idx < len(services):
            services.pop(idx)
            self._reload_services_tree()
            self._write_to_terminal('Removed service (in-memory). Save config to persist.\n')

    def _on_service_select(self, event):
        sel = self.svc_tree.selection()
        if not sel:
            return
        idx = int(sel[0])
        self.current_service_index = idx
        services = self.config.get('SERVICES', [])
        if 0 <= idx < len(services):
            s = services[idx]
            self.svc_label_entry.delete(0, tk.END); self.svc_label_entry.insert(0, s.get('label',''))
            self.svc_name_entry.delete(0, tk.END); self.svc_name_entry.insert(0, s.get('name',''))
            
            color = s.get('color', '#FFFFFF')
            if not color:
                color = '#FFFFFF'
            self.svc_color_entry.delete(0, tk.END)
            self.svc_color_entry.insert(0, color)
            try:
                self.svc_color_preview.config(background=color)
            except Exception:
                self.svc_color_preview.config(background='#FFFFFF')
            
            self.counters_listbox.delete(0, tk.END)
            for c in s.get('counters', []):
                name = c.get('name') if isinstance(c, dict) else str(c)
                self.counters_listbox.insert(tk.END, name)

    def _add_counter(self):
        val = f'ช่อง {self.counters_listbox.size()+1}'
        self.counters_listbox.insert(tk.END, val)

    def _edit_counter(self):
        sel = self.counters_listbox.curselection()
        if not sel:
            return
        idx = sel[0]
        old_val = self.counters_listbox.get(idx)
        
        new_val = simpledialog.askstring('Edit Counter', 'Enter new counter name:', initialvalue=old_val, parent=self.root)
        
        if new_val and new_val != old_val:
            self.counters_listbox.delete(idx)
            self.counters_listbox.insert(idx, new_val)
            self.counters_listbox.select_set(idx)

    def _remove_counter(self):
        sel = self.counters_listbox.curselection()
        if not sel:
            return
        self.counters_listbox.delete(sel[0])

    def _save_service(self):
        idx = self.current_service_index
        if idx is None:
            messagebox.showinfo('Info', 'No service selected')
            return
        services = self.config.setdefault('SERVICES', [])
        if idx < 0 or idx >= len(services):
            messagebox.showerror('Error', 'Invalid service index')
            return
        try:
            services[idx]['label'] = self.svc_label_entry.get()
            services[idx]['name'] = self.svc_name_entry.get()
            services[idx]['color'] = self.svc_color_entry.get()
            
            counters = []
            for i in range(self.counters_listbox.size()):
                counters.append({'name': self.counters_listbox.get(i)})
            services[idx]['counters'] = counters
            
            self._write_to_terminal('Service details updated. Saving to config file...\n')
            self._reload_services_tree()
            
            self._save_config() 
            
        except Exception as e:
            messagebox.showerror('Error', f'Failed to save service: {e}')

    def _start_backend(self):
        if self.proc and self.proc.poll() is None:
            messagebox.showinfo('Server', 'Server is already running')
            return
        
        self.current_tags = []
        
        venv_py = None
        candidate = os.path.join(HERE, '.venv', 'bin', 'python')
        if os.name == 'nt':
            candidate = os.path.join(HERE, '.venv', 'Scripts', 'python.exe')
        if os.path.exists(candidate) and os.access(candidate, os.X_OK):
            venv_py = candidate
        interpreter = None

        # If running as a frozen executable (pyinstaller), sys.executable is the exe
        # launching the GUI. Starting that executable will spawn another GUI window.
        # Prefer a real Python interpreter when available (python, python3, or venv).
        if venv_py:
            interpreter = venv_py
        else:
            try:
                frozen = getattr(sys, 'frozen', False)
            except Exception:
                frozen = False

            if frozen:
                # try to find a system python first
                from shutil import which
                interp = which('python') or which('python3') or which('py')
                if interp:
                    interpreter = interp
                    self._write_to_terminal(f"Detected frozen GUI; using system python: {interpreter}\n")
                else:
                    # no system python found — fall back to sys.executable but warn user
                    interpreter = sys.executable
                    self._write_to_terminal('Warning: running from packaged GUI and no system python found; this may spawn another GUI window.\n')
            else:
                interpreter = sys.executable
        cmd_module = [interpreter, '-u', '-m', 'src.main']
        cmd_file = [interpreter, '-u', os.path.join('src', 'main.py')]
        self._write_to_terminal(f'Starting Server with interpreter: {interpreter}\n')
        default_port = 8000
        try:
            default_port = int(os.environ.get('SMARTQ_PORT', default_port))
        except Exception:
            default_port = 8000
        port_to_use = default_port
        if self._is_port_in_use(port_to_use):
            msg = f"Port {port_to_use} appears to be in use. Start Server on a different port?"
            if messagebox.askyesno('Port in use', msg):
                newp = simpledialog.askinteger('Port', 'Enter port number to use', initialvalue=port_to_use + 1, minvalue=1024, maxvalue=65535, parent=self.root)
                if newp:
                    port_to_use = newp
                else:
                    self._write_to_terminal('User cancelled alternate port selection.\n')
                    return
            else:
                self._write_to_terminal('Port in use and user chose not to start Server.\n')
                return
        def _find_backend_executable():
            # 1) explicit override from config
            be = self.config.get('BACKEND_EXE')
            if be:
                if os.path.isabs(be) and os.path.exists(be):
                    return be
                # try relative to HERE
                candidate = os.path.join(HERE, be)
                if os.path.exists(candidate):
                    return candidate

            # 2) if running from a packaged GUI, look next to the GUI exe for a backend bundle
            if getattr(sys, 'frozen', False):
                exe_dir = os.path.dirname(sys.executable)
                # common names from spec: smartq-backend (folder) / smartq-backend.exe
                candidates = [
                    os.path.join(exe_dir, 'smartq-backend.exe'),
                    os.path.join(exe_dir, 'smartq-backend', 'smartq-backend.exe'),
                    os.path.join(exe_dir, 'smartq_backend.exe'),
                    os.path.join(exe_dir, 'smartq_backend', 'smartq_backend.exe'),
                ]
                for c in candidates:
                    if os.path.exists(c):
                        return c

                # also check parent directory (if GUI is inside a nested dist folder)
                parent = os.path.abspath(os.path.join(exe_dir, '..'))
                for name in ['smartq-backend.exe', os.path.join('smartq-backend','smartq-backend.exe')]:
                    c = os.path.join(parent, name)
                    if os.path.exists(c):
                        return c

            # 3) development layout: dist created in backend/dist; check sibling dist folder
            dev_candidate = os.path.join(HERE, 'dist', 'smartq-backend', 'smartq-backend.exe')
            if os.path.exists(dev_candidate):
                return dev_candidate

            return None

        try:
            self._write_to_terminal(f'Attempting module start: {cmd_module}\n')
            env = os.environ.copy()
            env['SMARTQ_PORT'] = str(port_to_use)
            env['FORCE_COLOR'] = '1'
            # Determine an appropriate src path to add to PYTHONPATH so the child python
            # can import the local `src` package. When running as a frozen/packaged GUI,
            # the data files may be extracted to sys._MEIPASS (onefile) or placed next to
            # the exe (onedir). Try several candidate locations.
            def _find_src_candidate():
                # 1) If PyInstaller onefile extraction dir exists
                if getattr(sys, 'frozen', False):
                    meipass = getattr(sys, '_MEIPASS', None)
                    if meipass:
                        cand = os.path.join(meipass, 'src')
                        if os.path.isdir(cand):
                            return cand
                    # 2) Directory next to the executable (common for --onedir)
                    exe_dir = os.path.dirname(sys.executable)
                    cand2 = os.path.join(exe_dir, 'src')
                    if os.path.isdir(cand2):
                        return cand2
                # 3) Development layout: src folder relative to this gui.py file
                cand3 = os.path.join(HERE, 'src')
                if os.path.isdir(cand3):
                    return cand3
                # 4) fallback to HERE
                return HERE

            src_path = _find_src_candidate()
            prev_pp = env.get('PYTHONPATH', '')
            env['PYTHONPATH'] = f"{src_path}{os.pathsep}{prev_pp}" if prev_pp else src_path
            self._write_to_terminal(f'Using PYTHONPATH={env["PYTHONPATH"]}\n')
            # Prefer launching a bundled backend executable if available (avoids reliance on system python)
            backend_exe = _find_backend_executable()
            if backend_exe:
                self._write_to_terminal(f'Found backend executable: {backend_exe}\n')
                # Launch the backend exe directly
                self.proc = subprocess.Popen([backend_exe], cwd=os.path.dirname(backend_exe), stdout=subprocess.PIPE, stderr=subprocess.STDOUT, env=env,
                                             text=True, encoding='utf-8', errors='replace')
            else:
                # Fall back to module start which requires PYTHONPATH set above
                self.proc = subprocess.Popen(cmd_module, cwd=HERE, stdout=subprocess.PIPE, stderr=subprocess.STDOUT, env=env,
                                             text=True, encoding='utf-8', errors='replace')
            self.thread = threading.Thread(target=self._reader_thread, daemon=True)
            self.thread.start()
        except Exception as e:
            self._write_to_terminal(f'Module start failed, falling back to file: {e}\n')
            try:
                self._write_to_terminal(f'Attempting file start: {cmd_file}\n')
                env = os.environ.copy()
                env['SMARTQ_PORT'] = str(port_to_use)
                env['FORCE_COLOR'] = '1'
                # file start doesn't need PYTHONPATH since we're running the file directly, but keep env consistent
                # however, when packaged we still want the child to find the local src package
                def _find_src_candidate_file():
                    if getattr(sys, 'frozen', False):
                        meipass = getattr(sys, '_MEIPASS', None)
                        if meipass:
                            cand = os.path.join(meipass, 'src')
                            if os.path.isdir(cand):
                                return cand
                        exe_dir = os.path.dirname(sys.executable)
                        cand2 = os.path.join(exe_dir, 'src')
                        if os.path.isdir(cand2):
                            return cand2
                    cand3 = os.path.join(HERE, 'src')
                    if os.path.isdir(cand3):
                        return cand3
                    return HERE

                src_path = _find_src_candidate_file()
                prev_pp = env.get('PYTHONPATH', '')
                env['PYTHONPATH'] = f"{src_path}{os.pathsep}{prev_pp}" if prev_pp else src_path
                self.proc = subprocess.Popen(cmd_file, cwd=HERE, stdout=subprocess.PIPE, stderr=subprocess.STDOUT, env=env,
                                             text=True, encoding='utf-8', errors='replace')
                self.thread = threading.Thread(target=self._reader_thread, daemon=True)
                self.thread.start()
            except Exception as e2:
                self._write_to_terminal(f'Failed to start Server: {e2}\n')
                self.proc = None

    def _is_port_in_use(self, port: int) -> bool:
        import socket
        s = socket.socket(socket.AF_INET, socket.SOCK_STREAM)
        try:
            s.settimeout(0.5)
            res = s.connect_ex(('0.0.0.0', port)) 
            return res == 0
        except Exception:
            return False
        finally:
            try:
                s.close()
            except Exception:
                pass

    def _stop_backend(self):
        if not self.proc:
            messagebox.showinfo('Server', 'Server not running')
            return
        try:
            if self.proc.poll() is None:
                self._write_to_terminal('Sent terminate signal to Server.\n')
                try:
                    self.proc.terminate()
                except Exception:
                    pass
                try:
                    self.proc.wait(timeout=3)
                except Exception:
                    try:
                        self._write_to_terminal('Server did not exit, killing.\n')
                        self.proc.kill()
                    except Exception:
                        pass
            else:
                self._write_to_terminal('Server already exited.\n')
        except Exception as e:
            self._write_to_terminal(f'Error terminating: {e}\n')
        finally:
            try:
                if self.proc and self.proc.stdout:
                    try:
                        self.proc.stdout.close()
                    except Exception:
                        pass
            except Exception:
                pass
            self.proc = None

    def _reader_thread(self):
        if not self.proc or not self.proc.stdout:
            return
        try:
            for line in iter(self.proc.stdout.readline, ''):
                if not line:
                    break
                self.queue.put(line)
        except Exception as e:
            if 'read from closed file' not in str(e).lower():
               self.queue.put(f'Reader thread error: {e}\n')
        finally:
            self.queue.put('\n[process exited]\n')

    def _on_close(self):
        try:
            if self.proc and self.proc.poll() is None:
                msg = 'Server process is still running. Stop Server and exit?'
                if messagebox.askyesno('Exit', msg):
                    self._stop_backend()
                else:
                    pass
        except Exception:
            pass
        try:
            if self.thread and self.thread.is_alive():
                self.thread.join(timeout=0.5)
        except Exception:
            pass
        try:
            self.root.destroy()
        except Exception:
            try:
                self.root.quit()
            except Exception:
                pass

    def _poll_queue(self):
        try:
            while True:
                item = self.queue.get_nowait()
                self._write_to_terminal(item)
        except queue.Empty:
            pass
        self.root.after(200, self._poll_queue)

    def _configure_ansi_tags(self):
        base_font_family = self.terminal_font_tuple[0]
        base_font_size = self.terminal_font_tuple[1]
        
        self.tag_configs = {
            'fg_black':   {'foreground': '#2e3436'},
            'fg_red':     {'foreground': '#cc0000'},
            'fg_green':   {'foreground': '#4e9a06'},
            'fg_yellow':  {'foreground': '#c4a000'},
            'fg_blue':    {'foreground': '#3465a4'},
            'fg_magenta': {'foreground': '#75507b'},
            'fg_cyan':    {'foreground': '#06989a'},
            'fg_white':   {'foreground': '#d3d7cf'},
            'fg_br_black':  {'foreground': '#555753'},
            'fg_br_red':    {'foreground': '#ef2929'},
            'fg_br_green':  {'foreground': '#8ae234'},
            'fg_br_yellow': {'foreground': 'yellow1'},
            'fg_br_blue':   {'foreground': '#729fcf'},
            'fg_br_magenta':{'foreground': '#ad7fa8'},
            'fg_br_cyan':   {'foreground': '#34e2e2'},
            'fg_br_white':  {'foreground': '#eeeeec'},

            'bg_black':   {'background': '#2e3436'},
            'bg_red':     {'background': '#cc0000'},
            'bg_green':   {'background': '#4e9a06'},
            'bg_yellow':  {'background': 'yellow1'},
            'bg_blue':    {'background': '#3465a4'},
            'bg_magenta': {'background': '#75507b'},
            'bg_cyan':    {'background': '#06989a'},
            'bg_white':   {'background': '#d3d7cf'},

            'style_bold':   {'font': (base_font_family, base_font_size, 'bold')},
            'style_italic': {'font': (base_font_family, base_font_size, 'italic')},
            'style_underline': {'underline': 1},
        }

        self.sgr_to_tag = {
            '0': 'reset_all',
            '1': 'style_bold',
            '3': 'style_italic',
            '4': 'style_underline',
            
            '22': 'reset_bold',
            '23': 'reset_italic',
            '24': 'reset_underline',
            '39': 'reset_fg',
            '49': 'reset_bg',

            '30': 'fg_black', '31': 'fg_red', '32': 'fg_green', '33': 'fg_yellow',
            '34': 'fg_blue', '35': 'fg_magenta', '36': 'fg_cyan', '37': 'fg_white',
            
            '90': 'fg_br_black', '91': 'fg_br_red', '92': 'fg_br_green', '93': 'fg_br_yellow',
            '94': 'fg_br_blue', '95': 'fg_br_magenta', '96': 'fg_br_cyan', '97': 'fg_br_white',

            '40': 'bg_black', '41': 'bg_red', '42': 'bg_green', '43': 'bg_yellow',
            '44': 'bg_blue', '45': 'bg_magenta', '46': 'bg_cyan', '47': 'bg_white',
        }
        
        for tag_name, config in self.tag_configs.items():
            self.terminal.tag_configure(tag_name, **config)

        self.terminal.tag_configure('reset_fg', foreground='white')
        self.terminal.tag_configure('reset_bg', background='black')
        self.terminal.tag_configure('reset_bold', font=(base_font_family, base_font_size, 'normal'))
        self.terminal.tag_configure('reset_italic', font=(base_font_family, base_font_size, 'normal'))
        self.terminal.tag_configure('reset_underline', underline=0)

    def _write_to_terminal(self, text):
        self.terminal.config(state='normal')
        
        parts = self.ansi_escape_regex.split(text)
        
        if parts[0]:
            self.terminal.insert(tk.END, parts[0], tuple(self.current_tags))
        
        for sgr_codes, text_segment in zip(parts[1::2], parts[2::2]):
            
            if not sgr_codes:
                sgr_codes = '0'
                
            codes = sgr_codes.split(';')
            for code in codes:
                tag_name = self.sgr_to_tag.get(code)

                if tag_name == 'reset_all':
                    self.current_tags.clear()
                elif tag_name == 'reset_fg':
                    self.current_tags = [t for t in self.current_tags if not t.startswith('fg_')]
                elif tag_name == 'reset_bg':
                    self.current_tags = [t for t in self.current_tags if not t.startswith('bg_')]
                elif tag_name == 'reset_bold':
                    if 'style_bold' in self.current_tags:
                        self.current_tags.remove('style_bold')
                elif tag_name == 'reset_italic':
                    if 'style_italic' in self.current_tags:
                        self.current_tags.remove('style_italic')
                elif tag_name == 'reset_underline':
                    if 'style_underline' in self.current_tags:
                        self.current_tags.remove('style_underline')
                
                elif tag_name and tag_name.startswith('fg_'):
                    self.current_tags = [t for t in self.current_tags if not t.startswith('fg_')]
                    self.current_tags.append(tag_name)
                elif tag_name and tag_name.startswith('bg_'):
                    self.current_tags = [t for t in self.current_tags if not t.startswith('bg_')]
                    self.current_tags.append(tag_name)
                elif tag_name and tag_name.startswith('style_'):
                    if tag_name not in self.current_tags:
                        self.current_tags.append(tag_name)

            if text_segment:
                self.terminal.insert(tk.END, text_segment, tuple(self.current_tags))

        self.terminal.see(tk.END)
        self.terminal.config(state=tk.DISABLED)

    def _clear_terminal(self):
        self.terminal.config(state=tk.NORMAL)
        self.terminal.delete('1.0', tk.END)
        self.terminal.config(state=tk.DISABLED)
        self.current_tags = []


if __name__ == '__main__':
    root = tb.Window(themename="litera")
    root.minsize(900, 600)
    app = BackendGUI(root)
    root.mainloop()