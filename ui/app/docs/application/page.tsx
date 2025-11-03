"use client";

import { useState, useEffect } from "react";
import Link from "next/link";

export default function Documentation() {
  const [activeSection, setActiveSection] = useState('dashboard');

  // Update active section on scroll
  useEffect(() => {
    const handleScroll = () => {
      const sections = document.querySelectorAll('section[id]');
      const scrollPosition = window.scrollY + 100;
      
      let current = '';
      sections.forEach(section => {
        const sectionTop = (section as HTMLElement).offsetTop;
        if (scrollPosition >= sectionTop) {
          current = section.getAttribute('id') || '';
        }
      });

      if (current) {
        setActiveSection(current);
      }
    };

    window.addEventListener('scroll', handleScroll);
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  // Smooth scrolling for anchor links
  const handleLinkClick = (e: React.MouseEvent<HTMLAnchorElement>, targetId: string) => {
    e.preventDefault();
    const target = document.getElementById(targetId);
    if (target) {
      const navHeight = 80;
      const targetPosition = target.offsetTop - navHeight;
      window.scrollTo({
        top: targetPosition,
        behavior: 'smooth'
      });
    }
  };

  const sidebarNavItems = [
    { id: 'dashboard', label: 'Dashboard', indent: false },
    { id: 'knowledge-graph', label: 'Knowledge Graph', indent: false },
    { id: 'context-management', label: 'Context Management', indent: false },
    { id: 'data-management', label: 'Data Management', indent: false },
    { id: 'unique-constraints', label: 'Unique Constraints Guide', indent: false },
    { id: 'search', label: 'Search', indent: false },
    { id: 'tips-and-tricks', label: 'Tips & Tricks', indent: false },
    { id: 'mcp-setup', label: 'MCP Setup', indent: false },
    { id: 'database-updates', label: 'Database Updates', indent: false },
    { id: 'troubleshooting', label: 'Troubleshooting', indent: false },
  ];

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-gray-900 dark:text-white mb-2">📚 Help & Documentation</h1>
        <p className="text-gray-600 dark:text-gray-400">Guide to using each section of AIMED</p>
      </div>

      <div className="grid lg:grid-cols-4 gap-8">
        {/* Sidebar Navigation */}
        <div className="lg:col-span-1">
          <div className="sticky top-24 bg-white dark:bg-gray-800 rounded-lg shadow p-4">
            <nav className="space-y-1">
              {sidebarNavItems.map((item) => (
                <a
                  key={item.id}
                  href={`#${item.id}`}
                  onClick={(e) => handleLinkClick(e, item.id)}
                  className={`block py-2 px-3 text-sm rounded cursor-pointer transition-colors ${
                    activeSection === item.id
                      ? 'font-medium text-blue-600 bg-blue-50 dark:bg-blue-900/20'
                      : 'text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white hover:bg-gray-100 dark:hover:bg-gray-800'
                  }`}
                >
                  {item.label}
                </a>
              ))}
            </nav>
          </div>
        </div>

        {/* Main Content */}
        <div className="lg:col-span-3 space-y-8">
          
          {/* Dashboard */}
          <section id="dashboard" className="bg-white dark:bg-gray-800 rounded-lg shadow p-6">
            <h2 className="text-2xl font-bold text-gray-900 dark:text-white mb-4 flex items-center">
              <span className="text-3xl mr-3">📊</span>Dashboard
            </h2>
            <div className="grid md:grid-cols-2 gap-6">
              <div className="bg-gray-50 dark:bg-gray-700 rounded-lg p-4">
                <h3 className="text-lg font-bold text-gray-900 dark:text-white mb-3">Activity Feed View</h3>
                <div className="text-sm text-gray-600 dark:text-gray-400 space-y-1">
                  <div>• View recent progress, decisions, and changes</div>
                  <div>• Filter by type and status</div>
                  <div>• Click items to view details</div>
                  <div>• Auto-refreshes every 3 seconds</div>
                </div>
              </div>
              <div className="bg-gray-50 dark:bg-gray-700 rounded-lg p-4">
                <h3 className="text-lg font-bold text-gray-900 dark:text-white mb-3">Kanban Board View</h3>
                <div className="text-sm text-gray-600 dark:text-gray-400 space-y-1">
                  <div>• Drag tasks between TODO/IN_PROGRESS/DONE</div>
                  <div>• Click "+" to add new progress items</div>
                  <div>• View task hierarchies</div>
                  <div>• Status changes sync automatically</div>
                </div>
              </div>
            </div>
          </section>

          {/* Knowledge Graph */}
          <section id="knowledge-graph" className="bg-white dark:bg-gray-800 rounded-lg shadow p-6">
            <h2 className="text-2xl font-bold text-gray-900 dark:text-white mb-4 flex items-center">
              <span className="text-3xl mr-3">🕸️</span>Knowledge Graph
            </h2>
            
            <div className="grid md:grid-cols-2 gap-6 mb-6">
              <div className="bg-gray-50 dark:bg-gray-700 rounded-lg p-4">
                <h3 className="font-bold text-gray-900 dark:text-white mb-2">Canvas Navigation</h3>
                <div className="text-sm text-gray-600 dark:text-gray-400 space-y-1">
                  <div>• 🖱️ <strong>Click nodes</strong> to select and view details</div>
                  <div>• 🔍 <strong>Mouse wheel</strong> to zoom in/out</div>
                  <div>• ✋ <strong>Drag canvas</strong> to pan around</div>
                  <div>• 🎯 <strong>Double-click</strong> to focus on node (1-hop view)</div>
                  <div>• 🚀 <strong>Drag nodes</strong> to reposition (positions saved)</div>
                </div>
              </div>
              <div className="bg-gray-50 dark:bg-gray-700 rounded-lg p-4">
                <h3 className="font-bold text-gray-900 dark:text-white mb-2">Visual Search</h3>
                <div className="text-sm text-gray-600 dark:text-gray-400 space-y-1">
                  <div>• 🔍 <strong>Click Search button</strong> or press Ctrl+F</div>
                  <div>• ⚡ <strong>Real-time highlighting</strong> as you type</div>
                  <div>• 📋 <strong>Results dropdown</strong> shows matching nodes</div>
                  <div>• 🎯 <strong>Click results</strong> to center view on node</div>
                  <div>• 🚚 <strong>Drag search box</strong> to move out of the way</div>
                </div>
              </div>
            </div>

            <div className="grid md:grid-cols-2 gap-6 mb-6">
              <div className="bg-gray-50 dark:bg-gray-700 rounded-lg p-4">
                <h3 className="font-bold text-gray-900 dark:text-white mb-2">Link Creation</h3>
                <div className="text-sm text-gray-600 dark:text-gray-400 space-y-1">
                  <div>• 🔗 <strong>Enable Link Mode</strong> with toggle button</div>
                  <div>• 1️⃣ <strong>Click source node</strong> (highlighted in red)</div>
                  <div>• 2️⃣ <strong>Click target node</strong> to open relationship menu</div>
                  <div>• ⚡ <strong>Choose relationship type</strong> from dropdown</div>
                  <div>• ✅ <strong>Confirm creation</strong> - link appears instantly</div>
                </div>
              </div>
              <div className="bg-gray-50 dark:bg-gray-700 rounded-lg p-4">
                <h3 className="font-bold text-gray-900 dark:text-white mb-2">Link Management</h3>
                <div className="text-sm text-gray-600 dark:text-gray-400 space-y-1">
                  <div>• 🖱️ <strong>Right-click edges</strong> for context menu</div>
                  <div>• ✏️ <strong>Edit relationship type</strong> inline</div>
                  <div>• 🗑️ <strong>Delete links</strong> with confirmation</div>
                  <div>• 👀 <strong>Multi-edge areas</strong> show selection menu</div>
                  <div>• 🎛️ <strong>Use filters</strong> to hide/show specific link types</div>
                </div>
              </div>
            </div>

            <div className="grid md:grid-cols-2 gap-6 mb-6">
              <div className="bg-gray-50 dark:bg-gray-700 rounded-lg p-4">
                <h3 className="font-bold text-gray-900 dark:text-white mb-2">Node Types & Colors</h3>
                <div className="space-y-2 text-sm">
                  <div className="flex items-center gap-2">
                    <span className="w-4 h-4 rounded-full bg-blue-500"></span>
                    <strong>Decisions</strong> - Blue circles (📋)
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="w-4 h-4 rounded-full bg-green-500"></span>
                    <strong>Progress</strong> - Color by status (📈)
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="w-4 h-4 rounded-full bg-purple-500"></span>
                    <strong>System Patterns</strong> - Purple circles (🔧)
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="w-4 h-4 rounded-full bg-cyan-500"></span>
                    <strong>Custom Data</strong> - Cyan circles (📄)
                  </div>
                </div>
              </div>
              <div className="bg-gray-50 dark:bg-gray-700 rounded-lg p-4">
                <h3 className="font-bold text-gray-900 dark:text-white mb-2">Visual Indicators</h3>
                <div className="space-y-2 text-sm">
                  <div className="flex items-center gap-2">
                    <span className="w-4 h-4 border-2 border-orange-500 rounded-full"></span>
                    <strong>Selected Node</strong> - Orange border
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="w-4 h-4 border-2 border-green-500 rounded-full"></span>
                    <strong>Focus Center</strong> - Green border (focus mode)
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="w-4 h-4 border-2 border-red-600 rounded-full"></span>
                    <strong>Link Source</strong> - Red border (link creation)
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="w-4 h-4 border-2 border-amber-500 rounded-full"></span>
                    <strong>Search Match</strong> - Amber border (search results)
                  </div>
                </div>
              </div>
            </div>

            <div className="bg-blue-50 dark:bg-blue-900/20 rounded-lg p-4">
              <h3 className="font-bold text-gray-900 dark:text-white mb-2">Available Relationship Types</h3>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-2 text-sm">
                <span className="bg-white dark:bg-gray-700 px-2 py-1 rounded text-center">IMPLEMENTS</span>
                <span className="bg-white dark:bg-gray-700 px-2 py-1 rounded text-center">DEPENDS_ON</span>
                <span className="bg-white dark:bg-gray-700 px-2 py-1 rounded text-center">BLOCKED_BY</span>
                <span className="bg-white dark:bg-gray-700 px-2 py-1 rounded text-center">RELATED_TO</span>
                <span className="bg-white dark:bg-gray-700 px-2 py-1 rounded text-center">PRODUCES</span>
                <span className="bg-white dark:bg-gray-700 px-2 py-1 rounded text-center">CONSUMES</span>
                <span className="bg-white dark:bg-gray-700 px-2 py-1 rounded text-center">VERIFIES</span>
                <span className="bg-white dark:bg-gray-700 px-2 py-1 rounded text-center">CLARIFIES</span>
                <span className="bg-white dark:bg-gray-700 px-2 py-1 rounded text-center">BUILDS_ON</span>
                <span className="bg-white dark:bg-gray-700 px-2 py-1 rounded text-center">DERIVED_FROM</span>
                <span className="bg-white dark:bg-gray-700 px-2 py-1 rounded text-center">RESOLVES</span>
                <span className="bg-white dark:bg-gray-700 px-2 py-1 rounded text-center">TRACKS</span>
              </div>
            </div>

            <div className="bg-gray-50 dark:bg-gray-700 rounded-lg p-4 mt-6">
              <h3 className="font-bold text-gray-900 dark:text-white mb-2">📋 Core Purpose & Design</h3>
              <p className="text-sm text-gray-600 dark:text-gray-400 mb-3">
                The knowledge graph provides an interactive visualization of AIMED entities (decisions, progress entries, system patterns, custom data) and their relationships, allowing you to explore connections and dependencies visually.
              </p>
              <div className="grid md:grid-cols-2 gap-4 text-sm">
                <div>
                  <strong className="text-gray-900 dark:text-white">Layout & Physics:</strong>
                  <div className="text-gray-600 dark:text-gray-400 space-y-1 mt-1">
                    <div>• Nodes repel each other (charge force)</div>
                    <div>• Connected nodes linked with distance</div>
                    <div>• Collision detection prevents overlap</div>
                    <div>• Center force keeps graph centered</div>
                    <div>Note: These settings help with first load of the knowledge graph. So after adjusting, click out of knowledge graph and then click back in to see your changes in effect</div>
                  </div>
                </div>
                <div>
                  <strong className="text-gray-900 dark:text-white">Interface Panels:</strong>
                  <div className="text-gray-600 dark:text-gray-400 space-y-1 mt-1">
                    <div>• Filters panel (left sidebar, toggleable)</div>
                    <div>• Node details drawer (right sidebar, auto-opens)</div>
                    <div>• Controls overlay (top-left, interaction hints)</div>
                    <div>• Legend overlay (bottom-right, reference)</div>
                  </div>
                </div>
              </div>
            </div>
          </section>

          {/* Context Management */}
          <section id="context-management" className="bg-white dark:bg-gray-800 rounded-lg shadow p-6">
            <h2 className="text-2xl font-bold text-gray-900 dark:text-white mb-4 flex items-center">
              <span className="text-3xl mr-3">🕒</span>Context Management
            </h2>
            <div className="grid md:grid-cols-2 gap-6">
              <div className="bg-gray-50 dark:bg-gray-700 rounded-lg p-4">
                <h3 className="text-lg font-bold text-gray-900 dark:text-white mb-3 flex items-center">
                  <span className="mr-2">🎯</span>Product Context
                </h3>
                <div className="text-sm text-gray-600 dark:text-gray-400 space-y-1">
                  <div>• Navigate to Context → Product Context</div>
                  <div>• Edit project goals, features, architecture</div>
                  <div>• Changes persist across sessions</div>
                  <div>• View version history</div>
                  <div>• Export/import functionality available</div>
                </div>
              </div>
              <div className="bg-gray-50 dark:bg-gray-700 rounded-lg p-4">
                <h3 className="text-lg font-bold text-gray-900 dark:text-white mb-3 flex items-center">
                  <span className="mr-2">⚡</span>Active Context
                </h3>
                <div className="text-sm text-gray-600 dark:text-gray-400 space-y-1">
                  <div>• Navigate to Context → Active Context</div>
                  <div>• Track current focus and session goals</div>
                  <div>• Log open issues and blockers</div>
                  <div>• Reset when starting new work sessions</div>
                  <div>• AI assistants read this for current state</div>
                </div>
              </div>
            </div>
          </section>

          {/* Data Management */}
          <section id="data-management" className="bg-white dark:bg-gray-800 rounded-lg shadow p-6">
            <h2 className="text-2xl font-bold text-gray-900 dark:text-white mb-4 flex items-center">
              <span className="text-3xl mr-3">📦</span>Data Management
            </h2>
            <div className="grid md:grid-cols-2 gap-6">
              <div className="space-y-4">
                <div className="bg-gray-50 dark:bg-gray-700 rounded-lg p-4">
                  <h3 className="font-bold text-gray-900 dark:text-white mb-2 flex items-center">
                    <span className="mr-2">⚡</span>Decisions
                  </h3>
                  <div className="text-sm text-gray-600 dark:text-gray-400 space-y-1">
                    <div>• Create & Track → Decisions</div>
                    <div>• Log architectural decisions with rationale</div>
                    <div>• Add implementation details</div>
                    <div>• Use tags for categorization</div>
                  </div>
                </div>
                <div className="bg-gray-50 dark:bg-gray-700 rounded-lg p-4">
                  <h3 className="font-bold text-gray-900 dark:text-white mb-2 flex items-center">
                    <span className="mr-2">✅</span>Progress
                  </h3>
                  <div className="text-sm text-gray-600 dark:text-gray-400 space-y-1">
                    <div>• Create & Track → Progress</div>
                    <div>• Set status: TODO/IN_PROGRESS/DONE</div>
                    <div>• Link to parent tasks</div>
                    <div>• View in Kanban board</div>
                  </div>
                </div>
              </div>
              <div className="space-y-4">
                <div className="bg-gray-50 dark:bg-gray-700 rounded-lg p-4">
                  <h3 className="font-bold text-gray-900 dark:text-white mb-2 flex items-center">
                    <span className="mr-2">🏗️</span>Patterns
                  </h3>
                  <div className="text-sm text-gray-600 dark:text-gray-400 space-y-1">
                    <div>• Create & Track → Patterns</div>
                    <div>• Define system/coding patterns</div>
                    <div>• Add descriptions and examples</div>
                    <div>• Tag for easy discovery</div>
                  </div>
                </div>
                <div className="bg-gray-50 dark:bg-gray-700 rounded-lg p-4">
                  <h3 className="font-bold text-gray-900 dark:text-white mb-2 flex items-center">
                    <span className="mr-2">📋</span>Custom Data
                  </h3>
                  <div className="text-sm text-gray-600 dark:text-gray-400 space-y-1">
                    <div>• Create & Track → Custom Data</div>
                    <div>• Store any project information</div>
                    <div>• Organize by categories</div>
                    <div>• ProjectGlossary for terms</div>
                  </div>
                </div>
              </div>
            </div>
          </section>

          {/* Unique Constraints Guide */}
          <section id="unique-constraints" className="bg-white dark:bg-gray-800 rounded-lg shadow p-6">
            <h2 className="text-2xl font-bold text-gray-900 dark:text-white mb-4 flex items-center">
              <span className="text-3xl mr-3">🔐</span>Unique Constraints Guide
            </h2>
            
            <div className="bg-blue-50 dark:bg-blue-900/20 rounded-lg p-4 mb-6">
              <div className="flex items-start">
                <div className="text-2xl mr-3">💡</div>
                <div>
                  <h4 className="font-bold text-gray-900 dark:text-white mb-2">Database Behavior: Update vs Create-New</h4>
                  <p className="text-gray-700 dark:text-gray-300 text-sm mb-3">
                    AIMED uses INSERT ON CONFLICT database operations to preserve record IDs and knowledge graph relationships when updating entities.
                  </p>
                  <div className="bg-white dark:bg-gray-700 rounded p-3 text-xs">
                    <div className="text-gray-600 dark:text-gray-400 space-y-1">
                      <div><strong>Technical:</strong> Replaced INSERT OR REPLACE with INSERT ON CONFLICT to prevent ID changes</div>
                      <div><strong>UI Behavior:</strong> Smart detection alerts users when constraint changes will create new records</div>
                      <div><strong>Result:</strong> Knowledge graph relationships are preserved during updates</div>
                    </div>
                  </div>
                </div>
              </div>
            </div>

            <div className="grid md:grid-cols-2 gap-6 mb-6">
              <div className="bg-gray-50 dark:bg-gray-700 rounded-lg p-4">
                <h3 className="text-lg font-bold text-gray-900 dark:text-white mb-3 flex items-center">
                  <span className="mr-2">🏗️</span>System Patterns
                </h3>
                <div className="space-y-3">
                  <div className="bg-amber-100 dark:bg-amber-900/30 rounded p-3">
                    <div className="font-bold text-amber-800 dark:text-amber-200 text-sm mb-1">Unique Field: Name</div>
                    <div className="text-amber-700 dark:text-amber-300 text-xs">
                      Changing the pattern name creates a new record
                    </div>
                  </div>
                  <div className="text-sm text-gray-600 dark:text-gray-400 space-y-1">
                    <div>✅ <strong>Safe to Update:</strong> Description, Tags</div>
                    <div>⚠️ <strong>Creates New Record:</strong> Name</div>
                  </div>
                </div>
              </div>

              <div className="bg-gray-50 dark:bg-gray-700 rounded-lg p-4">
                <h3 className="text-lg font-bold text-gray-900 dark:text-white mb-3 flex items-center">
                  <span className="mr-2">📋</span>Custom Data
                </h3>
                <div className="space-y-3">
                  <div className="bg-amber-100 dark:bg-amber-900/30 rounded p-3">
                    <div className="font-bold text-amber-800 dark:text-amber-200 text-sm mb-1">Unique Fields: Category + Key</div>
                    <div className="text-amber-700 dark:text-amber-300 text-xs">
                      Changing category OR key creates a new record
                    </div>
                  </div>
                  <div className="text-sm text-gray-600 dark:text-gray-400 space-y-1">
                    <div>✅ <strong>Safe to Update:</strong> Value (content)</div>
                    <div>⚠️ <strong>Creates New Record:</strong> Category, Key</div>
                  </div>
                </div>
              </div>
            </div>

            <div className="bg-green-50 dark:bg-green-900/20 rounded-lg p-4 mb-6">
              <h3 className="text-lg font-bold text-gray-900 dark:text-white mb-3">✅ Safe Entity Types (No Unique Constraints)</h3>
              <div className="grid md:grid-cols-2 gap-4 text-sm">
                <div>
                  <div className="font-bold text-gray-900 dark:text-white">⚡ Decisions</div>
                  <div className="text-gray-600 dark:text-gray-400">All fields can be updated safely</div>
                </div>
                <div>
                  <div className="font-bold text-gray-900 dark:text-white">✅ Progress Entries</div>
                  <div className="text-gray-600 dark:text-gray-400">All fields can be updated safely</div>
                </div>
              </div>
            </div>

            <div className="space-y-4">
              <div className="bg-gray-100 dark:bg-gray-600 rounded-lg p-4">
                <h3 className="font-bold text-gray-900 dark:text-white mb-2">🔧 Technical Implementation</h3>
                <div className="text-sm text-gray-700 dark:text-gray-300 space-y-2">
                  <div><strong>Database Operations:</strong></div>
                  <ul className="ml-4 space-y-1 text-xs text-gray-600 dark:text-gray-400">
                    <li>• Non-unique field changes: <code>INSERT ... ON CONFLICT DO UPDATE</code> - preserves ID</li>
                    <li>• Unique field changes: <code>INSERT</code> creates new record - old record and links remain</li>
                    <li>• UI Detection: Compares edited values against current values to determine behavior</li>
                    <li>• User Feedback: Alerts appear only when constraint changes will create new records</li>
                  </ul>
                </div>
              </div>

              <div className="bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-200 dark:border-yellow-700 rounded-lg p-4">
                <h3 className="font-bold text-gray-900 dark:text-white mb-2">📝 UI Behavior Guide</h3>
                <ul className="text-sm text-gray-700 dark:text-gray-300 space-y-1">
                  <li>• <strong>Decisions & Progress:</strong> All edits update existing record (no unique constraints)</li>
                  <li>• <strong>Patterns name change:</strong> UI detects and alerts "Name changed: A new pattern has been created..."</li>
                  <li>• <strong>Custom Data category/key change:</strong> UI alerts "Category or key changed: A new custom data entry has been created..."</li>
                  <li>• <strong>Safe edits:</strong> No alerts shown - update happens in-place preserving ID and all links</li>
                </ul>
              </div>

              <div className="bg-blue-50 dark:bg-blue-900/20 rounded-lg p-4">
                <h3 className="font-bold text-gray-900 dark:text-white mb-2">🔗 Link Preservation Strategy</h3>
                <div className="text-sm text-gray-700 dark:text-gray-300 space-y-2">
                  <p><strong>When unique fields change and new records are created:</strong></p>
                  <ol className="list-decimal list-inside space-y-1 ml-4">
                    <li>Original record and all its links remain intact</li>
                    <li>New record is created with updated unique field values</li>
                    <li>Use Knowledge Graph to view old record's relationships</li>
                    <li>Copy important links to new record using "Add Link" functionality</li>
                    <li>Delete old record when no longer needed</li>
                  </ol>
                </div>
              </div>
            </div>
          </section>

          {/* Search */}
          <section id="search" className="bg-white dark:bg-gray-800 rounded-lg shadow p-6">
            <h2 className="text-2xl font-bold text-gray-900 dark:text-white mb-4 flex items-center">
              <span className="text-3xl mr-3">🔍</span>Search
            </h2>
            
            <div className="grid md:grid-cols-3 gap-6 mb-6">
              <div className="bg-gray-50 dark:bg-gray-700 rounded-lg p-4">
                <h3 className="font-bold text-gray-900 dark:text-white mb-2">GraphCanvas Visual Search</h3>
                <div className="text-sm text-gray-600 dark:text-gray-400 space-y-1">
                  <div>• <strong>Real-time highlighting</strong> as you type</div>
                  <div>• <strong>Ctrl+F</strong> to open search overlay</div>
                  <div>• <strong>Click results</strong> to center view on nodes</div>
                  <div>• <strong>Drag search box</strong> to reposition</div>
                  <div>• <strong>Amber highlighting</strong> shows all matches</div>
                </div>
              </div>
              <div className="bg-gray-50 dark:bg-gray-700 rounded-lg p-4">
                <h3 className="font-bold text-gray-900 dark:text-white mb-2">Full-Text Search (FTS5)</h3>
                <div className="text-sm text-gray-600 dark:text-gray-400 space-y-1">
                  <div>• <strong>Fast keyword search</strong> across all data</div>
                  <div>• <strong>Field prefixes:</strong> <code className="bg-gray-200 dark:bg-gray-600 px-1 rounded">summary:</code>, <code className="bg-gray-200 dark:bg-gray-600 px-1 rounded">category:</code></div>
                  <div>• <strong>Boolean operators:</strong> AND, OR, NOT</div>
                  <div>• <strong>Highlighted results</strong> in search pages</div>
                </div>
              </div>
              <div className="bg-gray-50 dark:bg-gray-700 rounded-lg p-4">
                <h3 className="font-bold text-gray-900 dark:text-white mb-2">Semantic Search</h3>
                <div className="text-sm text-gray-600 dark:text-gray-400 space-y-1">
                  <div>• <strong>Natural language</strong> queries</div>
                  <div>• <strong>Conceptual similarity</strong> matching</div>
                  <div>• <strong>Filter by types</strong> (decisions, progress, etc.)</div>
                  <div>• <strong>Relevance scoring</strong> for best matches</div>
                </div>
              </div>
            </div>

            <div className="bg-amber-50 dark:bg-amber-900/20 rounded-lg p-4">
              <h3 className="font-bold text-gray-900 dark:text-white mb-2">🔍 GraphCanvas Search Usage</h3>
              <div className="grid md:grid-cols-2 gap-4 text-sm">
                <div className="space-y-1">
                  <div><strong>Opening Search:</strong></div>
                  <div className="text-gray-600 dark:text-gray-400 ml-2">• Press <kbd className="bg-gray-200 dark:bg-gray-600 px-1 rounded">Ctrl+F</kbd> or click 🔍 Search button</div>
                  <div><strong>Searching:</strong></div>
                  <div className="text-gray-600 dark:text-gray-400 ml-2">• Type to highlight matching nodes instantly</div>
                  <div className="text-gray-600 dark:text-gray-400 ml-2">• Results dropdown shows all matches</div>
                </div>
                <div className="space-y-1">
                  <div><strong>Navigation:</strong></div>
                  <div className="text-gray-600 dark:text-gray-400 ml-2">• Click any result to center view on that node</div>
                  <div className="text-gray-600 dark:text-gray-400 ml-2">• Results stay visible for easy browsing</div>
                  <div><strong>Management:</strong></div>
                  <div className="text-gray-600 dark:text-gray-400 ml-2">• Drag header to reposition search box</div>
                  <div className="text-gray-600 dark:text-gray-400 ml-2">• Press <kbd className="bg-gray-200 dark:bg-gray-600 px-1 rounded">Esc</kbd> to close</div>
                </div>
              </div>
            </div>
          </section>

          {/* Tips and Tricks */}
          <section id="tips-and-tricks" className="bg-white dark:bg-gray-800 rounded-lg shadow p-6">
            <h2 className="text-2xl font-bold text-gray-900 dark:text-white mb-4 flex items-center">
              <span className="text-3xl mr-3">💡</span>Tips & Tricks
            </h2>
            
            <div className="bg-blue-50 dark:bg-blue-900/20 rounded-lg p-4 mb-6">
              <div className="flex items-start">
                <div className="text-2xl mr-3">🎯</div>
                <div>
                  <h4 className="font-bold text-gray-900 dark:text-white mb-2">Getting the Most from Your AI Assistant</h4>
                  <p className="text-gray-700 dark:text-gray-300 text-sm">
                    AIMED works best when you guide your AI assistant to use ConPort effectively. These tips show you practical
                    prompts and instructions to keep your AI on track. Most tips work best when added to your
                    <code className="bg-gray-200 dark:bg-gray-600 px-1 rounded ml-1">.roorules</code> file or project-specific
                    custom instructions.
                  </p>
                </div>
              </div>
            </div>

            <div className="space-y-6">
              {/* Getting Started */}
              <div className="bg-gray-50 dark:bg-gray-700 rounded-lg p-4">
                <h3 className="text-lg font-bold text-gray-900 dark:text-white mb-3 flex items-center">
                  <span className="mr-2">🚀</span>Getting Started
                </h3>
                <div className="grid md:grid-cols-2 gap-4 text-sm">
                  <div className="bg-white dark:bg-gray-600 rounded p-3">
                    <div className="font-bold text-gray-900 dark:text-white mb-2">New Project Setup</div>
                    <ol className="text-gray-600 dark:text-gray-400 space-y-1 list-decimal list-inside text-xs">
                      <li>Turn off conport-aimed MCP server (prevents premature file creation)</li>
                      <li>Setup your environment as desired</li>
                      <li>Activate your project's Python environment</li>
                      <li>Start conport-aimed MCP server (watch for <code className="bg-gray-200 dark:bg-gray-500 px-1 rounded">context_portal_aimed/</code> folder)</li>
                      <li>Engage with your LLM (ask to launch dashboard or wait for prompt)</li>
                      <li>Initialize Product Context from <code className="bg-gray-200 dark:bg-gray-500 px-1 rounded">projectBrief.md</code> or discuss project goals</li>
                    </ol>
                  </div>
                  <div className="bg-white dark:bg-gray-600 rounded p-3">
                    <div className="font-bold text-gray-900 dark:text-white mb-2">Existing Project Startup</div>
                    <ol className="text-gray-600 dark:text-gray-400 space-y-1 list-decimal list-inside text-xs">
                      <li>Navigate to your project directory</li>
                      <li>Ensure conport-aimed MCP server is running</li>
                      <li>Engage with your LLM</li>
                      <li>LLM will read product context to verify project</li>
                      <li>LLM will ask about reading/updating active context</li>
                    </ol>
                  </div>
                </div>
              </div>

              {/* Daily Workflow */}
              <div className="bg-gray-50 dark:bg-gray-700 rounded-lg p-4">
                <h3 className="text-lg font-bold text-gray-900 dark:text-white mb-3 flex items-center">
                  <span className="mr-2">🔄</span>Daily Workflow Tips
                </h3>
                <div className="space-y-3 text-sm">
                  <div className="bg-white dark:bg-gray-600 rounded p-3">
                    <div className="font-bold text-gray-900 dark:text-white mb-1">Start Each Coding Session with Context</div>
                    <div className="text-gray-600 dark:text-gray-400">
                      Ask your LLM to read active context at the start, then update with today's goals if needed. This prevents context drift.
                    </div>
                  </div>

                  <div className="bg-white dark:bg-gray-600 rounded p-3">
                    <div className="font-bold text-gray-900 dark:text-white mb-1">Log Decisions Immediately</div>
                    <div className="text-gray-600 dark:text-gray-400">
                      When making architectural decisions, ask your AI to log them with full <strong>rationale</strong> and
                      <strong>implementation details</strong>, then link to related patterns.
                    </div>
                  </div>

                  <div className="bg-white dark:bg-gray-600 rounded p-3">
                    <div className="font-bold text-gray-900 dark:text-white mb-1">Keep Progress Updated</div>
                    <div className="text-gray-600 dark:text-gray-400">
                      Keep the Kanban board up to date with todo, in-progress, and complete lists. This helps AI track items when referencing entries.
                    </div>
                  </div>

                  <div className="bg-white dark:bg-gray-600 rounded p-3">
                    <div className="font-bold text-gray-900 dark:text-white mb-1">Link Related Items</div>
                    <div className="text-gray-600 dark:text-gray-400">
                      Remind your AI to link items concisely using only ONE link between any pair of entries (see .roorules section below).
                    </div>
                  </div>
                </div>
              </div>

              {/* Retrieving Multiple Items */}
              <div className="bg-gray-50 dark:bg-gray-700 rounded-lg p-4">
                <h3 className="text-lg font-bold text-gray-900 dark:text-white mb-3 flex items-center">
                  <span className="mr-2">🔗</span>Retrieving Multiple Items by ID
                </h3>
                <div className="bg-white dark:bg-gray-600 rounded p-3">
                  <div className="font-bold text-gray-900 dark:text-white mb-2">Finding Related Information</div>
                  <div className="text-gray-600 dark:text-gray-400 mb-2">
                    When you know entry IDs from the AIMED dashboard, retrieve multiple items at once:
                  </div>
                  <div className="bg-gray-700 dark:bg-gray-800 rounded p-2 text-gray-200 text-xs font-mono mb-2">
                    "Please read decisions 32, 33, progress 62, 23 and custom data 2"
                  </div>
                  <div className="text-gray-500 dark:text-gray-400 text-xs">
                    <strong>Custom Data Note:</strong> Also supports <code className="bg-gray-200 dark:bg-gray-500 px-1 rounded">category:key</code> format:
                    <code className="bg-gray-200 dark:bg-gray-500 px-1 rounded ml-1">"custom data category:UX key:menu"</code>
                  </div>
                </div>
              </div>

              {/* Rules for .roorules */}
              <div className="bg-purple-50 dark:bg-purple-900/20 rounded-lg p-4">
                <h3 className="text-lg font-bold text-gray-900 dark:text-white mb-3 flex items-center">
                  <span className="mr-2">📋</span>Add These to Your .roorules File
                </h3>
                <div className="space-y-2 text-sm">
                  <div className="bg-white dark:bg-gray-600 rounded p-3">
                    <div className="font-bold text-gray-900 dark:text-white mb-2">Copy these rules for better AI behavior:</div>
                    <div className="bg-gray-700 dark:bg-gray-800 rounded p-3 text-gray-200 text-xs font-mono space-y-2">
                      <div># ConPort / AIMED Rules</div>
                      <div></div>
                      <div>Always link ConPort entries in a concise way, using only ONE link between any two entries.</div>
                      <div></div>
                      <div>When user asks for an item and its related information, use get_items_by_references to retrieve linked items efficiently.</div>
                      <div></div>
                      <div>At the start of each session, read active_context before proceeding with user tasks.</div>
                      <div></div>
                      <div>When making architectural decisions, immediately log them with log_decision including rationale and implementation details.</div>
                    </div>
                  </div>
                </div>
              </div>

            </div>
          </section>

          {/* MCP Setup */}
          <section id="mcp-setup" className="bg-white dark:bg-gray-800 rounded-lg shadow p-6">
            <h2 className="text-2xl font-bold text-gray-900 dark:text-white mb-4 flex items-center">
              <span className="text-3xl mr-3">⚙️</span>MCP Setup
            </h2>
            <div className="bg-yellow-50 dark:bg-yellow-900/20 rounded-lg p-4 mb-6">
              <div className="flex items-start">
                <div className="text-2xl mr-3">⚠️</div>
                <div>
                  <h4 className="font-bold text-gray-900 dark:text-white mb-2">Required for AI Assistant Integration</h4>
                  <p className="text-gray-700 dark:text-gray-300 text-sm">
                    Configure your IDE's MCP client to connect ConPort tools to AI assistants.
                  </p>
                </div>
              </div>
            </div>
            
            <div className="space-y-4">
              <div className="bg-gray-50 dark:bg-gray-700 rounded-lg p-4">
                <h3 className="font-bold text-gray-900 dark:text-white mb-2">Configuration Example</h3>
                <pre className="bg-gray-200 dark:bg-gray-600 p-3 rounded text-sm overflow-x-auto"><code>{`{
  "mcpServers": {
    "conport-aimed": {
      "command": "/path/to/.venv/python",
      "args": [
        "/path/to/AIMED/src/context_portal_mcp/main.py",
        "--mode", "stdio",
        "--workspace_id", "\${workspaceFolder}",
        "--log-level", "INFO"
      ],
      "env": {
        "PYTHONPATH": "/path/to/AIMED/src"
      },
      "transportType": "stdio"
    }
  }
}`}</code></pre>
              </div>
              
              <div className="bg-blue-50 dark:bg-blue-900/20 rounded-lg p-4">
                <h3 className="font-bold text-gray-900 dark:text-white mb-2">Setup Tips</h3>
                <div className="text-sm text-gray-700 dark:text-gray-300 space-y-1">
                  <div>• Replace paths with your actual installation paths</div>
                  <div>• Use absolute paths if <code className="bg-gray-200 dark:bg-gray-600 px-1 rounded">{"${workspaceFolder}"}</code> doesn't expand</div>
                  <div>• Omit <code className="bg-gray-200 dark:bg-gray-600 px-1 rounded">--workspace_id</code> for auto-detection</div>
                  <div>• Set <code className="bg-gray-200 dark:bg-gray-600 px-1 rounded">--log-level DEBUG</code> for troubleshooting</div>
                </div>
              </div>
            </div>
          </section>

          {/* Database Updates */}
          <section id="database-updates" className="bg-white dark:bg-gray-800 rounded-lg shadow p-6">
            <h2 className="text-2xl font-bold text-gray-900 dark:text-white mb-4 flex items-center">
              <span className="text-3xl mr-3">🔄</span>Database Updates
            </h2>
            
            <div className="bg-blue-50 dark:bg-blue-900/20 rounded-lg p-4 mb-6">
              <div className="flex items-start">
                <div className="text-2xl mr-3">ℹ️</div>
                <div>
                  <h4 className="font-bold text-gray-900 dark:text-white mb-2">How Database Updates Work</h4>
                  <p className="text-gray-700 dark:text-gray-300 text-sm mb-2">
                    AIMED uses Alembic database migrations to safely update your ConPort database schema.
                  </p>
                  <ul className="text-gray-700 dark:text-gray-300 text-sm space-y-1">
                    <li>• <strong>New Projects:</strong> All migrations apply automatically when first database is created</li>
                    <li>• <strong>Existing Projects:</strong> Updates apply automatically when you restart the MCP server</li>
                    <li>• <strong>Manual Control:</strong> You can apply specific migrations manually if needed</li>
                  </ul>
                </div>
              </div>
            </div>

            <div className="space-y-6">
              <div className="bg-gray-50 dark:bg-gray-700 rounded-lg p-4">
                <h3 className="text-lg font-bold text-gray-900 dark:text-white mb-3">Check Your Database Version</h3>
                <p className="text-sm text-gray-600 dark:text-gray-400 mb-3">
                  Run this Python script to check what version your database is currently on:
                </p>
                <pre className="bg-gray-200 dark:bg-gray-600 p-3 rounded text-sm overflow-x-auto"><code>{`# Create and run this script in your project root
cat > check_db_version.py << 'EOF'
import sqlite3
import os

db_path = "context_portal_aimed/context_aimed.db"
if not os.path.exists(db_path):
    print("Database not found - will be created on first use")
    exit(0)

conn = sqlite3.connect(db_path)
cursor = conn.cursor()
cursor.execute("SELECT version_num FROM alembic_version;")
result = cursor.fetchone()
print("Current database version:", result[0] if result else "No version found")
conn.close()
EOF

python check_db_version.py`}</code></pre>
              </div>

              <div className="bg-gray-50 dark:bg-gray-700 rounded-lg p-4">
                <h3 className="text-lg font-bold text-gray-900 dark:text-white mb-3">Available Database Versions</h3>
                <div className="space-y-2 text-sm">
                  <div className="flex items-center justify-between bg-white dark:bg-gray-600 p-2 rounded">
                    <span><code className="bg-gray-200 dark:bg-gray-500 px-2 py-1 rounded">20250617</code></span>
                    <span className="text-gray-600 dark:text-gray-400">Initial schema with core tables and FTS</span>
                  </div>
                  <div className="flex items-center justify-between bg-white dark:bg-gray-600 p-2 rounded">
                    <span><code className="bg-gray-200 dark:bg-gray-500 px-2 py-1 rounded">20250815</code></span>
                    <span className="text-gray-600 dark:text-gray-400">Added missing FTS tables (progress, patterns, contexts)</span>
                  </div>
                  <div className="flex items-center justify-between bg-green-100 dark:bg-green-900/30 p-2 rounded">
                    <span><code className="bg-gray-200 dark:bg-gray-500 px-2 py-1 rounded">20251009</code></span>
                    <span className="text-gray-600 dark:text-gray-400"><strong>Latest:</strong> Fixed Active Context FTS rowid conflicts</span>
                  </div>
                </div>
              </div>

              <div className="bg-gray-50 dark:bg-gray-700 rounded-lg p-4">
                <h3 className="text-lg font-bold text-gray-900 dark:text-white mb-3">Manual Migration (If Needed)</h3>
                <p className="text-sm text-gray-600 dark:text-gray-400 mb-3">
                  If you need to manually apply a specific migration or update after pulling changes:
                </p>
                <div className="space-y-3">
                  <div>
                    <h4 className="font-bold text-gray-900 dark:text-white text-sm mb-1">Option 1: Automatic Update (Recommended)</h4>
                    <div className="text-sm text-gray-600 dark:text-gray-400 mb-2">
                      Simply restart your MCP server - migrations apply automatically:
                    </div>
                    <pre className="bg-gray-200 dark:bg-gray-600 p-2 rounded text-sm"><code>python context_portal_aimed/portal_launcher.py</code></pre>
                  </div>
                  
                  <div>
                    <h4 className="font-bold text-gray-900 dark:text-white text-sm mb-1">Option 2: Manual Alembic Command</h4>
                    <div className="text-sm text-gray-600 dark:text-gray-400 mb-2">
                      Apply migrations manually from your project root:
                    </div>
                    <pre className="bg-gray-200 dark:bg-gray-600 p-2 rounded text-sm"><code>{`# Navigate to where alembic.ini is located
cd context_portal_aimed

# Upgrade to latest version
python -m alembic upgrade head

# Or upgrade to specific version (e.g., the FTS fix)
python -m alembic upgrade 20251009`}</code></pre>
                  </div>
                </div>
              </div>

              <div className="bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-200 dark:border-yellow-700 rounded-lg p-4">
                <div className="flex items-start">
                  <div className="text-2xl mr-3">⚠️</div>
                  <div>
                    <h4 className="font-bold text-gray-900 dark:text-white mb-2">Important Notes</h4>
                    <ul className="text-sm text-gray-700 dark:text-gray-300 space-y-1">
                      <li>• <strong>Data Safety:</strong> All AIMED migrations are designed to preserve your existing data</li>
                      <li>• <strong>Active Context:</strong> The FTS fix migration (20251009) preserves your Active Context content but may briefly reset FTS indexing</li>
                      <li>• <strong>Backup:</strong> Your database uses WAL mode with automatic backups</li>
                      <li>• <strong>New Projects:</strong> All migrations apply automatically when database is first created</li>
                    </ul>
                  </div>
                </div>
              </div>
            </div>
          </section>

          {/* Troubleshooting */}
          <section id="troubleshooting" className="bg-white dark:bg-gray-800 rounded-lg shadow p-6">
            <h2 className="text-2xl font-bold text-gray-900 dark:text-white mb-4 flex items-center">
              <span className="text-3xl mr-3">🔧</span>Troubleshooting
            </h2>

            <div className="space-y-6">
              <div className="bg-green-50 dark:bg-green-900/20 rounded-lg p-4">
                <h3 className="text-lg font-bold text-gray-900 dark:text-white mb-2 flex items-center">
                  <span className="mr-2">🪲</span>Workspace Info Toggle (Debug Mode)
                </h3>
                <div className="text-sm text-gray-700 dark:text-gray-300 space-y-2">
                  <div><strong>What it does:</strong> Controls console.log output visibility in the browser console</div>
                  <div><strong>Location:</strong> Top navigation bar → Toggle switch labeled "Workspace Info"</div>
                  <div className="mt-3"><strong>Behavior:</strong></div>
                  <div className="ml-4 space-y-1">
                    <div>• <strong>OFF (default):</strong> Shows only critical errors and user action confirmations (saves, deletions)</div>
                    <div>• <strong>ON:</strong> Shows detailed diagnostic logs for debugging workspace detection, API calls, graph rendering</div>
                    <div>• <strong>Dynamic:</strong> Changes take effect immediately - no need to restart</div>
                    <div>• <strong>Workspace-specific:</strong> Each workspace remembers its own debug preference</div>
                  </div>
                  <div className="mt-3 bg-white dark:bg-gray-700 rounded p-2">
                    <strong>Useful for debugging:</strong> Workspace isolation issues, Port detection problems, MCP connection failures, Knowledge graph rendering issues
                  </div>
                </div>
              </div>

              <div className="bg-red-50 dark:bg-red-900/20 rounded-lg p-4">
                <h3 className="text-lg font-bold text-gray-900 dark:text-white mb-2 flex items-center">
                  <span className="mr-2">🚫</span>MCP Server Not Connected
                </h3>
                <div className="text-sm text-gray-700 dark:text-gray-300 space-y-1">
                  <div><strong>Symptoms:</strong> Red status indicator, "MCP Server Error" messages</div>
                  <div><strong>Solutions:</strong></div>
                  <div className="ml-4 space-y-1">
                    <div>• Check Python virtual environment is activated</div>
                    <div>• Verify MCP configuration matches example above</div>
                    <div>• Restart your IDE after config changes</div>
                    <div>• Check logs: <code className="bg-gray-200 dark:bg-gray-600 px-1 rounded">./logs/conport.log</code></div>
                  </div>
                </div>
              </div>

              <div className="bg-yellow-50 dark:bg-yellow-900/20 rounded-lg p-4">
                <h3 className="text-lg font-bold text-gray-900 dark:text-white mb-2 flex items-center">
                  <span className="mr-2">📁</span>Workspace Detection Issues
                </h3>
                <div className="text-sm text-gray-700 dark:text-gray-300 space-y-1">
                  <div><strong>Symptoms:</strong> Wrong project data, "Failed to detect workspace"</div>
                  <div><strong>Solutions:</strong></div>
                  <div className="ml-4 space-y-1">
                    <div>• Enable "Workspace Info" toggle to debug</div>
                    <div>• Use absolute path instead of <code className="bg-gray-200 dark:bg-gray-600 px-1 rounded">{"${workspaceFolder}"}</code></div>
                    <div>• Create <code className="bg-gray-200 dark:bg-gray-600 px-1 rounded">projectBrief.md</code> in project root</div>
                    <div>• Ensure <code className="bg-gray-200 dark:bg-gray-600 px-1 rounded">.git</code> folder exists in project</div>
                  </div>
                </div>
              </div>
              <div className="bg-purple-50 dark:bg-purple-900/20 rounded-lg p-4">
                <h3 className="text-lg font-bold text-gray-900 dark:text-white mb-2 flex items-center">
                  <span className="mr-2">🌐</span>WSL2 Network & CORS Handling
                </h3>
                <div className="text-sm text-gray-700 dark:text-gray-300 space-y-3">
                  <div>
                    <strong>How AIMED Handles WSL2 IP Management:</strong>
                  </div>
                  <div className="ml-4 space-y-2">
                    <div>• <strong>Automatic Detection:</strong> Launcher detects WSL2 environment and gets current IP</div>
                    <div>• <strong>Config Management:</strong> Automatically updates <code className="bg-gray-200 dark:bg-gray-600 px-1 rounded">next.config.ts</code> with current WSL2 IP for CORS</div>
                    <div>• <strong>Multi-Project Safe:</strong> All project launchers share the central UI config - no race conditions</div>
                    <div>• <strong>Self-Correcting:</strong> If WSL restarts with new IP, first launcher automatically updates config</div>
                    <div>• <strong>No Manual Work:</strong> You never need to manually edit next.config.ts</div>
                  </div>
                  <div className="bg-white dark:bg-gray-700 rounded p-3 mt-3">
                    <strong>Why This Matters:</strong>
                    <div className="text-gray-600 dark:text-gray-400 mt-1 space-y-1">
                      <div>• WSL2 IPs change after every WSL restart</div>
                      <div>• Windows host browser needs to access UI via WSL2 IP (not localhost)</div>
                      <div>• Next.js CORS requires explicit origin allowlist for cross-network access</div>
                      <div>• AIMED persists the current IP across all projects in your WSL session</div>
                    </div>
                  </div>
                  <div className="bg-blue-100 dark:bg-blue-900/30 rounded p-3">
                    <strong>Normal vs Linux/Windows:</strong>
                    <div className="text-gray-700 dark:text-gray-300 mt-1">
                      <div>• <strong>WSL2:</strong> Config modified with current IP, persists across launchers, auto-updates on WSL restart</div>
                      <div>• <strong>Linux/Windows:</strong> No modification - localhost works natively, no CORS issues</div>
                    </div>
                  </div>
                </div>
              </div>


              <div className="bg-blue-50 dark:bg-blue-900/20 rounded-lg p-4">
                <h3 className="text-lg font-bold text-gray-900 dark:text-white mb-2 flex items-center">
                  <span className="mr-2">🆘</span>Getting Help
                </h3>
                <div className="grid md:grid-cols-3 gap-4 text-sm">
                  <div>
                    <div className="font-bold text-gray-900 dark:text-white">GitHub Issues</div>
                    <div className="text-gray-600 dark:text-gray-400">Report bugs & request features</div>
                    <a href="https://github.com/drew1two/AIMED/issues" className="text-blue-600 dark:text-blue-400">Open Issue →</a>
                  </div>
                  <div>
                    <div className="font-bold text-gray-900 dark:text-white">Discussions</div>
                    <div className="text-gray-600 dark:text-gray-400">Community Q&A</div>
                    <a href="https://github.com/drew1two/AIMED/discussions" className="text-blue-600 dark:text-blue-400">Join Discussion →</a>
                  </div>
                  <div>
                    <div className="font-bold text-gray-900 dark:text-white">Debug Logs</div>
                    <div className="text-gray-600 dark:text-gray-400">Enable detailed logging</div>
                    <code className="text-xs bg-gray-200 dark:bg-gray-600 px-1 py-0.5 rounded">--log-level DEBUG</code>
                  </div>
                </div>
              </div>
            </div>
          </section>

          {/* Launch Instructions */}
          <section className="bg-green-50 dark:bg-green-900/20 rounded-lg p-6">
            <h3 className="text-lg font-bold text-gray-900 dark:text-white mb-3 flex items-center">
              <span className="mr-2">🚀</span>How to Launch AIMED
            </h3>
            <div className="space-y-3">
              <div>
                <h4 className="font-bold text-gray-900 dark:text-white text-sm mb-1">1. Install Dependencies</h4>
                <pre className="bg-gray-200 dark:bg-gray-600 p-2 rounded text-sm"><code>uv pip install -r requirements.txt && cd ui && npm install</code></pre>
              </div>
              <div>
                <h4 className="font-bold text-gray-900 dark:text-white text-sm mb-1">2. Start Both Servers</h4>
                <pre className="bg-gray-200 dark:bg-gray-600 p-2 rounded text-sm"><code>python context_portal_aimed/portal_launcher.py</code></pre>
              </div>
              <div>
                <h4 className="font-bold text-gray-900 dark:text-white text-sm mb-1">3. Access Dashboard</h4>
                <div className="text-sm text-gray-700 dark:text-gray-300">Opens automatically at <a href="http://localhost:3000" className="text-blue-600 dark:text-blue-400">http://localhost:3000</a></div>
              </div>
            </div>
          </section>
        </div>
      </div>
    </div>
  );
}