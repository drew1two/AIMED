# AIMED Installation Guide

## Quick Start Overview

1. [Install Prerequisites & AIMED](#installation-steps)
2. [Configure MCP Client](#mcp-client-configuration) 
3. [Setup Custom Instructions](#custom-instructions-for-llm-agents)
4. [Verify Installation](#installation-verification)
5. [Create Your First Project](#creating-your-first-project)

---

## Prerequisites

- **Python 3.10+** (Developed on 3.13) - [Download here](https://www.python.org/downloads/)
- **uv** (Recommended) - Fast Python package manager: [Install uv](https://github.com/astral-sh/uv#installation)
- **Node.js & npm** - For the web dashboard: [Download here](https://nodejs.org/)

## Installation Steps

1. **Clone and setup Python environment**
   ```bash
   git clone https://github.com/drew1two/AIMED.git
   cd AIMED
   python -m venv .venv # You can use conda instead if you prefer
   ```
   
   **Activate virtual environment:**
   
   **Linux/macOS/WSL:**
   ```bash
   source .venv/bin/activate
   ```
   
   **Windows PowerShell:**
   ```powershell
   .venv\Scripts\activate
   ```
   
   **Windows cmd:**
   ```cmd
   .venv\Scripts\activate.bat
   ```
   
   **Deactivate (all platforms):**
   ```bash
   deactivate
   ```
   
   **Install dependencies:**
   ```bash
   pip install uv  # Install uv package manager
   uv pip install -r requirements.txt
   ```

2. **Install web dashboard dependencies**
   ```bash
   cd ui
   npm install
   cd ..
   ```

3. **Open AIMED as a workspace in your IDE**
   
   Open the AIMED directory as your workspace before configuring MCP settings file. This ensures `context_portal_aimed` is created in the correct location (within AIMED, not its parent directory), which is important if you want to develop / modify AIMED itself.
   
   Once configured, each project will get its own isolated `context_portal_aimed` folder when you open them up in your IDE, keeping AI assistant context separate across all your projects.

## Coming from context-portal?

**⚠️ If you're currently using the `conport` MCP server, read this section first before proceeding.**

To temporarily switch from context-portal to AIMED:

1. **Disable conport server** - Turn off the existing conport MCP server before modifying settings
2. **Update MCP settings** - Replace / Add (Add Recommended so you can always revert) the `conport-aimed` configuration (next section)
3. **Update custom instructions** - Save existing somewhere and replace with AIMED-specific instructions (see [Custom Instructions](#custom-instructions-for-llm-agents))
4. **Test with a new project** - Verify AIMED works correctly before considering to migrate existing projects (migration not yet implemented)
5. **Revert if needed** - You can always disable AIMED and restore context-portal settings by turning off 'conport-aimed', turning on 'conport' and re-instating your saved custom instructions

**Key Differences:**
- AIMED uses `conport-aimed` as the server name (vs `conport`)
- Different custom instructions required for AI assistants
- Web dashboard included for visual management

---

## MCP Client Configuration

Configure your IDE's MCP settings to connect AIMED's `conport-aimed` server:

### Basic Configuration

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

### Configuration Notes

- **Auto-detection**: Configuration above uses automatic workspace detection (recommended)
- **Manual workspace**: Add `"--workspace_id", "${workspaceFolder}"` to args if needed
- **Troubleshooting**: See [Advanced Configuration](#advanced-configuration) for workspace detection issues

## Custom Instructions for LLM Agents

**⚠️ Required Step**: Copy the appropriate strategy file to your LLM's custom instructions:

- **Roo Code**: [`roo_code_conport_strategy`](conport-custom-instructions/roo_code_conport_strategy)
- **Cline**: [`cline_conport_strategy`](conport-custom-instructions/cline_conport_strategy) 
- **Windsurf Cascade**: [`cascade_conport_strategy`](conport-custom-instructions/cascade_conport_strategy)
- **Generic Condensed**: [`current_generic_conport_strategy`](conport-custom-instructions/current_generic_conport_strategy) (less recurring tokens, leaves room for extra custom instructions, may need short LLM reminders)

Copy the **entire content** of the relevant file into your LLM's custom instructions area.

## Installation Verification

### Step 1: Quick Verification (Within AIMED Directory)

1. **Refresh your IDE file explorer** (F5 in VS Code)
2. **Ask your AI assistant any question** - triggers the first MCP tool call
3. **Look for `context_portal_aimed` folder** in the AIMED directory root

**Expected Result**: New `context_portal_aimed` folder appears (may be grayed out due to `.gitignore`).

**If folder doesn't appear**: Check [Troubleshooting](#troubleshooting) section.

⚠️ **Important**: This only verifies installation. For actual usage, see the next section 'Creating Your First Project'.

## Creating Your First Project

**Recommended workflow for actual AIMED usage:**

### Step 1: Create New Project
```bash
mkdir my_new_project
cd my_new_project
python -m venv .venv
```

**Activate virtual environment:**

**Linux/macOS/WSL:**
```bash
source .venv/bin/activate
```

**Windows PowerShell:**
```powershell
.venv\Scripts\activate
```

**Windows cmd:**
```cmd
.venv\Scripts\activate.bat
```

```bash
echo "# My New Project" > README.md
git init
```

### Step 2: Open in IDE & Initialize AIMED if not already there
1. **Ask your AI assistant any question** - triggers first conport-aimed tool call
- else refresh conport-aimed mcp server
3. **Watch for `context_portal_aimed` folder** to appear in project root
4. **LLM will offer to launch the UI** - accept or launch manually later

### Step 3: Launch AIMED Dashboard
```bash
python context_portal_aimed/portal_launcher.py
```

**Expected Results:**
- Dashboard loads at `http://localhost:3000` (or WSL2 IP with available port)
- Project context shows your new project workspace  
- AI assistant has access to conport-aimed tools

### Step 4: Initialize Project Context
- Create `projectBrief.md` in your project root with project goals and features
- LLM will offer to import this into conport-aimed Product Context
- Or use the AIMED dashboard: Context → Product Context

## Advanced Configuration

### Automatic Workspace Detection

Conport automatically detects workspace roots using:
- **Strong Indicators**: `package.json`, `.git`, `pyproject.toml`, `Cargo.toml`, `go.mod`, `pom.xml`
- **General Indicators**: README, license files, build files (≥2 needed)
- **Environment Variables**: `VSCODE_WORKSPACE_FOLDER`, `CONPORT_WORKSPACE`

**Detection Flags:**
- `--auto-detect-workspace` (default: enabled)
- `--no-auto-detect` (requires explicit `--workspace_id`)
- `--workspace-search-start <path>` (custom starting directory)

**Troubleshooting Detection:**
Use the `get_workspace_detection_info` MCP tool to debug detection issues.

### WSL2 Support

AIMED automatically detects WSL2 environments and configures network access:
- Uses WSL2 IP address instead of localhost
- Configures CORS for cross-host access
- Example URL: `http://172.30.143.144:3000`

### Manual Workspace Configuration

If auto-detection fails, use explicit workspace ID:
```json
{
  "args": [
    "/path/to/your/AIMED/src/context_portal_mcp/main.py",
    "--mode", "stdio",
    "--workspace_id", "/absolute/path/to/your/project",
    "--log-file", "./logs/conport.log"
  ]
}
```
or
```json
{
  "args": [
    "/path/to/your/AIMED/src/context_portal_mcp/main.py",
    "--mode", "stdio",
    "--workspace_id","${workspaceFolder}",
    "--log-file", "./logs/conport.log"
  ]
}
```

## Important Usage Notes

- **Project Isolation**: Each project gets its own `context_portal_aimed` folder with independent data
- **Environment Setup**: Turn off MCP server before setting up new project environments
- **Troubleshooting**: Delete `context_portal_aimed` folder and restart MCP server if issues occur when setting up "New" projects (Don't do this on existing projects without backing up your project first)
- **AIMED Modifications**: Feel free to modify AIMED directly, but be aware changes may be overwritten by `git pull` if working in the AIMED folder directly

## Troubleshooting

### MCP Server Connection Issues
- Verify Python virtual environment is activated
- Check dependencies:
  ```bash
  uv pip install -r requirements.txt
  ```
- Review logs at specified `--log-file` location
- Ensure MCP configuration paths are correct

### Folder Not Appearing
- Refresh IDE file explorer (F5)
- Check terminal:
  
  **Linux/macOS/WSL:**
  ```bash
  ls -la | grep context
  ```
  
  **Windows PowerShell:**
  ```powershell
  dir | Select-String context
  ```
  
  **Windows cmd:**
  ```cmd
  dir /a | findstr context
  ```
- Verify custom instructions are applied to your LLM
- Check MCP server logs for connection errors

### Workspace Detection Issues  
- Create `projectBrief.md` in project root
- Ensure project has workspace indicators (`.git`, `package.json`, etc.)
- Use absolute paths instead of `${workspaceFolder}`
- Enable auto-detection by removing `--workspace_id`

### WSL2 Network Issues
- `localhost:3000` doesn't work in a wsl2 environment
- Check Windows Firewall allows the connection
- AIMED automatically configures WSL2 networking

### Database Issues
- Check file permissions:
  
  **Linux/macOS/WSL:**
  ```bash
  ls -la context_portal_aimed/context_aimed.db
  ```
  
  **Windows:**
  ```powershell
  dir context_portal_aimed\context_aimed.db
  ```

- Clean slate (⚠️ deletes database):
  
  **Linux/macOS/WSL:**
  ```bash
  rm context_portal_aimed/context_aimed.db
  ```
  
  **Windows PowerShell:**
  ```powershell
  Remove-Item context_portal_aimed\context_aimed.db
  ```
  
  **Windows cmd:**
  ```cmd
  del context_portal_aimed\context_aimed.db
  ```
  
  Then refresh projects conport-aimed mcp server
- Export data before major updates

## Next Steps

Once installation is complete:

- **[Tips & Tricks](TIPS_AND_TRICKS.md)**: Best practices and daily workflow
- **Project Initialization**: Setup `projectBrief.md` for better initial context
- **Dashboard Exploration**: Navigate Context → Product Context to get started
- **Custom Instructions**: Fine-tune LLM behavior with project-specific rules or via .roorules etc.

## Getting Help

- **[GitHub Issues](https://github.com/drew1two/AIMED/issues)**: Bug reports and feature requests
- **[GitHub Discussions](https://github.com/drew1two/AIMED/discussions)**: Community help and questions  
- **Debug Logs**: Enable with `--log-level DEBUG`
- **[Tips & Tricks](TIPS_AND_TRICKS.md)**: Best practices guide