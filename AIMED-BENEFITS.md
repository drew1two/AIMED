# AIMED Features and Capabilities

**Web interface for ConPort MCP providing visual access to AI project context management.**

AIMED provides visibility into the project context that AI assistants use during development. It enables developers to manage what information their AI sees, track decisions and progress, and maintain coherent project knowledge across sessions.

## Core Benefits

### Context Management & Token Efficiency
- Edit product and active contexts directly through web interface
- Clean active context by removing completed task information
- Visual management of tokenized context per AI request
- Reduce unnecessary context in AI requests
- Monitor what context is actually being sent to the LLM
- Ability to work on multiple workspaces at the same time with workspace isolation. 

### Project Visibility & Monitoring
- Track project evolution through decision and progress history
- View the actual context available to AI assistants
- Identify when AI responses diverge from project standards
- Real-time activity feed of recent changes
- Monitor context modifications
- Prevent context drift between work sessions
- Preserve decisions and rationale for future reference
- Enforce project patterns and architectural choices
- Store custom project data and glossaries
- Standardize AI responses to project requirements

## Interface Features

### Visual Tools
- Interactive knowledge graph with relationship mapping
- Kanban board for progress tracking with drag-and-drop
- Real-time updates via activity feed
- Context editors for product and active contexts
- Markdown documentation viewer with export functionality
  - Browse and view exported markdown files by category
  - Edit markdown files directly in the UI
  - Export ConPort data to markdown for version control
  - Workspace-specific file locations with proper isolation
- Create, read, update, delete operations for:
  - Decisions (architectural and implementation)
  - Progress items (tasks and status)
  - System patterns (coding standards and practices)
  - Custom data (glossaries, specifications, notes)
  - Product and active contexts
  - Relationship links between all items
- Full-text search across all project data
- Semantic search using vector embeddings
- Filter by item type, tags, and relationships
- Cross-entity search results

## Technical Architecture

### Web Dashboard
- Next.js 14 with TypeScript
- Real-time updates via TanStack Query
- Interactive canvas for knowledge graph
- Responsive interface design

### Backend
- FastAPI server with FastMCP integration
- SQLite database with automatic migrations
- FTS5 full-text search engine
- Vector embeddings for semantic search
- Multi-workspace port-based routing
- Model Context Protocol integration for AI access

## Who Uses AIMED

AIMED is designed for developers/engineers working with AI coding assistants who need to:
- Reduce token costs through context management
- Maintain project coherence across work sessions
- Understand what context their AI is using
- Track decisions and progress visually
- Ensure AI stays on target and executes effectively
