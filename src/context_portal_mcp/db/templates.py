"""
Template content for auto-generated ConPort files.
This module contains templates for portal_launcher.py and portal_killer.py
to keep the main database.py file more manageable.
"""

# Template for auto-generated portal launcher script
LAUNCHER_PY_TEMPLATE = """#!/usr/bin/env python3
import argparse
import os
import sys
import subprocess
import time
import socket
import signal
import contextlib
import webbrowser
import urllib.request
import urllib.error
from typing import Optional, Tuple
import importlib, importlib.util
from pathlib import Path
import platform
import re

# Central UI path recorded when this launcher was created
# This ensures multi-project launchers can find the central AIMED UI
AIMED_UI_PATH = "{aimed_ui_path}"  # Will be populated by templates.py when creating launcher
os.environ.setdefault("CONPORT_UI_ABS_DIR", AIMED_UI_PATH)

# Central Python executable path from STDIO MCP server
# This ensures HTTP MCP server uses the same Python environment
CENTRAL_PYTHON_PATH = r"{conport_python_path}"  # Will be populated by database.py when creating launcher

# stderr helper
def eprint(*a, **k): print(*a, file=sys.stderr, **k)

# Debug helpers (will be redefined based on --debug flag)
def debug_print(message, level="INFO"):
    \"\"\"Debug print function - will be silenced unless --debug is used\"\"\"
    print(f"[launcher:{level}] {message}", file=sys.stderr)

def debug_environment():
    \"\"\"Print environment debug information\"\"\"
    debug_print("=== DEBUG ENVIRONMENT ===", "DEBUG")
    debug_print(f"Platform: {platform.system()} {platform.release()}", "DEBUG")
    debug_print(f"Python: {sys.executable}", "DEBUG")
    debug_print(f"Working Directory: {os.getcwd()}", "DEBUG")
    debug_print(f"WSL Detection: {'microsoft' in platform.uname().release.lower()}", "DEBUG")
    debug_print(f"WSL_DISTRO_NAME: {os.environ.get('WSL_DISTRO_NAME', 'Not set')}", "DEBUG")
    debug_print(f"AIMED_UI_PATH: {AIMED_UI_PATH}", "DEBUG")
    debug_print("=== END DEBUG ENVIRONMENT ===", "DEBUG")

def update_next_config(ui_dir_path: str, wsl_ip: Optional[str]):
    \"\"\"
    Ensures next.config.ts has the current WSL2 IP for CORS.
    No backup/restore - config persists and self-corrects on WSL restart.
    Multi-project safe: all launchers share and cooperate on same config.
    \"\"\"
    if not wsl_ip:
        return

    # Always use the central UI path for config updates
    central_ui_path = AIMED_UI_PATH if AIMED_UI_PATH != "{aimed_ui_path}" else ui_dir_path
    config_path = Path(central_ui_path) / "next.config.ts"

    try:
        if not config_path.exists():
            debug_print("No next.config.ts found to update", "WARNING")
            return
            
        current_content = config_path.read_text()
        
        # Already has correct IP? Nothing to do
        if f"'{wsl_ip}'" in current_content:
            debug_print(f"Correct WSL IP {wsl_ip} already present in next.config.ts", "DEBUG")
            return

        # Has stale/different IP? Replace it
        if "allowedDevOrigins" in current_content:
            updated_content = re.sub(
                r"allowedDevOrigins:\\s*\\[[^\\]]*\\]",
                f"allowedDevOrigins: ['{wsl_ip}']",
                current_content,
                count=1
            )
            debug_print(f"Replaced stale IP with current WSL IP {wsl_ip}", "INFO")
        else:
            # No IP yet? Add it
            updated_content = current_content.replace(
                "const nextConfig: NextConfig = {",
                f"const nextConfig: NextConfig = {{\\n  allowedDevOrigins: ['{wsl_ip}'],",
                1
            )
            debug_print(f"Added WSL IP {wsl_ip} to next.config.ts", "INFO")
        
        config_path.write_text(updated_content)

    except Exception as e:
        eprint(f"[launcher] Failed to update next.config.ts: {e}")

# Environment helpers
def env_bool(name: str, default: bool = False) -> bool:
    v = os.getenv(name)
    if v is None:
        return default
    return v.strip().lower() in ("1", "true", "yes", "on")

def env_int(name: str, default: Optional[int] = None) -> Optional[int]:
    v = os.getenv(name)
    if v is None or v == "":
        return default
    try:
        return int(v)
    except ValueError:
        return default

def workspace_root_from_here() -> str:
    # FIXED: Use script location for consistent workspace detection
    # The launcher is created in the workspace's context_portal_aimed directory
    # So parent of script directory is the workspace root
    here = os.path.abspath(os.path.dirname(__file__))
    return os.path.dirname(here)

def is_port_open(host: str, port: int, timeout: float = 0.5) -> bool:
    with contextlib.closing(socket.socket(socket.AF_INET, socket.SOCK_STREAM)) as sock:
        sock.settimeout(timeout)
        return sock.connect_ex((host, port)) == 0

def wait_for_port(host: str, port: int, timeout: float) -> bool:
    deadline = time.time() + timeout
    while time.time() < deadline:
        if is_port_open(host, port):
            return True
        time.sleep(0.5)
    return is_port_open(host, port)

def http_ping(url: str, timeout: float = 2.0) -> bool:
    try:
        req = urllib.request.Request(url, method='GET')
        with urllib.request.urlopen(req, timeout=timeout) as resp:
            code = getattr(resp, 'status', 200)
            return 200 <= code < 500
    except Exception:
        return False

def wait_for_http(url: str, timeout: float) -> bool:
    deadline = time.time() + timeout
    while time.time() < deadline:
        if http_ping(url):
            return True
        time.sleep(0.5)
    return http_ping(url)

def find_free_port(host: str, start_port: int, max_tries: int = 50) -> int:
    \"\"\"
    Finds the next available TCP port on the given host, starting from start_port.
    Returns the first free port found, or start_port + max_tries if none were free.
    \"\"\"
    port = start_port
    tries = 0
    while tries < max_tries and is_port_open(host, port):
        port += 1
        tries += 1
    return port

def resolve_ui_dir(workspace_root: str, ui_dir: str) -> str:
    \"\"\"
    Resolve UI directory path with fallback options.
    Order: 1) Central UI path 2) Environment override 3) Workspace-relative 4) Workspace detection 5) Package heuristic
    \"\"\"
    workspace_path = Path(workspace_root)
    
    # 1) Recorded central UI path (set when launcher was created)
    if AIMED_UI_PATH and AIMED_UI_PATH != "":
        p = Path(AIMED_UI_PATH).expanduser().resolve()
        
        # Convert WSL mount paths to proper format if needed
        if str(p).startswith("/mnt/") and len(str(p).split("/")) >= 3:
            parts = str(p).split("/")
            if parts[1] == "mnt" and len(parts) >= 3:
                drive = parts[2].upper()
                if platform.system() == "Windows":
                    windows_path = f"{drive}:/" + "/".join(parts[3:])
                    p = Path(windows_path)
        
        if p.is_dir():
            return str(p)

    # 2) Environment override (fallback)
    env_dir = os.getenv("CONPORT_UI_ABS_DIR")
    if env_dir and env_dir.strip() and env_dir != AIMED_UI_PATH:
        p = Path(env_dir).expanduser().resolve()
        if p.is_dir():
            return str(p)

    # 3) Workspace-relative UI
    p2 = workspace_path / ui_dir
    if p2.is_dir():
        return str(p2.resolve())

    # 4) Use workspace detection to find the proper UI directory
    try:
        from src.context_portal_mcp.core.workspace_detector import auto_detect_workspace
        detected_workspace = auto_detect_workspace(workspace_root)
        detected_ui = Path(detected_workspace) / ui_dir
        if detected_ui.is_dir():
            return str(detected_ui.resolve())
    except Exception:
        pass

    # 5) Heuristic via installed package location (best-effort)
    try:
        spec = importlib.util.find_spec("context_portal_mcp")
        if spec and spec.origin:
            module_path = Path(spec.origin).resolve()
            candidates = [
                module_path.parent.parent / "ui",
                module_path.parent.parent.parent / "ui",
                module_path.parent / "ui",
            ]
            for cand in candidates:
                if cand.is_dir():
                    return str(cand.resolve())
    except Exception:
        pass

    raise FileNotFoundError(f"UI directory not found. Tried multiple locations for '{ui_dir}'.")

def detect_isolated_environment() -> bool:
    \"\"\"
    Detect if we're in an isolated environment where localhost binding
    won't be accessible from external systems (generic detection for WSL, Docker, etc.)
    \"\"\"
    if platform.system().lower() != "linux":
        return False
    
    # Check for common virtualization indicators (not hardcoded to specific platforms)
    virtualization_indicators = [
        ("microsoft" in platform.uname().release.lower()),  # WSL
        bool(os.environ.get("WSL_DISTRO_NAME")),           # WSL env var
        os.path.exists("/.dockerenv"),                      # Docker
        bool(os.environ.get("CONTAINER")),                 # Generic container
        bool(os.environ.get("KUBERNETES_SERVICE_HOST")),   # Kubernetes
    ]
    
    return any(virtualization_indicators)

def get_wsl_ip() -> Optional[str]:
    \"\"\"Get WSL2 IP address for Windows host access\"\"\"
    try:
        # Get WSL2 IP from hostname command
        result = subprocess.run(['hostname', '-I'], capture_output=True, text=True)
        if result.returncode == 0:
            # hostname -I returns space-separated IPs, take the first one
            ips = result.stdout.strip().split()
            if ips:
                wsl_ip = ips[0]
                return wsl_ip
    except Exception as e:
        pass  # Quietly handle WSL IP detection failure
    
    return None

def provide_access_instructions(effective_port: int, is_isolated: bool):
    \"\"\"Provide user instructions and return the optimal browser URL for accessing the UI\"\"\"
    if not is_isolated:
        url = f"http://localhost:{effective_port}/"
        debug_print(f"✓ UI accessible at: {url}", "DEBUG")
        return url
    
    # For isolated environments, determine the best URL and provide multiple access options
    debug_print(f"✓ UI running on port {effective_port}", "DEBUG")
    debug_print(f"📍 Access from within this environment: http://localhost:{effective_port}/", "DEBUG")
    
    # Try to provide WSL2 IP for Windows host access
    if ("microsoft" in platform.uname().release.lower()) or bool(os.environ.get("WSL_DISTRO_NAME")):
        wsl_ip = get_wsl_ip()
        if wsl_ip:
            wsl_url = f"http://{wsl_ip}:{effective_port}/"
            debug_print(f"🌐 Access from Windows host: {wsl_url}", "DEBUG")
            debug_print(f"💡 Auto-opening browser with WSL2 IP for Windows access", "DEBUG")
            return wsl_url  # Return WSL2 IP URL for automatic browser opening
        else:
            debug_print(f"💡 For Windows host access, find WSL2 IP with: wsl hostname -I", "DEBUG")
            debug_print(f"💡 Then access via: http://<WSL2_IP>:{effective_port}/", "DEBUG")
            return f"http://localhost:{effective_port}/"  # Fallback to localhost
    
    # For other isolated environments (Docker, etc.), use localhost
    return f"http://localhost:{effective_port}/"

def get_workspace_mcp_port(workspace_root: str) -> Optional[int]:
    \"\"\"
    Get the cached MCP server port from consolidated env_vars.json.
    Returns None if no port is cached or if the cached port is no longer available.
    \"\"\"
    try:
        # Import UI cache functions from the central ConPort installation
        central_conport_path = AIMED_UI_PATH.replace('/ui', '') if AIMED_UI_PATH else None
        if central_conport_path:
            sys.path.insert(0, central_conport_path)
            from src.context_portal_mcp.core.ui_cache import load_workspace_env_vars
            
            env_vars = load_workspace_env_vars(workspace_root)
            cached_port = env_vars.get("mcp_server_port")
            if cached_port and isinstance(cached_port, int):
                # Use same host detection as main launcher for consistency
                is_isolated = detect_isolated_environment()
                host = "0.0.0.0" if is_isolated else "127.0.0.1"
                # Verify the port is still available for reuse
                if not is_port_open(host, cached_port):
                    debug_print(f"Reusing cached MCP server port {cached_port} from env_vars.json", "CACHE")
                    return cached_port
                else:
                    debug_print(f"Cached MCP server port {cached_port} is now busy, will find new port", "CACHE")
            return None
    except Exception as e:
        debug_print(f"Failed to load cached MCP server port from env_vars.json: {e}", "WARNING")
        return None

def save_workspace_mcp_port(workspace_root: str, port: int) -> None:
    \"\"\"
    Save the successful MCP server port to consolidated env_vars.json only.
    Legacy individual cache files are no longer created.
    \"\"\"
    try:
        # Import UI cache functions from the central ConPort installation
        central_conport_path = AIMED_UI_PATH.replace('/ui', '') if AIMED_UI_PATH else None
        if central_conport_path:
            sys.path.insert(0, central_conport_path)
            from src.context_portal_mcp.core.ui_cache import update_workspace_env_var
            
            # ONLY update consolidated env_vars.json, no individual cache files
            update_workspace_env_var(workspace_root, "mcp_server_port", port)
            debug_print(f"Cached MCP server port {port} in consolidated env_vars.json", "CACHE")
    except Exception as e:
        debug_print(f"Failed to cache MCP server port {port} in env_vars.json: {e}", "WARNING")

def find_workspace_specific_mcp_port(workspace_root: str, base_port: int = 8020) -> int:
    \"\"\"
    Find an available MCP server port for this workspace.
    FIXED: Always start fresh - check base port first, immediately update cache.
    Cache is updated BEFORE server starts, not after checking stale data.
    \"\"\"
    # Use same host detection logic as main launcher
    is_isolated = detect_isolated_environment()
    host = "0.0.0.0" if is_isolated else "127.0.0.1"
    debug_print(f"Port detection using host: {host} (isolated: {is_isolated})", "CACHE")
    
    # Check if base port is available (preferred)
    if not is_port_open(host, base_port):
        available_port = base_port
        debug_print(f"Base port {base_port} is available, using fresh start", "CACHE")
    else:
        # Base port busy, find next available
        available_port = find_free_port(host, base_port)
        debug_print(f"Base port {base_port} busy, allocated port {available_port}", "CACHE")
    
    # IMMEDIATELY update cache with the port we're about to use
    save_workspace_mcp_port(workspace_root, available_port)
    
    # CRITICAL FIX: Immediately update consolidated env_vars.json with discovered port
    try:
        central_conport_path = AIMED_UI_PATH.replace('/ui', '') if AIMED_UI_PATH else None
        if central_conport_path:
            sys.path.insert(0, central_conport_path)
            from src.context_portal_mcp.core.ui_cache import update_workspace_env_var
            
            # Update the MCP server port immediately to prevent stale data CORS failures
            update_workspace_env_var(workspace_root, "mcp_server_port", available_port)
            debug_print(f"Updated consolidated env_vars.json with MCP port {available_port}", "CACHE")
    except Exception as e:
        debug_print(f"Failed to update consolidated env_vars.json with MCP port {available_port}: {e}", "WARNING")
    
    debug_print(f"Allocated MCP server port {available_port} for workspace {workspace_root}", "CACHE")
    return available_port

def open_browser(url: str) -> None:
    \"\"\"
    Open URL in user's default browser with robust fallbacks across platforms.
    Suppresses noisy stdout/stderr from fallback openers (e.g., gio 'Operation not supported').
    On Linux/WSL, prefer direct openers and avoid webbrowser.open to prevent 'gio' noise.
    \"\"\"
    try:
        if sys.platform.startswith("linux"):
            # Detect WSL
            is_wsl_env = ("microsoft" in platform.uname().release.lower()) or bool(os.environ.get("WSL_DISTRO_NAME"))
            linux_cmds = []
            if is_wsl_env:
                linux_cmds.extend([["wslview", url], ["powershell.exe", "-NoProfile", "Start-Process", url], ["cmd.exe", "/c", "start", "", url]])
            
            # Fall back to common Linux openers (excluding gio to avoid noisy stderr)
            # Add python's webbrowser CLI as a robust option.
            linux_cmds.extend([
                ["xdg-open", url],
                ["gnome-open", url],
                ["kde-open", url],
                [sys.executable, "-m", "webbrowser", "-t", url]
            ])

            for cmd in linux_cmds:
                try:
                    subprocess.Popen(cmd, stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
                    return
                except Exception:
                    continue
            # If command-line openers fail, fall through to Python's webbrowser module.
            # This might be noisy (e.g., 'gio' errors) but is a final attempt.

        # For non-Linux, or as a fallback for Linux:
        ok = webbrowser.open(url, new=2)  # new tab if possible
        if ok:
            return
    except Exception as ex:
        eprint(f"[launcher] webbrowser.open failed: {ex}")

    # Platform-specific fallbacks (stdout/stderr suppressed)
    try:
        if sys.platform == "darwin":  # macOS
            subprocess.Popen(["open", url], stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
            return
        elif os.name == "nt":  # Windows
            # Use start via cmd to honor default browser
            subprocess.Popen(["cmd", "/c", "start", "", url], shell=True, stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
            return
    except Exception as ex:
        eprint(f"[launcher] Fallback browser open failed: {ex}")

class Managed:
    def __init__(self, name: str, popen: Optional[subprocess.Popen], already: bool):
        self.name = name
        self.popen = popen
        self.already = already

    def terminate(self, grace: float = 8.0):
        if self.popen is None:
            return
        if self.already:
            return
        try:
            if self.popen.poll() is None:
                self.popen.terminate()
                deadline = time.time() + grace
                while time.time() < deadline and self.popen.poll() is None:
                    time.sleep(0.2)
                if self.popen.poll() is None:
                    self.popen.kill()
        except Exception as ex:
            eprint(f"[launcher] terminate error for {self.name}: {ex}")

def start_conport(workspace_root: str, host: str, port: int, timeout: float) -> Tuple[Managed, int]:
    \"\"\"
    Ensure a ConPort server is available on host:port.
    - If port already serves a ConPort HTTP, skip starting.
    - Otherwise, try multiple start commands (installed package or repo checkout).
    Returns (ManagedProcess, effective_port).
    \"\"\"
    if is_port_open(host, port):
        debug_print(f"ConPort server detected at {host}:{port}, skipping start.", "INFO")
        return Managed("conport", None, already=True), port

    env = os.environ.copy()
    # Include workspace in PYTHONPATH (useful when running from a repo checkout)
    env["PYTHONPATH"] = env.get("PYTHONPATH", "")
    if workspace_root not in env["PYTHONPATH"].split(os.pathsep):
        env["PYTHONPATH"] = (workspace_root + os.pathsep + env["PYTHONPATH"]).strip(os.pathsep)

    # FIXED: Prioritize src.context_portal_mcp.main for Windows compatibility
    cmd_candidates = [
        [sys.executable, "-m", "src.context_portal_mcp.main", "--mode", "http", "--host", host, "--port", str(port)],
        [sys.executable, "-m", "context_portal_mcp.main", "--mode", "http", "--host", host, "--port", str(port)],
        ["conport-mcp", "--mode", "http", "--host", host, "--port", str(port)],
    ]

    for cmd in cmd_candidates:
        try:
            debug_print(f"Trying ConPort server: {' '.join(cmd)} (cwd={workspace_root})", "INFO")
            p = subprocess.Popen(cmd, cwd=workspace_root, env=env)
            if wait_for_port(host, port, timeout):
                return Managed("conport", p, already=False), port
            eprint(f"[launcher] WARN: {host}:{port} not ready after {timeout}s with: {' '.join(cmd)}. Trying next...")
            try:
                if p.poll() is None:
                    p.terminate()
                    time.sleep(1)
            except Exception:
                pass
        except FileNotFoundError as ex:
            eprint(f"[launcher] Command not found: {' '.join(cmd)} ({ex}). Trying next...")
            continue

    eprint(f"[launcher] ERROR: Unable to start ConPort server on {host}:{port}.")
    return Managed("conport", None, already=False), port

def start_ui(
    workspace_root: str,
    ui_dir: str,
    port: int,
    ui_cmd: Optional[str],
    timeout: float,
    server_host: str,
    server_port: int
) -> Tuple[Managed, str]:
    \"\"\"
    Start a NEW Next.js UI instance for this session on a free port (do not reuse an existing one).
    Automatically configures network binding for isolated environments (WSL2, Docker, etc.)
    Returns (ManagedProcess, ui_url).
    \"\"\"
    # Resolve UI path
    debug_print(f"=== STARTING UI RESOLUTION ===", "UI")
    debug_print(f"Input parameters - workspace_root: {workspace_root}, ui_dir: {ui_dir}")
    dir_path = resolve_ui_dir(workspace_root, ui_dir)
    debug_print(f"Resolved UI path: {dir_path}", "UI")

    # Always allocate the first available UI port starting from base port (dynamic allocation)
    effective_port = find_free_port("127.0.0.1", port)
    if effective_port != port:
        debug_print(f"UI port {port} busy. Allocated port {effective_port}.", "DEBUG")
    else:
        debug_print(f"UI port {effective_port} available.", "DEBUG")
    
    # Cache the allocated UI port - ONLY in consolidated env_vars.json
    try:
        central_conport_path = AIMED_UI_PATH.replace('/ui', '') if AIMED_UI_PATH else None
        if central_conport_path:
            sys.path.insert(0, central_conport_path)
            from src.context_portal_mcp.core.ui_cache import update_workspace_env_var
            
            # ONLY update consolidated env_vars.json, no individual cache files
            update_workspace_env_var(workspace_root, "ui_port", effective_port)
            debug_print(f"Updated consolidated env_vars.json with UI port {effective_port}", "CACHE")
            
            # CRITICAL: Register UI port in central mapping for API route
            try:
                # Write directly to central mapping file (FIXED: proper template replacement detection)
                central_mapping_file = AIMED_UI_PATH.replace('/ui', '/context_portal_aimed/ui-cache/port_workspace_mapping.json')
                
                debug_print(f"[CENTRAL_MAPPING] Attempting to create central mapping file: {central_mapping_file}", "DEBUG")
                
                # FIXED: Proper condition to detect successful template replacement (platform-agnostic)
                if central_mapping_file and os.path.isabs(central_mapping_file) and '{' not in central_mapping_file and '}' not in central_mapping_file:
                    import json
                    debug_print(f"[CENTRAL_MAPPING] Condition passed, proceeding with file creation", "DEBUG")
                    
                    # Ensure directory exists
                    central_mapping_dir = os.path.dirname(central_mapping_file)
                    debug_print(f"[CENTRAL_MAPPING] Creating directory: {central_mapping_dir}", "DEBUG")
                    try:
                        os.makedirs(central_mapping_dir, exist_ok=True)
                        debug_print(f"[CENTRAL_MAPPING] Directory created successfully", "DEBUG")
                    except Exception as dir_e:
                        debug_print(f"[CENTRAL_MAPPING] FAILED to create directory: {dir_e}", "ERROR")
                        raise dir_e
                    
                    # Load existing mapping or create empty mapping if file doesn't exist
                    mapping = {}
                    if os.path.exists(central_mapping_file):
                        try:
                            with open(central_mapping_file, 'r') as f:
                                mapping = json.load(f)
                                debug_print(f"[CENTRAL_MAPPING] Loaded existing mapping: {mapping}", "DEBUG")
                        except Exception as load_e:
                            debug_print(f"[CENTRAL_MAPPING] Failed to load existing mapping, starting fresh: {load_e}", "WARNING")
                            mapping = {}
                    else:
                        debug_print(f"[CENTRAL_MAPPING] No existing file, creating new mapping", "DEBUG")
                    
                    # CLEANUP STALE ENTRIES (prevent multiple ports for same workspace)
                    # Remove entries that:
                    # 1) Point to the same workspace (workspace moved to new port)
                    # 2) Use the same port (port freed up, old mapping is stale)
                    cleaned_mapping = {}
                    for port, ws in mapping.items():
                        # Keep entry only if it's NOT for our workspace and NOT for our port
                        if ws != workspace_root and port != str(effective_port):
                            cleaned_mapping[port] = ws
                        else:
                            debug_print(f"[CENTRAL_MAPPING] Cleaned up stale entry: port {port} -> {ws}", "INFO")
                    
                    mapping = cleaned_mapping
                    
                    # Add current UI port → workspace mapping
                    mapping[str(effective_port)] = workspace_root
                    debug_print(f"[CENTRAL_MAPPING] Registered port {effective_port} -> {workspace_root}", "INFO")
                    
                    # Save updated mapping with comprehensive error handling
                    try:
                        with open(central_mapping_file, 'w') as f:
                            json.dump(mapping, f, indent=2)
                        debug_print(f"[CENTRAL_MAPPING] ✓ SUCCESS: Central mapping file saved to {central_mapping_file}", "INFO")
                        debug_print(f"[CENTRAL_MAPPING] ✓ Mapping contents: {mapping}", "DEBUG")
                    except Exception as save_e:
                        debug_print(f"[CENTRAL_MAPPING] ❌ FAILED to save mapping file: {save_e}", "ERROR")
                        raise save_e
                else:
                    debug_print(f"[CENTRAL_MAPPING] ❌ Condition FAILED for file: {central_mapping_file}", "ERROR")
                    if not central_mapping_file:
                        debug_print(f"[CENTRAL_MAPPING] ❌ Reason: central_mapping_file is empty", "ERROR")
                    elif not os.path.isabs(central_mapping_file):
                        debug_print(f"[CENTRAL_MAPPING] ❌ Reason: not an absolute path", "ERROR")
                    elif '{' in central_mapping_file or '}' in central_mapping_file:
                        debug_print(f"[CENTRAL_MAPPING] ❌ Reason: template replacement failed (contains braces)", "ERROR")
                    else:
                        debug_print(f"[CENTRAL_MAPPING] ❌ Reason: unknown condition failure", "ERROR")
            except Exception as reg_e:
                debug_print(f"[CENTRAL_MAPPING] ❌ EXCEPTION during central mapping creation: {reg_e}", "ERROR")
                import traceback
                debug_print(f"[CENTRAL_MAPPING] ❌ Traceback: {traceback.format_exc()}", "ERROR")
                # Don't re-raise to avoid breaking UI startup, but log the failure clearly
    except Exception as e:
        debug_print(f"Failed to cache UI port {effective_port}: {e}", "WARNING")

    # Detect if we need external network access (cross-platform solution)
    is_isolated = detect_isolated_environment()
    debug_print(f"Isolated environment detected: {is_isolated}", "NETWORK")
    
    if is_isolated:
        # Use 0.0.0.0 to allow external access from host system
        ui_host = "0.0.0.0"
        debug_print("Configuring for external access (0.0.0.0 binding)", "NETWORK")
    else:
        # Use localhost for normal environments
        ui_host = "localhost"
        debug_print("Configuring for local access (localhost binding)", "NETWORK")

    url = f"http://localhost:{effective_port}/"  # Always use localhost for browser

    env = os.environ.copy()
    env["PORT"] = str(effective_port)
    env["HOST"] = ui_host  # Tell Next.js which interface to bind to
    env["HOSTNAME"] = ui_host  # Alternative env var some frameworks use
    # FIXED: Use ui-cache for workspace environment variables - NO LEGACY FALLBACKS
    # Import UI cache functions from the central ConPort installation
    central_conport_path = AIMED_UI_PATH.replace('/ui', '') if AIMED_UI_PATH else None
    if not central_conport_path:
        eprint(f"[launcher] ERROR: No central ConPort path available. Cannot create consolidated env_vars.json")
        eprint(f"[launcher] AIMED_UI_PATH is not configured. ConPort installation may be corrupted.")
        sys.exit(1)
    
    sys.path.insert(0, central_conport_path)
    try:
        from src.context_portal_mcp.core.ui_cache import save_workspace_env_vars, update_workspace_env_var
    except ImportError as e:
        eprint(f"[launcher] ERROR: Cannot import ui_cache functions: {e}")
        eprint(f"[launcher] ConPort installation at {central_conport_path} may be corrupted")
        sys.exit(1)
    
    # Prepare consolidated environment variables
    wsl_ip = None
    wsl_gateway_ip = None
    conport_server_url = f"http://localhost:{server_port}/mcp/"
    
    # Detect WSL2 IP if in isolated environment
    if is_isolated:
        wsl_ip = get_wsl_ip()
        if wsl_ip and (("microsoft" in platform.uname().release.lower()) or bool(os.environ.get("WSL_DISTRO_NAME"))):
            # For WSL2, use WSL2 IP for both browser and API calls
            conport_server_url = f"http://{wsl_ip}:{server_port}/mcp/"
            debug_print(f"WSL2 detected - using WSL2 IP for MCP server URL: {wsl_ip}:{server_port}", "NETWORK")
            
            # Dynamically update next.config.ts for CORS (updates central UI)
            update_next_config(dir_path, wsl_ip)
            
            # Get WSL2 gateway IP for CORS configuration
            try:
                gateway_result = subprocess.run(['ip', 'route', 'show', 'default'], capture_output=True, text=True)
                if gateway_result.returncode == 0:
                    for line in gateway_result.stdout.strip().split('\\n'):
                        if 'default via' in line:
                            wsl_gateway_ip = line.split('via')[1].split()[0]
                            if wsl_gateway_ip != wsl_ip:
                                debug_print(f"Detected WSL2 gateway IP: {wsl_gateway_ip}", "CACHE")
                            break
            except Exception as gw_e:
                debug_print(f"Failed to detect gateway IP: {gw_e}", "WARNING")
    
    # Save consolidated environment variables to ui-cache - REQUIRED, NO FALLBACKS
    # Include debug flag state for UI route output control
    debug_enabled = globals().get('debug_print', lambda *a, **k: None).__name__ != 'quiet_debug_print'
    
    consolidated_env = {
        "workspace_id": "{workspace_id}",  # Template variable - will be replaced at creation time
        "mcp_server_port": server_port,
        "ui_port": effective_port,
        "conport_server_url": conport_server_url,
        "wsl2_ip": wsl_ip,
        "wsl2_gateway_ip": wsl_gateway_ip,
        "central_python_executable": CENTRAL_PYTHON_PATH,  # CRITICAL FIX (Progress 85/86): Include central Python path
        "debug_enabled": debug_enabled
    }
    
    try:
        save_workspace_env_vars(workspace_root, consolidated_env)
        debug_print(f"Saved consolidated environment variables to ui-cache", "CACHE")
    except Exception as e:
        eprint(f"[launcher] ERROR: Failed to save consolidated environment variables: {e}")
        eprint(f"[launcher] Cannot continue without proper env_vars.json configuration")
        sys.exit(1)
    
    debug_print(f"Network configuration - Host binding: {ui_host}, Browser URL: {url}", "NETWORK")
    debug_print(f"Environment: HOST={ui_host}, PORT={effective_port}", "NETWORK")

    # Build proper Next.js command with hostname binding
    if ui_cmd:
        cmd = ui_cmd
    else:
        # Default Next.js command with proper hostname binding for isolated environments
        if is_isolated:
            cmd = f"npm run dev -- --hostname {ui_host} --port {effective_port}"
            debug_print(f"Using isolated environment command with 0.0.0.0 binding", "NETWORK")
        else:
            cmd = "npm run dev"
            debug_print(f"Using standard command for normal environment", "NETWORK")
    
    debug_print(f"Command: {cmd}", "UI")
    debug_print(f"Working directory: {dir_path}", "UI")
    debug_print(f"Environment: NEXT_PUBLIC_CONPORT_SERVER_URL={env.get('NEXT_PUBLIC_CONPORT_SERVER_URL')}", "UI")
    
    debug_print(f"Starting UI: {cmd} (cwd={dir_path}, PORT={effective_port})", "DEBUG")
    p = subprocess.Popen(cmd, cwd=dir_path, env=env, shell=True)
    
    debug_print(f"UI process started with PID: {p.pid}", "UI")
    
    # This duplicate UI port caching is now handled above - removed to prevent legacy cache files
    
    if not wait_for_http(url, timeout):
        debug_print(f"WARN: UI not responding at {url} after {timeout}s.", "WARNING")
        debug_print("UI failed to respond - checking process status", "ERROR")
        if p.poll() is not None:
            debug_print(f"UI process exited with code: {p.poll()}", "ERROR")
        else:
            debug_print("UI process still running but not responding to HTTP", "WARNING")
    else:
        # UI is responding - provide access instructions and get optimal URL
        optimal_url = provide_access_instructions(effective_port, is_isolated)
        # Update the returned URL to the optimal one for cross-platform browser access
        url = optimal_url
    
    return Managed("ui", p, already=False), url

def main():
    parser = argparse.ArgumentParser(description="ConPort Portal Launcher")
    parser.add_argument("--debug", action="store_true", help="Enable verbose debug output")

    # Env var defaults (CLI flags override these)
    env_workspace_root = os.getenv("CONPORT_WORKSPACE_ROOT")
    env_conport_host = os.getenv("CONPORT_HOST")
    env_conport_port = env_int("CONPORT_PORT", None)
    env_ui_dir = os.getenv("CONPORT_UI_DIR")
    env_ui_cmd = os.getenv("CONPORT_UI_CMD")
    env_ui_port = env_int("CONPORT_UI_PORT", env_int("PORT", None))
    env_skip_server = env_bool("CONPORT_SKIP_SERVER", False)
    env_skip_ui = env_bool("CONPORT_SKIP_UI", False)
    env_no_browser = env_bool("CONPORT_NO_BROWSER", False)
    env_open_url = os.getenv("CONPORT_OPEN_URL")

    parser.add_argument("--workspace-root", default=env_workspace_root, help="Workspace root containing 'src' and optionally 'ui'. Auto-detected if not provided.")
    parser.add_argument("--conport-host", default=env_conport_host or None)  # Will be set based on environment detection
    parser.add_argument("--conport-port", type=int, default=env_conport_port or 8020)
    parser.add_argument("--ui-dir", default=env_ui_dir or "ui")
    parser.add_argument("--ui-port", type=int, default=env_ui_port or 3000)
    parser.add_argument("--ui-cmd", default=env_ui_cmd or None, help="Override UI start command (default: 'npm run dev')")
    parser.add_argument("--skip-server", action="store_true", default=env_skip_server)
    parser.add_argument("--skip-ui", action="store_true", default=env_skip_ui)
    parser.add_argument("--no-browser", action="store_true", default=env_no_browser)
    parser.add_argument("--timeout", type=float, default=60.0, help="Seconds to wait for each service readiness.")
    parser.add_argument("--open-url", default=env_open_url or None, help="URL to open after startup (default: http://127.0.0.1:<ui_port>/)")
    args = parser.parse_args()
    
    # Enable debug output only if requested
    if args.debug:
        debug_environment()
    else:
        # Silence debug output for normal operation
        def quiet_debug_print(message, level="INFO"):
            pass  # No output
        globals()['debug_print'] = quiet_debug_print

    # FIXED: Use workspace_id from env_vars.json (created at launcher generation time)
    if args.workspace_root:
        workspace_root = os.path.abspath(args.workspace_root)
        debug_print(f"Using explicit workspace from CLI: {workspace_root}", "DEBUG")
    else:
        # Read workspace_id from env_vars.json (hardcoded during launcher creation)
        try:
            import json
            from pathlib import Path
            
            # The launcher is created in workspace/context_portal_aimed/, so workspace is parent directory
            script_dir = Path(__file__).parent.absolute()
            workspace_root = script_dir.parent.as_posix()
            
            # Verify workspace_id by reading env_vars.json
            env_vars_file = script_dir / "ui-cache" / "env_vars.json"
            if env_vars_file.exists():
                with open(env_vars_file, 'r') as f:
                    env_vars = json.load(f)
                    verified_workspace_id = env_vars.get("workspace_id")
                    if verified_workspace_id:
                        workspace_root = verified_workspace_id
                        debug_print(f"Using workspace_id from env_vars.json: {workspace_root}", "DEBUG")
                    else:
                        debug_print(f"No workspace_id in env_vars.json, using script location: {workspace_root}", "DEBUG")
            else:
                debug_print(f"No env_vars.json found, using script location: {workspace_root}", "DEBUG")
        except Exception as e:
            # Fallback to script location
            script_dir = Path(__file__).parent.absolute()
            workspace_root = script_dir.parent.as_posix()
            debug_print(f"Failed to read env_vars.json: {e}, using script location: {workspace_root}", "WARNING")

    managed = []
    ui_url = f"http://localhost:{args.ui_port}/"

    def handle_signal(signum, frame):
        print(f"[launcher] Signal {signum} received, shutting down...")
        for m in reversed(managed):
            m.terminate()
        sys.exit(0)

    for sig in (signal.SIGINT, signal.SIGTERM):
        try:
            signal.signal(sig, handle_signal)
        except Exception:
            pass

    try:
        # FIRST: Start workspace-specific MCP server (purely cache-driven, no generic server reuse)
        is_isolated = detect_isolated_environment()
        mcp_host = "0.0.0.0" if is_isolated else "127.0.0.1"
        
        debug_print(f"MCP server binding - isolated environment: {is_isolated}, host: {mcp_host}", "NETWORK")
        debug_print("Starting workspace-specific MCP server (no server sharing)...", "DEBUG")
        
        # Get workspace-specific port - always start our own server
        mcp_port = find_workspace_specific_mcp_port(workspace_root)
        debug_print(f"Using workspace-specific MCP server port {mcp_port}", "SERVER")
        # Get the central ConPort installation path
        central_conport_path = AIMED_UI_PATH.replace('/ui', '') if AIMED_UI_PATH else None
        if not central_conport_path:
            # Try to detect ConPort installation location
            try:
                import importlib.util
                spec = importlib.util.find_spec("context_portal_mcp")
                if spec and spec.origin:
                    # Navigate from module to installation root
                    module_path = Path(spec.origin).resolve()
                    central_conport_path = str(module_path.parent.parent.parent)
                    debug_print(f"Detected ConPort installation: {central_conport_path}", "SERVER")
            except Exception:
                debug_print("Could not detect ConPort installation location", "ERROR")
                return
        debug_print(f"Central ConPort path: {central_conport_path}", "SERVER")
        
        # Start workspace-specific MCP server (only if port is actually free)
        if not is_port_open(mcp_host, mcp_port):
            env = os.environ.copy()
            env["PYTHONPATH"] = env.get("PYTHONPATH", "")
            if central_conport_path not in env["PYTHONPATH"].split(os.pathsep):
                env["PYTHONPATH"] = (central_conport_path + os.pathsep + env["PYTHONPATH"]).strip(os.pathsep)
            
            # DECISION 100 FIX: Use hardcoded Python path from central STDIO MCP server
            # This path was recorded when the launcher was created
            python_candidates = []
            
            # Use the central Python path if it was successfully recorded
            if CENTRAL_PYTHON_PATH and CENTRAL_PYTHON_PATH != "" and os.path.exists(CENTRAL_PYTHON_PATH):
                python_candidates.append(CENTRAL_PYTHON_PATH)
                debug_print(f"Using central Python from STDIO MCP server: {CENTRAL_PYTHON_PATH}", "INFO")
            else:
                # Central Python path not available - this means STDIO server wasn't running when launcher was created
                debug_print(f"Central Python path not available or invalid: '{CENTRAL_PYTHON_PATH}'", "WARNING")
            
            # Check if we have a valid Python to use
            if not python_candidates:
                eprint(f"[launcher] ERROR: No Python executable found!")
                eprint(f"[launcher]")
                eprint(f"[launcher] The STDIO MCP server is not running or hasn't saved its Python path yet.")
                eprint(f"[launcher] Please ensure the 'conport-aimed' STDIO MCP server is running in VSCode.")
                eprint(f"[launcher]")
                eprint(f"[launcher] To start it:")
                eprint(f"[launcher] 1. Open VSCode settings")
                eprint(f"[launcher] 2. Search for 'MCP Servers'")
                eprint(f"[launcher] 3. Ensure 'conport-aimed' server is configured and running")
                eprint(f"[launcher] 4. Try running this launcher again")
                return
            
            mcp_started = False
            for python_exe in python_candidates:
                if os.path.exists(python_exe):
                    mcp_cmd = [python_exe, "-m", "src.context_portal_mcp.main", "--mode", "http", "--host", mcp_host, "--port", str(mcp_port), "--workspace_id", workspace_root]
                    try:
                        debug_print(f"Trying MCP server with: {python_exe}", "DEBUG")
                        # Suppress stderr from failed attempts to avoid confusing error messages
                        # Only show stderr when debug mode is explicitly enabled
                        is_debug_enabled = globals().get('debug_print', lambda *a, **k: None).__name__ != 'quiet_debug_print'
                        stderr_mode = None if is_debug_enabled else subprocess.DEVNULL
                        mcp_process = subprocess.Popen(mcp_cmd, cwd=central_conport_path, env=env, stderr=stderr_mode)
                        # Wait for MCP server to be ready
                        if wait_for_port(mcp_host, mcp_port, 15.0):
                            debug_print(f"Workspace MCP server started successfully at {mcp_host}:{mcp_port}", "DEBUG")
                            managed.append(Managed("workspace_mcp_server", mcp_process, already=False))
                            mcp_started = True
                            break
                        else:
                            debug_print(f"MCP server failed to start with {python_exe}, trying next...", "WARNING")
                            if mcp_process.poll() is None:
                                mcp_process.terminate()
                    except Exception as e:
                        debug_print(f"Failed to start MCP with {python_exe}: {e}", "WARNING")
                        continue
                
            if not mcp_started:
                eprint(f"[launcher] ERROR: Could not start workspace-specific MCP server")
                eprint(f"[launcher] Please ensure ConPort is properly installed at: {central_conport_path}")
                return
        else:
            debug_print(f"Port {mcp_port} is busy, workspace MCP server likely already running", "DEBUG")

        # Now proceed with regular server/UI startup
        # Use same host detection for ConPort server consistency
        conport_host = args.conport_host or (mcp_host if is_isolated else "127.0.0.1")
        server_port_used = mcp_port  # Use the workspace-specific port
        if not args.skip_server:
            # This logic is now handled inside the workspace-specific startup block
            pass
        else:
            debug_print("Skipping server startup.", "DEBUG")

        ui_started = False
        if not args.skip_ui:
            m_ui, ui_url = start_ui(
                workspace_root,
                args.ui_dir,
                args.ui_port,
                args.ui_cmd,
                args.timeout,
                args.conport_host,
                server_port_used
            )
            managed.append(m_ui)
            ui_started = True
        else:
            debug_print("Skipping UI startup.", "DEBUG")

        # Open browser with platform-optimized URL ONLY if UI was started
        if not args.no_browser and ui_started:
            # Use the optimized URL returned by start_ui (which includes WSL2 IP detection)
            open_url = args.open_url or ui_url
            if open_url:
                debug_print(f"Opening browser at {open_url}", "DEBUG")
                debug_print(f"Cross-platform browser URL: {open_url}", "BROWSER")
                open_browser(open_url)
        elif args.skip_ui:
            debug_print("UI startup skipped - browser will not be opened.", "DEBUG")

        # If neither started, just exit
        if all(m.popen is None for m in managed):
            debug_print("Nothing to manage; exiting.", "DEBUG")
            return

        # Wait until children exit
        print("[launcher] Running. Press Ctrl+C to stop.")
        while True:
            alive = False
            for m in managed:
                if m.popen is not None and m.popen.poll() is None:
                    alive = True
            if not alive:
                break
            time.sleep(1)

    finally:
        for m in reversed(managed):
            m.terminate()

if __name__ == "__main__":
    main()
"""

# Template for auto-generated portal killer script
KILLER_PY_TEMPLATE = """#!/usr/bin/env python3
\"\"\"
ConPort Portal Killer - Stops all ConPort server processes
Cross-platform version supporting Windows, Linux, and macOS

USAGE:
  python portal_killer.py                    # Kill workspace-specific ports from env_vars.json
  python portal_killer.py --ports all        # Kill all ConPort ports (UI: 3000-3005, MCP: 8020-8025)
  python portal_killer.py --ports 8020       # Kill specific port 8020
  python portal_killer.py --ports 8020 8021  # Kill ports 8020 and 8021
  python portal_killer.py --ports 3000 8022  # Kill UI port 3000 and MCP port 8022

EXAMPLES:
  # Normal workspace cleanup (reads ports from env_vars.json):
  python portal_killer.py
  
  # Kill all ConPort ports (useful when you have multiple workspaces):
  python portal_killer.py --ports all
  
  # Manual cleanup of specific ports:
  python portal_killer.py --ports 8020 8021 8022 3000 3001
  
  # Kill just a problematic MCP server:
  python portal_killer.py --ports 8023
\"\"\"

import subprocess
import sys
import time
import platform
import os
import signal
import re

# Debug helper (will be redefined based on --debug flag, same as launcher)
def debug_print(message, level="INFO"):
    \"\"\"Debug print function - will be silenced unless --debug is used\"\"\"
    print(f"[killer:{level}] {message}", file=sys.stderr)

def get_platform():
    \"\"\"Detect the current platform\"\"\"
    system = platform.system().lower()
    if system == "windows":
        return "windows"
    elif system == "darwin":
        return "macos"
    else:
        return "linux"

def kill_processes_by_port_windows(ports):
    \"\"\"Kill processes on specified ports - Windows version\"\"\"
    for port in ports:
        try:
            result = subprocess.run(['netstat', '-ano'], capture_output=True, text=True, shell=True)
            for line in result.stdout.split('\\n'):
                if f':{port}' in line and 'LISTENING' in line:
                    parts = line.split()
                    if len(parts) >= 5:
                        pid = parts[-1]
                        try:
                            subprocess.run(['taskkill', '/F', '/PID', pid], check=True, shell=True)
                            print(f"[killer] Killed process on port {port} (PID: {pid})")
                        except subprocess.CalledProcessError:
                            debug_print(f"Failed to kill PID {pid}", "ERROR")
        except Exception as e:
            debug_print(f"Error checking port {port}: {e}", "ERROR")

def kill_processes_by_port_unix(ports):
    \"\"\"Kill processes on specified ports - Linux/macOS version\"\"\"
    for port in ports:
        try:
            # Use ss as primary method to find processes using the port
            if platform.system().lower() == "linux":
                result = subprocess.run(['ss', '-tlnp'], capture_output=True, text=True)
            else:
                # macOS fallback to netstat
                result = subprocess.run(['netstat', '-an', '-p', 'tcp'], capture_output=True, text=True)
            
            found_pids = []
            for line in result.stdout.split('\\n'):
                if f':{port}' in line and ('LISTEN' in line or 'LISTENING' in line):
                    # Extract PID from the line
                    if platform.system().lower() == "linux":
                        # ss format: users:(("process",pid=12345,fd=10))
                        match = re.search(r'pid=(\\d+)', line)
                        if match:
                            pid = match.group(1)
                            found_pids.append(pid)
                    else:
                        # macOS netstat format - need to use lsof as fallback
                        try:
                            lsof_result = subprocess.run(['lsof', '-ti', f':{port}'], capture_output=True, text=True)
                            if lsof_result.returncode == 0:
                                pids = lsof_result.stdout.strip().split('\\n')
                                found_pids.extend([pid for pid in pids if pid.strip()])
                        except FileNotFoundError:
                            print(f"[killer] lsof not available on macOS for port {port}")
                            continue
            
            # Kill all found PIDs
            for pid in found_pids:
                if pid.strip():
                    try:
                        os.kill(int(pid), signal.SIGTERM)
                        print(f"[killer] Killed process on port {port} (PID: {pid})")
                        # Give it a moment to gracefully shutdown
                        time.sleep(1)
                        # Check if still running, then force kill
                        try:
                            os.kill(int(pid), 0)  # Check if process exists
                            os.kill(int(pid), signal.SIGKILL)
                            print(f"[killer] Force killed process on port {port} (PID: {pid})")
                        except ProcessLookupError:
                            # Process already terminated
                            pass
                    except (ProcessLookupError, ValueError) as e:
                        debug_print(f"Process {pid} already terminated or invalid", "INFO")
                    except Exception as e:
                        debug_print(f"Failed to kill PID {pid}: {e}", "ERROR")
                        
        except Exception as e:
            debug_print(f"Error checking port {port}: {e}", "ERROR")

def kill_conport_processes_by_name_windows():
    \"\"\"Kill ConPort processes by name - Windows version (WORKSPACE-SPECIFIC)\"\"\"
    workspace_root = os.getcwd()  # Current workspace
    
    try:
        # FIXED: Only kill launcher processes for THIS workspace, not all launchers
        result = subprocess.run(['wmic', 'process', 'where', 'name="python.exe"', 'get', 'processid,commandline', '/format:csv'],
                              capture_output=True, text=True, shell=True)
        for line in result.stdout.split('\\n'):
            if 'portal_launcher.py' in line:
                # Check if this launcher process belongs to the current workspace
                if workspace_root.replace('/', '\\\\') in line or 'context_portal_aimed\\\\portal_launcher.py' in line:
                    parts = line.split(',')
                    if len(parts) >= 2:
                        pid = parts[-1].strip()
                        command_line = ','.join(parts[:-1])  # Reconstruct command line
                        if pid.isdigit():
                            # Additional validation: check if the process command contains our workspace path
                            if workspace_root.replace('/', '\\\\') in command_line:
                                try:
                                    subprocess.run(['taskkill', '/F', '/PID', pid], check=True, shell=True)
                                    print(f"[killer] Killed workspace ConPort process (PID: {pid})")
                                except subprocess.CalledProcessError:
                                    debug_print(f"Failed to kill ConPort PID {pid}", "ERROR")
                            else:
                                debug_print(f"Skipping launcher PID {pid} (different workspace)", "DEBUG")
    except Exception as e:
        debug_print(f"Error checking ConPort processes: {e}", "ERROR")

def kill_conport_processes_by_name_unix():
    \"\"\"Kill ConPort processes by name - Linux/macOS version (WORKSPACE-SPECIFIC)\"\"\"
    workspace_root = os.getcwd()  # Current workspace
    
    try:
        # FIXED: Only kill launcher processes for THIS workspace, not all launchers
        result = subprocess.run(['ps', 'ax', '-o', 'pid,command'], capture_output=True, text=True)
        for line in result.stdout.split('\\n')[1:]:  # Skip header
            if 'portal_launcher.py' in line and 'python' in line:
                # Check if this launcher process belongs to the current workspace
                if workspace_root in line or f'context_portal_aimed{os.sep}portal_launcher.py' in line:
                    parts = line.strip().split(None, 1)
                    if len(parts) >= 2:
                        pid = parts[0]
                        command = parts[1]
                        if pid.isdigit():
                            # Additional validation: check if the process command contains our workspace path
                            if workspace_root in command:
                                try:
                                    os.kill(int(pid), signal.SIGTERM)
                                    debug_print(f"Sent SIGTERM to workspace ConPort process (PID: {pid})", "INFO")
                                    time.sleep(1)
                                    try:
                                        os.kill(int(pid), 0)
                                        os.kill(int(pid), signal.SIGKILL)
                                        print(f"[killer] Force killed workspace ConPort process (PID: {pid})")
                                    except ProcessLookupError:
                                        pass
                                except (ProcessLookupError, ValueError):
                                    debug_print(f"Process {pid} already terminated", "INFO")
                                except Exception as e:
                                    debug_print(f"Failed to kill ConPort PID {pid}: {e}", "ERROR")
                            else:
                                debug_print(f"Skipping launcher PID {pid} (different workspace)", "DEBUG")
    except Exception as e:
        debug_print(f"Error checking ConPort processes: {e}", "ERROR")

def kill_conport_processes(custom_ports=None):
    \"\"\"Kill ConPort-related processes for the current workspace\"\"\"
    print("[killer] Stopping ConPort servers for current workspace...")
    
    platform_type = get_platform()
    
    # FIXED: Read workspace_id from env_vars.json (same as launcher) instead of os.getcwd()
    workspace_root = None
    try:
        import json
        from pathlib import Path
        
        # The killer is in workspace/context_portal_aimed/, so workspace is parent directory
        script_dir = Path(__file__).parent.absolute()
        potential_workspace_root = script_dir.parent.as_posix()
        
        # Verify workspace_id by reading env_vars.json
        env_vars_file = script_dir / "ui-cache" / "env_vars.json"
        if env_vars_file.exists():
            with open(env_vars_file, 'r') as f:
                env_vars = json.load(f)
                verified_workspace_id = env_vars.get("data", {}).get("workspace_id")
                if verified_workspace_id:
                    workspace_root = verified_workspace_id
                    debug_print(f"Using workspace_id from env_vars.json: {workspace_root}", "INFO")
                else:
                    workspace_root = potential_workspace_root
                    debug_print(f"No workspace_id in env_vars.json, using script location: {workspace_root}", "INFO")
        else:
            workspace_root = potential_workspace_root
            debug_print(f"No env_vars.json found, using script location: {workspace_root}", "INFO")
    except Exception as e:
        # Fallback to script location
        script_dir = Path(__file__).parent.absolute()
        workspace_root = script_dir.parent.as_posix()
        debug_print(f"Failed to read env_vars.json: {e}, using script location: {workspace_root}", "WARNING")
    
    # Get ports to kill - either custom ports or workspace-specific ports
    ports_to_kill = []
    
    if custom_ports:
        # Use custom ports provided by user
        ports_to_kill = custom_ports
        debug_print(f"Using custom ports: {sorted(ports_to_kill)}", "INFO")
    else:
        # FIXED: Add workspace-specific ports from consolidated env_vars.json
        try:
            import json
            from pathlib import Path
            
            context_portal_dir = Path(workspace_root) / 'context_portal_aimed'
            if context_portal_dir.exists():
                ui_cache_dir = context_portal_dir / 'ui-cache'
                
                # Get ports from consolidated env_vars.json
                env_vars_file = ui_cache_dir / 'env_vars.json'
                if env_vars_file.exists():
                    try:
                        with open(env_vars_file, 'r') as f:
                            env_data = json.load(f)
                            env_vars = env_data.get('data', {})
                            
                            # Get MCP server port
                            cached_mcp_port = env_vars.get('mcp_server_port')
                            if isinstance(cached_mcp_port, int) and 8020 <= cached_mcp_port <= 8200:
                                ports_to_kill.append(cached_mcp_port)
                                debug_print(f"Found cached MCP port {cached_mcp_port} for workspace", "INFO")
                            
                            # Get UI port
                            cached_ui_port = env_vars.get('ui_port')
                            if isinstance(cached_ui_port, int) and 3000 <= cached_ui_port <= 3100:
                                ports_to_kill.append(cached_ui_port)
                                debug_print(f"Found cached UI port {cached_ui_port} for workspace", "INFO")
                                
                    except (json.JSONDecodeError, IOError, KeyError) as e:
                        debug_print(f"Failed to read env_vars.json: {e}", "WARNING")
                else:
                    debug_print(f"No env_vars.json found at {env_vars_file}", "INFO")
                    
        except Exception as e:
            debug_print(f"Error reading workspace ports: {e}", "WARNING")
        
        # Default ports if no cache found (but this should be rare now)
        if not ports_to_kill:
            ports_to_kill = [8020, 3000]
            debug_print(f"No cached ports found, using defaults", "INFO")
    
    debug_print(f"Detected platform: {platform_type}", "INFO")
    debug_print(f"Workspace: {workspace_root}", "INFO")
    debug_print(f"Ports to kill: {sorted(ports_to_kill)}", "INFO")
    
    # Kill processes by port
    if platform_type == "windows":
        kill_processes_by_port_windows(ports_to_kill)
    else:
        kill_processes_by_port_unix(ports_to_kill)
    
    # Kill processes by name
    if platform_type == "windows":
        kill_conport_processes_by_name_windows()
    else:
        kill_conport_processes_by_name_unix()
    
    # Verify cleanup
    debug_print("Verifying cleanup...", "INFO")
    if platform_type != "windows":
        try:
            result = subprocess.run(['ss', '-tlnp'] if platform_type == "linux" else ['netstat', '-an'],
                                  capture_output=True, text=True)
            remaining_ports = []
            for port in ports_to_kill:
                if f':{port}' in result.stdout and ('LISTEN' in result.stdout or 'LISTENING' in result.stdout):
                    remaining_ports.append(port)
            
            if remaining_ports:
                print(f"[killer] WARNING: Some ports still in use: {remaining_ports}")
            else:
                print("[killer] ✓ All ConPort ports cleaned up successfully")
        except Exception as e:
            debug_print(f"Could not verify cleanup: {e}", "WARNING")

def main():
    \"\"\"Main function with command-line argument parsing\"\"\"
    import argparse
    
    parser = argparse.ArgumentParser(
        description="ConPort Portal Killer - Stop ConPort processes",
        epilog="Examples:\\n"
               "  python portal_killer.py                    # Kill workspace-specific ports from env_vars.json\\n"
               "  python portal_killer.py --ports all        # Kill all ConPort ports (UI: 3000-3005, MCP: 8020-8025)\\n"
               "  python portal_killer.py --ports 8020 3000  # Kill specific ports\\n",
        formatter_class=argparse.RawDescriptionHelpFormatter
    )
    parser.add_argument("--debug", action="store_true", help="Enable verbose debug output")
    parser.add_argument(
        "--ports",
        nargs='+',
        # NOTE: No type=int here! We handle 'all' keyword first, then convert to int
        help="Port(s) to kill. Use 'all' for ports 3000-3005 and 8020-8025, or specify individual ports (e.g., 8020 8021 3000). If not provided, uses workspace-specific ports from env_vars.json"
    )
    
    args = parser.parse_args()
    
    # Handle 'all' ports option BEFORE type conversion
    if args.ports and len(args.ports) == 1 and args.ports[0].lower() == 'all':
        # Expand 'all' to common ConPort port ranges
        ui_ports = list(range(3000, 3006))      # UI ports: 3000-3005
        mcp_ports = list(range(8020, 8026))     # MCP server ports: 8020-8025
        args.ports = ui_ports + mcp_ports
        print(f"[killer] Killing all ConPort ports: UI {ui_ports[0]}-{ui_ports[-1]}, MCP {mcp_ports[0]}-{mcp_ports[-1]}")
    elif args.ports:
        # Convert string ports to integers
        try:
            args.ports = [int(p) for p in args.ports]
        except ValueError as e:
            print(f"[killer] ERROR: Invalid port number: {e}", file=sys.stderr)
            sys.exit(1)
    
    # Enable debug output only if requested (same pattern as launcher)
    if not args.debug:
        # Silence debug output for normal operation
        def quiet_debug_print(message, level="INFO"):
            pass  # No output
        globals()['debug_print'] = quiet_debug_print
    
    # Call the main killer function with custom ports if provided
    kill_conport_processes(custom_ports=args.ports)

if __name__ == "__main__":
    main()
"""

# Template for the missing FTS migration file
ADD_MISSING_FTS_TABLES_CONTENT = """
\"\"\"Add missing FTS tables

Revision ID: 20250815
Revises: 20250617
Create Date: 2025-08-15 10:00:00.000000

\"\"\"
from alembic import op
import sqlalchemy as sa
import logging

# revision identifiers, used by Alembic.
revision = '20250815'
down_revision = '20250617'
branch_labels = None
depends_on = None

log = logging.getLogger(__name__)


def upgrade() -> None:
    # Create FTS5 virtual table for progress_entries
    op.execute('''
    CREATE VIRTUAL TABLE progress_entries_fts USING fts5(
        status,
        description,
        content="progress_entries",
        content_rowid="id"
    );
    ''')

    # Create triggers to keep the progress FTS table in sync
    op.execute('''
    CREATE TRIGGER progress_entries_after_insert AFTER INSERT ON progress_entries
    BEGIN
        INSERT INTO progress_entries_fts (rowid, status, description)
        VALUES (new.id, new.status, new.description);
    END;
    ''')
    op.execute('''
    CREATE TRIGGER progress_entries_after_delete AFTER DELETE ON progress_entries
    BEGIN
        INSERT INTO progress_entries_fts (progress_entries_fts, rowid, status, description)
        VALUES ('delete', old.id, old.status, old.description);
    END;
    ''')
    op.execute('''
    CREATE TRIGGER progress_entries_after_update AFTER UPDATE ON progress_entries
    BEGIN
        INSERT INTO progress_entries_fts (progress_entries_fts, rowid, status, description)
        VALUES ('delete', old.id, old.status, old.description);
        INSERT INTO progress_entries_fts (rowid, status, description)
        VALUES (new.id, new.status, new.description);
    END;
    ''')

    # Create FTS5 virtual table for system_patterns
    op.execute('''
    CREATE VIRTUAL TABLE system_patterns_fts USING fts5(
        name,
        description,
        tags,
        content="system_patterns",
        content_rowid="id"
    );
    ''')

    # Create triggers to keep the system patterns FTS table in sync
    op.execute('''
    CREATE TRIGGER system_patterns_after_insert AFTER INSERT ON system_patterns
    BEGIN
        INSERT INTO system_patterns_fts (rowid, name, description, tags)
        VALUES (new.id, new.name, new.description, new.tags);
    END;
    ''')
    op.execute('''
    CREATE TRIGGER system_patterns_after_delete AFTER DELETE ON system_patterns
    BEGIN
        INSERT INTO system_patterns_fts (system_patterns_fts, rowid, name, description, tags)
        VALUES ('delete', old.id, old.name, old.description, old.tags);
    END;
    ''')
    op.execute('''
    CREATE TRIGGER system_patterns_after_update AFTER UPDATE ON system_patterns
    BEGIN
        INSERT INTO system_patterns_fts (system_patterns_fts, rowid, name, description, tags)
        VALUES ('delete', old.id, old.name, old.description, old.tags);
        INSERT INTO system_patterns_fts (rowid, name, description, tags)
        VALUES (new.id, new.name, new.description, new.tags);
    END;
    ''')

    # Create FTS5 virtual table for contexts (both product and active)
    op.execute('''
    CREATE VIRTUAL TABLE context_fts USING fts5(
        context_type,
        content_text
    );
    ''')

    # Create triggers to keep the context FTS table in sync with product_context
    op.execute('''
    CREATE TRIGGER product_context_after_insert AFTER INSERT ON product_context
    BEGIN
        INSERT INTO context_fts (rowid, context_type, content_text)
        VALUES (new.id, 'product', new.content);
    END;
    ''')
    op.execute('''
    CREATE TRIGGER product_context_after_delete AFTER DELETE ON product_context
    BEGIN
        DELETE FROM context_fts WHERE rowid = old.id AND context_type = 'product';
    END;
    ''')
    op.execute('''
    CREATE TRIGGER product_context_after_update AFTER UPDATE ON product_context
    BEGIN
        DELETE FROM context_fts WHERE rowid = old.id AND context_type = 'product';
        INSERT INTO context_fts (rowid, context_type, content_text)
        VALUES (new.id, 'product', new.content);
    END;
    ''')

    # Create triggers to keep the context FTS table in sync with active_context
    # FIXED: Use simple rowid formula (id + 1) to avoid conflict with product_context
    op.execute('''
    CREATE TRIGGER active_context_after_insert AFTER INSERT ON active_context
    BEGIN
        INSERT INTO context_fts (rowid, context_type, content_text)
        VALUES (new.id + 1, 'active', new.content);
    END;
    ''')
    op.execute('''
    CREATE TRIGGER active_context_after_delete AFTER DELETE ON active_context
    BEGIN
        DELETE FROM context_fts WHERE rowid = (old.id + 1) AND context_type = 'active';
    END;
    ''')
    op.execute('''
    CREATE TRIGGER active_context_after_update AFTER UPDATE ON active_context
    BEGIN
        DELETE FROM context_fts WHERE rowid = (old.id + 1) AND context_type = 'active';
        INSERT INTO context_fts (rowid, context_type, content_text)
        VALUES (new.id + 1, 'active', new.content);
    END;
    ''')


def downgrade() -> None:
    # Drop FTS tables and triggers
    op.execute("DROP TRIGGER IF EXISTS progress_entries_after_insert")
    op.execute("DROP TRIGGER IF EXISTS progress_entries_after_delete")
    op.execute("DROP TRIGGER IF EXISTS progress_entries_after_update")
    op.execute("DROP TRIGGER IF EXISTS system_patterns_after_insert")
    op.execute("DROP TRIGGER IF EXISTS system_patterns_after_delete")
    op.execute("DROP TRIGGER IF EXISTS system_patterns_after_update")
    op.execute("DROP TRIGGER IF EXISTS product_context_after_insert")
    op.execute("DROP TRIGGER IF EXISTS product_context_after_delete")
    op.execute("DROP TRIGGER IF EXISTS product_context_after_update")
    op.execute("DROP TRIGGER IF EXISTS active_context_after_insert")
    op.execute("DROP TRIGGER IF EXISTS active_context_after_delete")
    op.execute("DROP TRIGGER IF EXISTS active_context_after_update")
    op.execute("DROP TABLE IF EXISTS progress_entries_fts")
    op.execute("DROP TABLE IF EXISTS system_patterns_fts")
    op.execute("DROP TABLE IF EXISTS context_fts")
"""

# Template for the FTS rowid conflict fix migration
FTS_ROWID_CONFLICT_FIX_CONTENT = '''"""Fix context FTS rowid conflict

Revision ID: 20251009
Revises: 20250815
Create Date: 2025-10-09 12:30:00.000000

"""
from alembic import op
import sqlalchemy as sa
import logging

# revision identifiers, used by Alembic.
revision = '20251009'
down_revision = '20250815'
branch_labels = None
depends_on = None

log = logging.getLogger(__name__)


def upgrade() -> None:
    """Fix the Active Context FTS trigger rowid conflict bug."""
    
    # Drop existing conflicting triggers
    op.execute("DROP TRIGGER IF EXISTS active_context_after_insert")
    op.execute("DROP TRIGGER IF EXISTS active_context_after_delete")
    op.execute("DROP TRIGGER IF EXISTS active_context_after_update")
    
    # Recreate Active Context triggers with unique rowid formula (id + 1)
    op.execute(\'\'\'
    CREATE TRIGGER active_context_after_insert AFTER INSERT ON active_context
    BEGIN
        INSERT INTO context_fts (rowid, context_type, content_text)
        VALUES (new.id + 1, 'active', new.content);
    END;
    \'\'\')
    op.execute(\'\'\'
    CREATE TRIGGER active_context_after_delete AFTER DELETE ON active_context
    BEGIN
        DELETE FROM context_fts WHERE rowid = (old.id + 1) AND context_type = 'active';
    END;
    \'\'\')
    op.execute(\'\'\'
    CREATE TRIGGER active_context_after_update AFTER UPDATE ON active_context
    BEGIN
        DELETE FROM context_fts WHERE rowid = (old.id + 1) AND context_type = 'active';
        INSERT INTO context_fts (rowid, context_type, content_text)
        VALUES (new.id + 1, 'active', new.content);
    END;
    \'\'\')
    
    # Fix existing FTS data - move active context from rowid=1 to rowid=2
    try:
        # Check if there's an active context entry at rowid=1 that needs to be moved
        op.execute("""
        INSERT OR IGNORE INTO context_fts (rowid, context_type, content_text)
        SELECT 2, 'active', content FROM active_context WHERE id = 1
        """)
        
        # Remove any conflicting active context entries at wrong rowid
        op.execute("DELETE FROM context_fts WHERE rowid = 1 AND context_type = 'active'")
        
        log.info("Successfully fixed Active Context FTS rowid conflict")
    except Exception as e:
        log.warning(f"Could not migrate existing Active Context FTS data: {e}")


def downgrade() -> None:
    """Revert to original (buggy) triggers."""
    
    # Drop fixed triggers
    op.execute("DROP TRIGGER IF EXISTS active_context_after_insert")
    op.execute("DROP TRIGGER IF EXISTS active_context_after_delete")
    op.execute("DROP TRIGGER IF EXISTS active_context_after_update")
    
    # Restore original buggy triggers
    op.execute(\'\'\'
    CREATE TRIGGER active_context_after_insert AFTER INSERT ON active_context
    BEGIN
        INSERT INTO context_fts (rowid, context_type, content_text)
        VALUES (new.id, 'active', new.content);
    END;
    \'\'\')
    op.execute(\'\'\'
    CREATE TRIGGER active_context_after_delete AFTER DELETE ON active_context
    BEGIN
        DELETE FROM context_fts WHERE rowid = old.id AND context_type = 'active';
    END;
    \'\'\')
    op.execute(\'\'\'
    CREATE TRIGGER active_context_after_update AFTER UPDATE ON active_context
    BEGIN
        DELETE FROM context_fts WHERE rowid = old.id AND context_type = 'active';
        INSERT INTO context_fts (rowid, context_type, content_text)
        VALUES (new.id, 'active', new.content);
    END;
    \'\'\')
'''

# Template for link cleanup triggers migration
LINK_CLEANUP_TRIGGERS_CONTENT = '''"""Add link cleanup triggers for data integrity

Revision ID: 20251011
Revises: 20251009
Create Date: 2025-10-11 00:00:00.000000

"""
from alembic import op
import sqlalchemy as sa
import logging

# revision identifiers, used by Alembic.
revision = '20251011'
down_revision = '20251009'
branch_labels = None
depends_on = None

log = logging.getLogger(__name__)


def upgrade() -> None:
    """Add triggers to automatically clean up orphaned links when entities are deleted."""
    
    # Decision delete trigger - cascade delete related links
    op.execute(\'\'\'
    CREATE TRIGGER decisions_cascade_delete_links AFTER DELETE ON decisions
    BEGIN
        DELETE FROM context_links WHERE
            (source_item_type = 'decision' AND source_item_id = CAST(old.id AS TEXT)) OR
            (target_item_type = 'decision' AND target_item_id = CAST(old.id AS TEXT));
    END;
    \'\'\')
    
    # Progress entry delete trigger - cascade delete related links
    op.execute(\'\'\'
    CREATE TRIGGER progress_entries_cascade_delete_links AFTER DELETE ON progress_entries
    BEGIN
        DELETE FROM context_links WHERE
            (source_item_type = 'progress_entry' AND source_item_id = CAST(old.id AS TEXT)) OR
            (target_item_type = 'progress_entry' AND target_item_id = CAST(old.id AS TEXT));
    END;
    \'\'\')
    
    # System pattern delete trigger - cascade delete related links
    op.execute(\'\'\'
    CREATE TRIGGER system_patterns_cascade_delete_links AFTER DELETE ON system_patterns
    BEGIN
        DELETE FROM context_links WHERE
            (source_item_type = 'system_pattern' AND source_item_id = CAST(old.id AS TEXT)) OR
            (target_item_type = 'system_pattern' AND target_item_id = CAST(old.id AS TEXT));
    END;
    \'\'\')
    
    # Custom data delete trigger - cascade delete related links
    # Note: custom_data uses category:key format for item_id
    op.execute(\'\'\'
    CREATE TRIGGER custom_data_cascade_delete_links AFTER DELETE ON custom_data
    BEGIN
        DELETE FROM context_links WHERE
            (source_item_type = 'custom_data' AND source_item_id = old.category || ':' || old.key) OR
            (target_item_type = 'custom_data' AND target_item_id = old.category || ':' || old.key);
    END;
    \'\'\')

    log.info("Successfully created link cleanup triggers for all entity types")


def downgrade() -> None:
    """Remove link cleanup triggers."""
    
    # Drop all link cleanup triggers
    op.execute("DROP TRIGGER IF EXISTS decisions_cascade_delete_links")
    op.execute("DROP TRIGGER IF EXISTS progress_entries_cascade_delete_links")
    op.execute("DROP TRIGGER IF EXISTS system_patterns_cascade_delete_links")
    op.execute("DROP TRIGGER IF EXISTS custom_data_cascade_delete_links")
    
    log.info("Removed all link cleanup triggers")
'''

# Template for custom_data_fts column name fix migration
FIX_CUSTOM_DATA_FTS_COLUMN_CONTENT = '''"""Fix custom_data_fts column name mismatch

Revision ID: 20251022
Revises: 20251011
Create Date: 2025-10-22 06:09:00.000000

Critical Fix: custom_data_fts declared 'value_text' column but content table
has 'value' column. With content="custom_data", FTS5 tries to access
custom_data.value_text which doesn't exist, causing "no such column: T.value_text"
errors on any FTS5 query (COUNT, MAX, SELECT).

This migration:
1. Drops and recreates custom_data_fts with 'value' column name
2. Updates all triggers to use 'value' instead of 'value_text'
3. Rebuilds FTS index from existing custom_data rows

"""
from alembic import op
import sqlalchemy as sa
import logging

# revision identifiers, used by Alembic.
revision = '20251022'
down_revision = '20251011'
branch_labels = None
depends_on = None

log = logging.getLogger(__name__)


def upgrade() -> None:
    """Fix custom_data_fts column name to match content table."""
    
    log.info("Starting custom_data_fts column name fix migration")
    
    # Step 1: Drop existing triggers
    op.execute("DROP TRIGGER IF EXISTS custom_data_after_insert")
    op.execute("DROP TRIGGER IF EXISTS custom_data_after_delete")
    op.execute("DROP TRIGGER IF EXISTS custom_data_after_update")
    log.info("Dropped existing custom_data triggers")
    
    # Step 2: Drop existing FTS table
    op.execute("DROP TABLE IF EXISTS custom_data_fts")
    log.info("Dropped existing custom_data_fts table")
    
    # Step 3: Create FTS table with correct column name 'value'
    op.execute(\'\'\'
    CREATE VIRTUAL TABLE custom_data_fts USING fts5(
        category,
        key,
        value,
        content="custom_data",
        content_rowid="id"
    );
    \'\'\')
    log.info("Created custom_data_fts with correct 'value' column name")
    
    # Step 4: Rebuild FTS index from existing data
    op.execute(\'\'\'
    INSERT INTO custom_data_fts (rowid, category, key, value)
    SELECT id, category, key, value FROM custom_data;
    \'\'\')
    log.info("Rebuilt FTS index from existing custom_data rows")
    
    # Step 5: Create triggers with correct column name
    op.execute(\'\'\'
    CREATE TRIGGER custom_data_after_insert AFTER INSERT ON custom_data
    BEGIN
        INSERT INTO custom_data_fts (rowid, category, key, value)
        VALUES (new.id, new.category, new.key, new.value);
    END;
    \'\'\')
    op.execute(\'\'\'
    CREATE TRIGGER custom_data_after_delete AFTER DELETE ON custom_data
    BEGIN
        INSERT INTO custom_data_fts (custom_data_fts, rowid, category, key, value)
        VALUES ('delete', old.id, old.category, old.key, old.value);
    END;
    \'\'\')
    op.execute(\'\'\'
    CREATE TRIGGER custom_data_after_update AFTER UPDATE ON custom_data
    BEGIN
        INSERT INTO custom_data_fts (custom_data_fts, rowid, category, key, value)
        VALUES ('delete', old.id, old.category, old.key, old.value);
        INSERT INTO custom_data_fts (rowid, category, key, value)
        VALUES (new.id, new.category, new.key, new.value);
    END;
    \'\'\')
    log.info("Created triggers with correct 'value' column name")
    
    log.info("Successfully completed custom_data_fts column name fix")


def downgrade() -> None:
    """Revert to original (buggy) schema with 'value_text' column."""
    
    log.warning("Downgrading to buggy custom_data_fts schema with 'value_text' column")
    
    # Drop fixed triggers
    op.execute("DROP TRIGGER IF EXISTS custom_data_after_insert")
    op.execute("DROP TRIGGER IF EXISTS custom_data_after_delete")
    op.execute("DROP TRIGGER IF EXISTS custom_data_after_update")
    
    # Drop fixed FTS table
    op.execute("DROP TABLE IF EXISTS custom_data_fts")
    
    # Recreate buggy FTS table with 'value_text'
    op.execute(\'\'\'
    CREATE VIRTUAL TABLE custom_data_fts USING fts5(
        category,
        key,
        value_text,
        content="custom_data",
        content_rowid="id"
    );
    \'\'\')
    
    # Rebuild FTS index (mapping value -> value_text)
    op.execute(\'\'\'
    INSERT INTO custom_data_fts (rowid, category, key, value_text)
    SELECT id, category, key, value FROM custom_data;
    \'\'\')
    
    # Recreate buggy triggers with 'value_text'
    op.execute(\'\'\'
    CREATE TRIGGER custom_data_after_insert AFTER INSERT ON custom_data
    BEGIN
        INSERT INTO custom_data_fts (rowid, category, key, value_text)
        VALUES (new.id, new.category, new.key, new.value);
    END;
    \'\'\')
    op.execute(\'\'\'
    CREATE TRIGGER custom_data_after_delete AFTER DELETE ON custom_data
    BEGIN
        INSERT INTO custom_data_fts (custom_data_fts, rowid, category, key, value_text)
        VALUES ('delete', old.id, old.category, old.key, old.value);
    END;
    \'\'\')
    op.execute(\'\'\'
    CREATE TRIGGER custom_data_after_update AFTER UPDATE ON custom_data
    BEGIN
        INSERT INTO custom_data_fts (custom_data_fts, rowid, category, key, value_text)
        VALUES ('delete', old.id, old.category, old.key, old.value);
        INSERT INTO custom_data_fts (rowid, category, key, value_text)
        VALUES (new.id, new.category, new.key, new.value);
    END;
    \'\'\')
    
    log.warning("Reverted to buggy custom_data_fts schema")
'''
