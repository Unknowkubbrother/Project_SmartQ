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

HERE = os.path.dirname(os.path.abspath(__file__))
CONFIG_PATH = os.path.join(HERE, 'config', 'config.json')

class BackendGUI:
    def __init__(self, root):
        self.root = root
        self.root.title('SmartQ Server Control')
        
        self.proc = None
        self.thread = None
        self.queue = queue.Queue()
        self.config = {}
        self.current_service_index = None

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

        tb.Label(cfg_frame, text='Logo File:').grid(row=1, column=0, sticky=W, padx=5, pady=5)
        self.logo_entry = tb.Entry(cfg_frame, width=60)
        self.logo_entry.grid(row=1, column=1, columnspan=2, sticky='ew', pady=5, padx=5)
        self.logo_browse_btn = tb.Button(cfg_frame, text='Upload Logo...', command=self._browse_logo, bootstyle=SECONDARY)
        self.logo_browse_btn.grid(row=1, column=3, sticky=W, padx=5, pady=5)

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
        
        self.terminal = ScrolledText(term_group, wrap='word', height=20, state='disabled', bg='black', fg='white', font=('Consolas', 10) if os.name == 'nt' else ('Monaco', 11))
        self.terminal.pack(fill=BOTH, expand=True)

    def _choose_color(self):
        """
        Opens the color picker dialog and updates the color entry and preview.
        """
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
        """
        Open a file dialog to select an image, copy it to the 'assets'
        folder, and put just the filename in the logo_entry.
        """
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
            self._load_config()
            self.root.title(f'SmartQ Server Control - {os.path.basename(CONFIG_PATH)}')
            self._write_to_terminal(f'Using config: {CONFIG_PATH}\n')

    def _load_config(self):
        try:
            with open(CONFIG_PATH, 'r', encoding='utf-8') as f:
                cfg = json.load(f)
        except Exception as e:
            messagebox.showerror('Error', f'Failed to load config: {e}')
            return
        self.config = cfg
        self.root.title(f'SmartQ Server Control - {os.path.basename(CONFIG_PATH)}')
        
        self.hospital_entry.delete(0, tk.END)
        self.hospital_entry.insert(0, cfg.get('HOSPITAL_NAME', ''))
        
        self.logo_entry.delete(0, tk.END)
        self.logo_entry.insert(0, cfg.get('LOGO_FILE', ''))
        
        db = cfg.get('DB', {})
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
            with open(CONFIG_PATH, 'w', encoding='utf-8') as f:
                json.dump(self.config, f, ensure_ascii=False, indent=4)
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
        venv_py = None
        candidate = os.path.join(HERE, '.venv', 'bin', 'python')
        if os.name == 'nt':
            candidate = os.path.join(HERE, '.venv', 'Scripts', 'python.exe')
        if os.path.exists(candidate) and os.access(candidate, os.X_OK):
            venv_py = candidate

        interpreter = venv_py or sys.executable
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
        try:
            self._write_to_terminal(f'Attempting module start: {cmd_module}\n')
            env = os.environ.copy()
            env['SMARTQ_PORT'] = str(port_to_use)
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

    def _write_to_terminal(self, text):
        self.terminal.config(state='normal')
        self.terminal.insert(tk.END, text)
        self.terminal.see(tk.END)
        self.terminal.config(state=tk.DISABLED)

    def _clear_terminal(self):
        self.terminal.config(state=tk.NORMAL)
        self.terminal.delete('1.0', tk.END)
        self.terminal.config(state=tk.DISABLED)


if __name__ == '__main__':
    root = tb.Window(themename="litera")
    root.minsize(900, 600)
    app = BackendGUI(root)
    root.mainloop()
