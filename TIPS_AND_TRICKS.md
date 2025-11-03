# 💡 AIMED Tips & Tricks

Quick reference for getting the most from your AI assistant with AIMED.

## 🚀 Quick Start

**New to AIMED?** Follow the [Installation Guide](INSTALLATION_GUIDE.md#creating-your-first-project) for complete setup.

**Already installed?** Launch from any project with a `context_portal_aimed/` folder:
```bash
python context_portal_aimed/portal_launcher.py
```

## 💬 Essential AI Prompts

### Session Startup
```
"Read the active context, then update it with your next goals: [your specific goals]"
```

### Getting Multiple Items (when you know IDs from dashboard)
```
"Please read decisions 32, 33, progress 62, 23 and custom data 2"
Uses get_items_by_references tool which saves a lot of tokens compared to get_decisions, get_progress etc. when you know the id's you want the LLM to look into.
```

### Logging Decisions
```
"Log this decision with full rationale and implementation details, then link it to the related pattern, progress or custom data"
```

### Creating Links
```
"Link these items concisely, using only ONE link between each pair of entries"
```

## 🔗 Quick ID Reference

| Item Type | How to Reference | Example |
|-----------|------------------|---------|
| **Decisions** | Numeric ID | `"decision 32"` |
| **Progress** | Numeric ID | `"progress 23"` |
| **Patterns** | Numeric ID | `"pattern 15"` |
| **Custom Data** | ID or category:key | `"custom data 2"` or `"custom data UX:navigation"` |

**Tip**: Use the dashboard to find numeric IDs quickly.

## 📋 Minimal .roorules

```bash
# ConPort Essentials - copy to .roorules
Always read active_context at session start.
Log decisions immediately with rationale and implementation details.
Link conport-aimed entries concisely - only ONE link between any two entries.
When user asks for items and related info, use get_items_by_references.
```

## 🎯 Task Workflow

1. **Session Start**: Ask AI to read active context
2. **Make Decisions**: Log immediately with rationale
3. **Track Progress**: Keep Progress's updated with TODO, IN_PROGRESS and DONE
4. **Link Items**: Connect related decisions, progress, and patterns
5. **Session End**: Update active context with the next task's priorities

## 📚 Detailed Help

For comprehensive guides, launch AIMED and visit **your dashboard URL + `/docs`**:

- **Dashboard Help** - Complete UI documentation
- **Knowledge Graph** - Visual navigation & linking
- **Tips & Tricks** - Detailed workflow examples
- **Troubleshooting** - Common issues & solutions

**Find Your URL**: When you run `python context_portal_aimed/portal_launcher.py`, the correct URL is displayed in the output:
```
✅ AIMED Dashboard: http://your-actual-url:port
```

**Common URLs**:
- Standard: `http://localhost:3000/docs`
- WSL2: `http://172.30.xxx.xxx:3000/docs` (IP shown in launcher output)
- Port conflicts: `http://localhost:3001/docs` or higher port numbers

## 🆘 Need Help?

- **Installation Issues**: [Installation Guide](INSTALLATION_GUIDE.md#troubleshooting)
- **UI Not Working**: Check [WSL2 & Network Issues](http://localhost:3000/docs#troubleshooting)
- **MCP Problems**: [GitHub Issues](https://github.com/drew1two/AIMED/issues)
- **Usage Questions**: [GitHub Discussions](https://github.com/drew1two/AIMED/discussions)

---

*For complete documentation, see [AIMED Benefits](AIMED-BENEFITS.md) and the [UI Help System](http://localhost:3000/docs)*