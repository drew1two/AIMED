# AIMED Quick Start Guide

## Prerequisites

- Python 3.10+ ([Download](https://www.python.org/downloads/))
- uv package manager ([Install](https://github.com/astral-sh/uv#installation))
- Node.js & npm ([Download](https://nodejs.org/))

---

## One-Time AIMED Installation

```bash
# 1. Clone and setup
git clone https://github.com/drew1two/AIMED.git
cd AIMED
python -m venv .venv

# 2. Activate environment
# Linux/macOS/WSL:
source .venv/bin/activate
# Windows PowerShell:
# .venv\Scripts\activate
# Windows cmd:
# .venv\Scripts\activate.bat

# 3. Install dependencies
pip install uv
uv pip install -r requirements.txt

# 4. Install UI dependencies
cd ui
npm install
cd ..
```

---

## MCP Configuration

Add to your IDE's MCP settings file:

**Linux/WSL:**
```json
{
  "mcpServers": {
    "conport-aimed": {
      "command": "/path/to/your/AIMED/.venv/bin/python",
      "args": [
        "/path/to/your/AIMED/src/context_portal_mcp/main.py",
        "--mode", "stdio",
        "--log-file", "./logs/conport.log",
        "--log-level", "INFO"
      ],
      "env": {
        "PYTHONPATH": "/path/to/AIMED/src"
      },
      "transportType": "stdio"
    }
  }
}
```

**Windows:**
```json
{
  "mcpServers": {
    "conport-aimed": {
      "command": "path\\to\\your\\AIMED\\.venv\\Scripts\\python.exe",
      "args": [
        "path\\to\\your\\AIMED\\src\\context_portal_mcp\\main.py",
        "--mode", "stdio",
        "--log-file", "./logs/conport.log",
        "--log-level", "INFO"
      ],
      "env": {
        "PYTHONPATH": "path\\to\\AIMED\\src"
      },
      "transportType": "stdio"
    }
  }
}
```

---

## Custom Instructions Setup

**⚠️ REQUIRED:** Copy one of these files to your IDE's custom instructions:

- **Roo Code**: `conport-custom-instructions/roo_code_conport_strategy`
- **Cline**: `conport-custom-instructions/cline_conport_strategy`
- **Windsurf Cascade**: `conport-custom-instructions/cascade_conport_strategy`
- **Generic/Condensed**: `conport-custom-instructions/current_generic_conport_strategy`

Copy the **entire file content** into your LLM's custom instructions area.

---

## Creating a New Project

### Step 1: Disable MCP Server
⚠️ **Turn OFF the `conport-aimed` MCP server in your IDE first**

### Step 2: Create Project & Environment
```bash
mkdir my_new_project
cd my_new_project
python -m venv .venv

# Activate:
# Linux/macOS/WSL:
source .venv/bin/activate
# Windows PowerShell:
# .venv\Scripts\activate
# Windows cmd:
# .venv\Scripts\activate.bat

# Optional:
git init
```

### Step 3: Describe your project and Re-enable MCP Server
- Create `projectBrief.md` in project root
- Turn the `conport-aimed` MCP server back ON (wait 5-20 seconds to start)
- `context_portal_aimed/` folder will appear automatically
- If not, ask your AI assistant a question to trigger initialization

### Step 4: Add to .gitignore
```gitignore
context_portal_aimed/
```

### Step 5: Launch Dashboard
```bash
python context_portal_aimed/portal_launcher.py
```

Dashboard opens at `http://localhost:3000` (or WSL2 IP and different port if you already have a different project open)

### Step 6: Initialize Context (Optional)
- If you have a ProjectBrief.md file the LLM will offer to import it into Product Context, else you can discuss what you'd like to create

---

## Integrating with Existing Project

1. **Ensure Python environment exists and is activated**
2. **Enable MCP server** (if not already on)
3. **`context_portal_aimed/` folder creates automatically**
4. **Add to `.gitignore`:**
   ```gitignore
   context_portal_aimed/
   ```
5. **Launch dashboard:**
   ```bash
   python context_portal_aimed/portal_launcher.py
   ```

---

## Quick Fixes

### Folder Created Too Early?
If `context_portal_aimed/` was created before activating your environment:
```bash
# 1. Finish activating environment
# 2. Delete folder
rm -rf context_portal_aimed/   # Linux/macOS/WSL
# OR
Remove-Item -Recurse context_portal_aimed/   # Windows PowerShell
# 3. Restart conport-aimed MCP server
```

### Folder Not Appearing?
- Refresh IDE (F5)
- Check: `ls -la | grep context` (Linux/macOS/WSL) or `dir | findstr context` (Windows)
- Verify custom instructions are applied
- Check MCP server logs

### WSL2 Network Issues?
AIMED auto-configures WSL2 networking. Dashboard URL uses WSL2 IP (e.g., `http://172.30.143.144:3000`), not `localhost:3000`.

---

## Verification Checklist

✅ `context_portal_aimed/` folder exists in project root  
✅ Dashboard launches at specified URL  
✅ AI assistant can access conport-aimed MCP server's tools  
✅ Custom instructions loaded in IDE  

---

## Key Points

- **Each project gets its own isolated `context_portal_aimed/` folder**
- **Always disable MCP server before creating new project environments**
- **Add `context_portal_aimed/` to `.gitignore` (unless sharing project state)**
- **Multiple projects use different ports automatically**
- **LLM uses same launcher script: `context_portal_aimed/portal_launcher.py`**

---

## Next Steps

- **[Full Installation Guide](INSTALLATION_GUIDE.md)**: Detailed explanations
- **[Tips & Tricks](TIPS_AND_TRICKS.md)**: Best practices
- **[GitHub Issues](https://github.com/drew1two/AIMED/issues)**: Support & bug reports
