"use client";

import Link from "next/link";

export default function AboutPage() {
  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900">
      {/* Header */}
      <div className="bg-white dark:bg-gray-800 shadow-sm border-b border-gray-200 dark:border-gray-700">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
          <div className="flex items-center gap-4 mb-4">
            <Link
              href="/"
              className="flex items-center gap-2 text-blue-600 dark:text-blue-400 hover:text-blue-700 dark:hover:text-blue-300"
            >
              <span className="text-lg">←</span>
              Back to Dashboard
            </Link>
          </div>
          <div className="flex items-center gap-4">
            <img
              src="/AIMED-scope-logo.svg"
              alt="AIMED Scope Logo"
              className="h-12 w-12"
            />
            <div>
              <h1 className="text-3xl font-bold text-gray-900 dark:text-white">
                AIMED
              </h1>
              <p className="text-lg text-gray-600 dark:text-gray-400">
                AI Monitoring & Execution Dashboard
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* Main Content */}
      <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="space-y-8">
          {/* What is AIMED? */}
          <section className="bg-white dark:bg-gray-800 rounded-lg shadow p-6">
            <h2 className="text-2xl font-bold text-gray-900 dark:text-white mb-4">
              What is AIMED?
            </h2>
            <div className="prose prose-gray dark:prose-invert max-w-none">
              <p>
                <strong>AIMED</strong> (AI Monitoring & Execution Dashboard) is a web interface for{" "}
                <Link
                  href="https://github.com/GreatScottyMac/context-portal"
                  className="text-blue-600 dark:text-blue-400 hover:underline inline-flex items-center gap-1"
                  target="_blank"
                  rel="noopener noreferrer"
                >
                  ConPort MCP <span className="text-sm">↗️</span>
                </Link>{" "}
                that provides visual access to project context knowledge used by AI assistants. It offers
                dashboard interfaces for viewing, editing, and managing project decisions, progress,
                contexts, and relationships.
              </p>
              <p>
                AIMED allows you to keep AI context <strong>directed</strong>, <strong>transparent</strong>, and context{" "}
                <strong>visible</strong>.
              </p>
              <p>
                It keeps LLMs focused and cost effective. 
                It's surpriSing how much baggage can be built up in context that get needlessly tokenized per request. 
                AIMED helps eliminate that baggage by providing a clear, visual way to manage and curate the context that LLMs use.
              </p>
            </div>
          </section>

          {/* Architecture */}
          <section className="bg-white dark:bg-gray-800 rounded-lg shadow p-6">
            <h2 className="text-2xl font-bold text-gray-900 dark:text-white mb-4">
              Architecture
            </h2>
            <div className="grid md:grid-cols-2 gap-6">
              <div className="bg-blue-50 dark:bg-blue-900/20 rounded-lg p-4">
                <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-3 flex items-center">
                  <span className="mr-2">🏗️</span>
                  ConPort MCP Foundation
                </h3>
                <ul className="text-sm text-gray-600 dark:text-gray-400 space-y-1">
                  <li>• SQLite-backed structured storage</li>
                  <li>• Model Context Protocol server</li>
                  <li>• Multi-workspace support</li>
                  <li>• Vector search & embeddings</li>
                  <li>• Dynamic knowledge graph</li>
                  <li>• Comprehensive MCP tools</li>
                </ul>
              </div>
              <div className="bg-green-50 dark:bg-green-900/20 rounded-lg p-4">
                <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-3 flex items-center">
                  <span className="mr-2">📊</span>
                  AIMED Visual Layer
                </h3>
                <ul className="text-sm text-gray-600 dark:text-gray-400 space-y-1">
                  <li>• Real-time dashboard interface</li>
                  <li>• Interactive knowledge graph canvas</li>
                  <li>• Visual context management</li>
                  <li>• Advanced search interface</li>
                  <li>• Multi-workspace UI</li>
                  <li>• CRUD operations for all data</li>
                </ul>
              </div>
            </div>
          </section>

          {/* Important Compatibility Notice */}
          <section className="bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 rounded-lg p-6">
            <div className="flex items-start gap-3">
              <div className="text-2xl">⚠️</div>
              <div>
                <h2 className="text-xl font-bold text-amber-800 dark:text-amber-200 mb-2">
                  Important: Compatibility with ConPort MCP
                </h2>
                <div className="prose prose-amber dark:prose-invert max-w-none">
                  <p className="text-amber-800 dark:text-amber-200">
                    AIMED builds upon the excellent foundation provided by <strong>ScottyMac's ConPort MCP</strong>. However, to enable seamless web interface integration, it's had to have some modifications to the core system that result in <strong>incompatibility</strong> with the original ConPort MCP server.
                  </p>
                  <p className="text-amber-800 dark:text-amber-200 mt-2">
                    <strong>If you're currently using ConPort MCP:</strong> Please temporarily disable your existing ConPort MCP server configuration in your IDE before running AIMED to avoid conflicts.
                  </p>
                  <p className="text-amber-700 dark:text-amber-300 text-sm mt-2">
                    We're planning a migration tool to help existing ConPort users seamlessly transition their project data to AIMED, ensuring no valuable context or decisions are lost.
                  </p>
                </div>
              </div>
            </div>
          </section>

          {/* Core Benefits */}
          <section className="bg-white dark:bg-gray-800 rounded-lg shadow p-6">
            <h2 className="text-2xl font-bold text-gray-900 dark:text-white mb-4">
              Core Benefits
            </h2>
            <div className="grid md:grid-cols-3 gap-6">
              <div className="text-center">
                <div className="text-3xl mb-3">🕒</div>
                <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-2">
                  Context Management
                </h3>
                <ul className="text-sm text-gray-600 dark:text-gray-400 space-y-1 text-left">
                  <li>• Visual editing of product and active project contexts</li>
                  <li>• Form-based and JSON editing modes</li>
                  <li>• Multi-workspace context isolation</li>
                  <li>• Real-time synchronization with ConPort backend</li>
                </ul>
              </div>
              <div className="text-center">
                <div className="text-3xl mb-3">🕸️</div>
                <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-2">
                  Knowledge Visualization
                </h3>
                <ul className="text-sm text-gray-600 dark:text-gray-400 space-y-1 text-left">
                  <li>• Interactive knowledge graph with relationship mapping</li>
                  <li>• Real-time activity feed showing project changes</li>
                  <li>• Kanban board for task and progress visualization</li>
                  <li>• Visual search interface with categorized results</li>
                </ul>
              </div>
              <div className="text-center">
                <div className="text-3xl mb-3">📦</div>
                <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-2">
                  Knowledge Management
                </h3>
                <ul className="text-sm text-gray-600 dark:text-gray-400 space-y-1 text-left">
                  <li>• CRUD operations for decisions, progress, patterns</li>
                  <li>• Visual interfaces for ConPort's custom data storage</li>
                  <li>• Full-text and semantic search across all project knowledge</li>
                  <li>• Web dashboard for ConPort's SQLite backend</li>
                </ul>
              </div>
            </div>
          </section>

          {/* Key Features */}
          <section className="bg-white dark:bg-gray-800 rounded-lg shadow p-6">
            <h2 className="text-2xl font-bold text-gray-900 dark:text-white mb-4">
              Key Features
            </h2>
            <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
              <div className="bg-gray-50 dark:bg-gray-700 rounded-lg p-4">
                <div className="text-2xl mb-2">📊</div>
                <h3 className="font-semibold text-gray-900 dark:text-white mb-2">Real-time Dashboard</h3>
                <p className="text-sm text-gray-600 dark:text-gray-400">
                  Activity summaries, progress tracking, and live updates with configurable polling
                </p>
              </div>
              <div className="bg-gray-50 dark:bg-gray-700 rounded-lg p-4">
                <div className="text-2xl mb-2">🕸️</div>
                <h3 className="font-semibold text-gray-900 dark:text-white mb-2">Knowledge Graph</h3>
                <p className="text-sm text-gray-600 dark:text-gray-400">
                  Interactive canvas for visualizing and creating relationships between project elements
                </p>
              </div>
              <div className="bg-gray-50 dark:bg-gray-700 rounded-lg p-4">
                <div className="text-2xl mb-2">🕒</div>
                <h3 className="font-semibold text-gray-900 dark:text-white mb-2">Context Management</h3>
                <p className="text-sm text-gray-600 dark:text-gray-400">
                  Visual editing for product and active contexts
                </p>
              </div>
              <div className="bg-gray-50 dark:bg-gray-700 rounded-lg p-4">
                <div className="text-2xl mb-2">⚡</div>
                <h3 className="font-semibold text-gray-900 dark:text-white mb-2">Decision Tracking</h3>
                <p className="text-sm text-gray-600 dark:text-gray-400">
                  Log and manage architectural decisions with rationale and implementation details
                </p>
              </div>
              <div className="bg-gray-50 dark:bg-gray-700 rounded-lg p-4">
                <div className="text-2xl mb-2">✅</div>
                <h3 className="font-semibold text-gray-900 dark:text-white mb-2">Progress Management</h3>
                <p className="text-sm text-gray-600 dark:text-gray-400">
                  Kanban-style task management with drag-and-drop and hierarchical organization
                </p>
              </div>
              <div className="bg-gray-50 dark:bg-gray-700 rounded-lg p-4">
                <div className="text-2xl mb-2">🔍</div>
                <h3 className="font-semibold text-gray-900 dark:text-white mb-2">Advanced Search</h3>
                <p className="text-sm text-gray-600 dark:text-gray-400">
                  Full-text search (FTS5) and semantic search with vector embeddings
                </p>
              </div>
            </div>
          </section>

          {/* Technical Foundation */}
          <section className="bg-white dark:bg-gray-800 rounded-lg shadow p-6">
            <h2 className="text-2xl font-bold text-gray-900 dark:text-white mb-4">
              Technical Foundation
            </h2>
            <div className="grid md:grid-cols-2 gap-6">
              <div>
                <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-3">
                  Backend (ConPort MCP)
                </h3>
                <ul className="text-sm text-gray-600 dark:text-gray-400 space-y-1">
                  <li>• Python/FastAPI-based MCP server</li>
                  <li>• SQLite with automatic schema migrations</li>
                  <li>• Vector embeddings for semantic search</li>
                  <li>• Full-text search with FTS5</li>
                  <li>• Multi-workspace isolation</li>
                </ul>
              </div>
              <div>
                <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-3">
                  Frontend (AIMED UI)
                </h3>
                <ul className="text-sm text-gray-600 dark:text-gray-400 space-y-1">
                  <li>• Next.js App Router with TypeScript</li>
                  <li>• Tailwind CSS + shadcn/ui components</li>
                  <li>• TanStack Query for data management</li>
                  <li>• Real-time updates via polling</li>
                  <li>• Cross-platform compatibility</li>
                </ul>
              </div>
            </div>
          </section>

          {/* Who Uses AIMED */}
          <section className="bg-white dark:bg-gray-800 rounded-lg shadow p-6">
            <h2 className="text-2xl font-bold text-gray-900 dark:text-white mb-4">
              Who Uses AIMED?
            </h2>
            <div className="grid md:grid-cols-3 gap-6">
              <div className="text-center">
                <div className="text-3xl mb-3">👩‍💻</div>
                <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-2">
                  Developers & Engineers
                </h3>
                <p className="text-sm text-gray-600 dark:text-gray-400">
                  Visual project context management, dashboard interfaces for ConPort data,
                  and organized project knowledge access.
                </p>
              </div>
              <div className="text-center">
                <div className="text-3xl mb-3">👨‍💼</div>
                <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-2">
                  Tech Leads & Architects
                </h3>
                <p className="text-sm text-gray-600 dark:text-gray-400">
                  Visual access to architectural decisions, knowledge graph exploration,
                  and project decision history tracking.
                </p>
              </div>
              <div className="text-center">
                <div className="text-3xl mb-3">📊</div>
                <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-2">
                  Project Managers & Stakeholders
                </h3>
                <p className="text-sm text-gray-600 dark:text-gray-400">
                  Dashboard view of project progress, decision logs, and activity summaries
                  through web interface.
                </p>
              </div>
            </div>
          </section>

          {/* Links */}
          <section className="bg-white dark:bg-gray-800 rounded-lg shadow p-6">
            <h2 className="text-2xl font-bold text-gray-900 dark:text-white mb-4">
              Learn More
            </h2>
            <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-4">
              <Link
                href="https://github.com/drew1two/AIMED"
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center gap-2 p-3 bg-blue-50 dark:bg-blue-900/20 rounded-lg hover:bg-blue-100 dark:hover:bg-blue-900/30 transition-colors"
              >
                <span className="text-xl">🐙</span>
                <div>
                  <div className="font-medium text-gray-900 dark:text-white">GitHub Repository</div>
                  <div className="text-sm text-gray-600 dark:text-gray-400">Source code & releases</div>
                </div>
                <span className="text-gray-400 ml-auto text-sm">↗️</span>
              </Link>
              <Link
                href="https://github.com/GreatScottyMac/context-portal"
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center gap-2 p-3 bg-green-50 dark:bg-green-900/20 rounded-lg hover:bg-green-100 dark:hover:bg-green-900/30 transition-colors"
              >
                <span className="text-xl">🏗️</span>
                <div>
                  <div className="font-medium text-gray-900 dark:text-white">ConPort MCP</div>
                  <div className="text-sm text-gray-600 dark:text-gray-400">Core foundation</div>
                </div>
                <span className="text-gray-400 ml-auto text-sm">↗️</span>
              </Link>
              <Link
                href="https://github.com/drew1two/AIMED/blob/main/README.md"
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center gap-2 p-3 bg-purple-50 dark:bg-purple-900/20 rounded-lg hover:bg-purple-100 dark:hover:bg-purple-900/30 transition-colors"
              >
                <span className="text-xl">📚</span>
                <div>
                  <div className="font-medium text-gray-900 dark:text-white">Documentation</div>
                  <div className="text-sm text-gray-600 dark:text-gray-400">Installation & usage</div>
                </div>
                <span className="text-gray-400 ml-auto text-sm">↗️</span>
              </Link>
              <Link
                href="https://github.com/drew1two/AIMED/issues"
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center gap-2 p-3 bg-orange-50 dark:bg-orange-900/20 rounded-lg hover:bg-orange-100 dark:hover:bg-orange-900/30 transition-colors"
              >
                <span className="text-xl">🐛</span>
                <div>
                  <div className="font-medium text-gray-900 dark:text-white">Report Issues</div>
                  <div className="text-sm text-gray-600 dark:text-gray-400">Bugs & features</div>
                </div>
                <span className="text-gray-400 ml-auto text-sm">↗️</span>
              </Link>
            </div>
          </section>

          {/* Version */}
          <section className="bg-gray-100 dark:bg-gray-700 rounded-lg p-4 text-center">
            <p className="text-sm text-gray-600 dark:text-gray-400">
              AIMED extends ConPort MCP v0.3.4 • Visual interface for ConPort MCP
            </p>
          </section>
        </div>
      </div>
    </div>
  );
}