# Contributing to AIMED - AI Monitoring & Execution Dashboard

Thank you for your interest in contributing to AIMED! We welcome contributions of all kinds, including bug reports, feature requests, documentation improvements, and code contributions.

> **🚨 Beta Status**: AIMED is currently in beta. We especially welcome feedback on stability, performance, and user experience improvements!

By participating in this project, you are expected to uphold our [Code of Conduct](CODE_OF_CONDUCT.md).

## How to Contribute

### Reporting Bugs

If you find a bug, please report it by opening a new issue on the [GitHub repository](https://github.com/drew1two/AIMED/issues).

**Beta-specific Bug Reports** should include:

*   A clear and concise description of the bug.
*   Steps to reproduce the behavior.
*   The version of AIMED you are using.
*   Your operating system and Python version.
*   Browser and version (for web dashboard issues).
*   Any relevant error messages or logs (like `./logs/conport.log`).
*   Screenshots if the issue is visual/UI related.

### Suggesting Enhancements

If you have an idea for a new feature or enhancement, please suggest it by opening a new issue on the [GitHub repository](https://github.com/drew1two/AIMED/issues).

**Beta Enhancement Suggestions** should include:

*   A clear and concise description of the proposed enhancement.
*   The problem it solves or the benefit it provides.
*   Any potential design considerations.
*   Whether it's a ConPort MCP backend enhancement or AIMED dashboard enhancement.
*   Mockups or sketches if it's a UI enhancement.

### Setting Up Your Development Environment

**Prerequisites:**
- Python 3.10+ (Developed on 3.13)
- Node.js & npm
- uv (recommended) or pip

To contribute code, you'll need to set up a development environment.

1.  **Clone the Repository:**
    ```bash
    git clone https://github.com/drew1two/AIMED.git
    cd AIMED
    ```

2.  **Create and Activate a Virtual Environment:**
    ```bash
    python -m venv .venv
    source .venv/bin/activate  # Linux/macOS
    # .venv\Scripts\activate on Windows
    ```

3.  **Install Python Dependencies:**
    ```bash
    uv pip install -r requirements.txt
    # or: pip install -r requirements.txt
    ```

4.  **Install UI Dependencies:**
    ```bash
    cd ui
    npm install
    cd ..
    ```

### Code Contributions

We follow a standard GitHub pull request workflow.

1.  **Fork the Repository:** Fork the [AIMED repository](https://github.com/drew1two/AIMED).
2.  **Create a Branch:** Create a new branch for your contribution.
    ```bash
    git checkout -b feature/your-feature-name
    ```
    or
    ```bash
    git checkout -b bugfix/your-bugfix-name
    ```
3.  **Make Your Changes:** Implement your feature or bug fix.
4.  **Write Tests:** If applicable, add tests for your changes.
5.  **Run Tests:** Ensure all tests pass. (Details on running tests TBD - you may want to add a section on testing).
6.  **Code Style:** Adhere to the project's code style (e.g., PEP 8). (Details on code formatting/linting TBD - you may want to add a section on this).
7.  **Commit Your Changes:** Write clear and concise commit messages.
8.  **Push Your Branch:** Push your branch to your fork on GitHub.
9.  **Open a Pull Request:** Open a pull request from your fork to the main repository's `main` branch. Provide a clear description of your changes.

### Frontend Development (Web Dashboard)

AIMED includes a Next.js web dashboard. For development:

1.  **Launch AIMED Dashboard:**
    ```bash
    cd ui
    npm install
    cd ..
    ```

2.  **Start both servers together:**
    From the project root:
    ```bash
    python context_portal_aimed/portal_launcher.py
    ```
    
    This automatically:
    - Starts the ConPort MCP server on port 8020
    - Starts the Next.js UI server on port 3000 (or next available port)
    - Opens your browser to the dashboard
    
    Both servers run together and are configured to communicate properly.

3.  **For component-specific development:**
    
    **MCP Server only:**
    ```bash
    python -m src.context_portal_mcp.main --mode http --host 127.0.0.1 --port 8020
    ```
    
    **UI Server only:** (requires MCP server running)
    ```bash
    cd ui
    npm run dev
    ```
    
    **Skip UI launch:** (starts MCP server + ConPort HTTP server, no browser)
    ```bash
    python context_portal/portal_launcher.py --skip-ui --no-browser
    ```
    
    **Skip MCP server:** (useful if MCP server is already running)
    ```bash
    python context_portal/portal_launcher.py --skip-server
    ```

### Beta Testing Priorities

We particularly welcome contributions in these areas:

*   **Stability Testing**: Use AIMED with real projects and report crashes or data corruption
*   **Performance Optimization**: Identify slow queries, UI lag, or memory leaks
*   **UX Improvements**: Suggest better workflows, clearer interfaces, or missing features
*   **Cross-platform Testing**: Test on different OS/browser combinations
*   **Documentation**: Help improve setup guides, feature explanations, and troubleshooting
*   **Accessibility**: Ensure the dashboard works with screen readers and keyboard navigation

### Documentation Improvements

Improving documentation is a valuable contribution! You can suggest changes by opening issues or submitting pull requests directly to the `docs/` or root Markdown files (`README.md`, `CONTRIBUTING.md`, etc.).

### Licensing

By contributing to AIMED, you agree that your contributions will be subject to the same terms as the project.

**Important**: AIMED extends ConPort MCP (Apache-2.0). Contributions to ConPort MCP components in `src/context_portal_mcp/` should also be submitted upstream to the [original ConPort repository](https://github.com/GreatScottyMac/context-portal).

## Code of Conduct

Please note that this project has a [Code of Conduct](CODE_OF_CONDUCT.md). By participating, you are expected to uphold this code. Please report unacceptable behavior to [YOUR_EMAIL_ADDRESS] (Note: Replace with a suitable contact method).