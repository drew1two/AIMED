"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState, useRef, useEffect } from "react";
import { getConportClient, WorkspaceManager, userLog, userWarn } from "../../shared/conport/client";

export function Navigation() {
  const pathname = usePathname();
  const [openDropdown, setOpenDropdown] = useState<string | null>(null);
  const dropdownRefs = useRef<{ [key: string]: HTMLDivElement | null }>({});
  const [showDebugInfo, setShowDebugInfo] = useState(false);

  // Close dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (openDropdown && dropdownRefs.current[openDropdown] &&
          !dropdownRefs.current[openDropdown]?.contains(event.target as Node)) {
        setOpenDropdown(null);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [openDropdown]);

  // Load debug preference on mount
  useEffect(() => {
    const loadDebugPreference = async () => {
      try {
        const client = getConportClient();
        const workspaceId = encodeURIComponent(await WorkspaceManager.getDetected());
        const serverUrl = (await client.getServerUrl()).endsWith('/')
          ? (await client.getServerUrl()).slice(0, -1)
          : (await client.getServerUrl());
        
        const targetUrl = `${serverUrl}/api/ui-cache/preference?workspace_id=${workspaceId}&preference_key=show_workspace_debug`;
        const response = await fetch(targetUrl);
        const result = await response.json();
        
        if (result.success && result.value && result.value.data) {
          setShowDebugInfo(result.value.data === true);
        }
      } catch (error) {
        console.warn('Failed to load debug preference:', error);
      }
    };
    
    loadDebugPreference();
  }, []);

  // Save debug preference when changed
  const handleToggleDebugInfo = async (enabled: boolean) => {
    setShowDebugInfo(enabled);
    
    try {
      const client = getConportClient();
      const workspaceId = encodeURIComponent(await WorkspaceManager.getDetected());
      const serverUrl = (await client.getServerUrl()).endsWith('/')
        ? (await client.getServerUrl()).slice(0, -1)
        : (await client.getServerUrl());
      
      const targetUrl = `${serverUrl}/api/ui-cache/preference?workspace_id=${workspaceId}&preference_key=show_workspace_debug`;
      const response = await fetch(targetUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          updated_at: new Date().toISOString(),
          data: enabled
        })
      });
      
      const result = await response.json();
      if (result.success) {
        userLog(`[Navigation] Saved debug preference: ${enabled}`);
        // Trigger a custom event to notify the layout
        window.dispatchEvent(new CustomEvent('debugInfoToggle', { detail: enabled }));
      } else {
        userWarn(`[Navigation] Failed to save debug preference:`, result.error);
      }
    } catch (error) {
      console.warn('Failed to save debug preference:', error);
    }
  };

  const navStructure = [
    {
      id: "dashboard",
      label: "Dashboard",
      icon: "📊",
      href: "/",
      type: "link"
    },
    {
      id: "context",
      label: "Context",
      icon: "🕒",
      type: "dropdown",
      items: [
        { href: "/context/product", label: "Product Context", icon: "🎯" },
        { href: "/context/active", label: "Active Context", icon: "⚡" }
      ]
    },
    {
      id: "create-track",
      label: "Create & Track",
      icon: "⚡",
      type: "dropdown",
      items: [
        { href: "/decisions", label: "Decisions", icon: "⚡" },
        { href: "/progress", label: "Progress", icon: "✅" },
        { href: "/patterns", label: "Patterns", icon: "🏗️" },
        { href: "/custom", label: "Custom Data", icon: "📦" },
        // { href: "/links", label: "Links", icon: "🔗" }  // TODO: Work in progress - temporarily commented out
      ]
    },
    {
      id: "graph",
      label: "Knowledge Graph",
      icon: "🕸️",
      href: "/graph",
      type: "link"
    },
    {
      id: "search",
      label: "Search",
      icon: "🔍",
      href: "/search",
      type: "link"
    },
    {
      id: "docs",
      label: "Docs",
      icon: "📚",
      type: "dropdown",
      items: [
        { href: "/docs/application", label: "Application Docs", icon: "📘" },
        { href: "/docs/project", label: "Project Docs", icon: "📝" }
      ]
    }
  ];

  const isItemActive = (item: any) => {
    if (item.type === "link") {
      return pathname === item.href;
    }
    // For dropdowns, check if any child item is active
    return item.items?.some((subItem: any) => pathname === subItem.href);
  };

  const toggleDropdown = (dropdownId: string) => {
    setOpenDropdown(openDropdown === dropdownId ? null : dropdownId);
  };

  return (
    <nav className="bg-white dark:bg-gray-800 shadow-sm border-b border-gray-200 dark:border-gray-700">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex justify-between h-16">
          <div className="flex">
            <Link href="/about" className="flex-shrink-0 flex items-center hover:opacity-80 transition-opacity">
              <img
                src="/AIMED-scope-logo.svg"
                alt="AIMED Scope Logo"
                className="h-8 w-8 mr-3"
              />
              <h1 className="text-xl font-bold text-gray-900 dark:text-white">
                AIMED
              </h1>
            </Link>
            <div className="hidden sm:ml-6 sm:flex sm:space-x-8">
              {navStructure.map((item) => {
                if (item.type === "link") {
                  const isActive = isItemActive(item);
                  return (
                    <Link
                      key={item.id}
                      href={item.href!}
                      className={`inline-flex items-center px-1 pt-1 pb-1 border-b-2 text-sm font-medium cursor-pointer h-16 ${
                        isActive
                          ? "border-blue-500 text-gray-900 dark:text-white"
                          : "border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300 dark:text-gray-400 dark:hover:text-gray-300"
                      }`}
                    >
                      <span className="mr-2">{item.icon}</span>
                      {item.label}
                    </Link>
                  );
                }

                // Dropdown menu
                const isActive = isItemActive(item);
                return (
                  <div
                    key={item.id}
                    className="relative"
                    ref={(el) => { dropdownRefs.current[item.id] = el; }}
                  >
                    <button
                      onClick={() => toggleDropdown(item.id)}
                      className={`inline-flex items-center px-1 pt-1 pb-1 border-b-2 text-sm font-medium cursor-pointer h-16 ${
                        isActive || openDropdown === item.id
                          ? "border-blue-500 text-gray-900 dark:text-white"
                          : "border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300 dark:text-gray-400 dark:hover:text-gray-300"
                      }`}
                    >
                      <span className="mr-2">{item.icon}</span>
                      {item.label}
                      <svg
                        className={`ml-1 h-3 w-3 transition-transform ${
                          openDropdown === item.id ? 'rotate-180' : ''
                        }`}
                        fill="none"
                        viewBox="0 0 24 24"
                        stroke="currentColor"
                      >
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                      </svg>
                    </button>

                    {openDropdown === item.id && (
                      <div className="absolute z-50 top-full left-0 mt-0 w-48 bg-white dark:bg-gray-800 rounded-md shadow-lg ring-1 ring-black ring-opacity-5">
                        <div className="py-1">
                          {item.items?.map((subItem) => {
                            const isSubActive = pathname === subItem.href;
                            return (
                              <Link
                                key={subItem.href}
                                href={subItem.href}
                                className={`flex items-center px-4 py-2 text-sm cursor-pointer ${
                                  isSubActive
                                    ? "bg-blue-50 dark:bg-blue-900 text-blue-700 dark:text-blue-200"
                                    : "text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700"
                                }`}
                                onClick={() => setOpenDropdown(null)}
                              >
                                <span className="mr-2">{subItem.icon}</span>
                                {subItem.label}
                              </Link>
                            );
                          })}
                        </div>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
          
          <div className="flex items-center">
            <div className="flex items-center space-x-4 text-sm text-gray-500 dark:text-gray-400">
              <div className="flex items-center space-x-2">
                <div className="w-2 h-2 bg-green-500 rounded-full"></div>
                <span>MCP Connected</span>
              </div>
              
              {/* Debug Info Toggle */}
              <div className="flex items-center space-x-2">
                <label className="inline-flex items-center cursor-pointer">
                  <input
                    type="checkbox"
                    checked={showDebugInfo}
                    onChange={(e) => handleToggleDebugInfo(e.target.checked)}
                    className="sr-only peer"
                  />
                  <div className="relative w-9 h-5 bg-gray-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-blue-300 dark:peer-focus:ring-blue-800 rounded-full peer dark:bg-gray-700 peer-checked:after:translate-x-full rtl:peer-checked:after:-translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:start-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-4 after:w-4 after:transition-all dark:border-gray-600 peer-checked:bg-blue-600"></div>
                  <span className="ms-2 text-xs font-medium text-gray-900 dark:text-gray-300">Workspace Info</span>
                </label>
              </div>
            </div>
          </div>
        </div>
      </div>
      
      {/* Mobile menu - simplified for now, can be enhanced later */}
      <div className="sm:hidden">
        <div className="pt-2 pb-3 space-y-1">
          {navStructure.flatMap((item) => {
            if (item.type === "link") {
              const isActive = pathname === item.href;
              return [
                <Link
                  key={item.id}
                  href={item.href!}
                  className={`block pl-3 pr-4 py-2 border-l-4 text-base font-medium cursor-pointer ${
                    isActive
                      ? "border-blue-500 text-blue-700 bg-blue-50 dark:bg-blue-900 dark:text-blue-200"
                      : "border-transparent text-gray-500 hover:text-gray-700 hover:bg-gray-50 dark:text-gray-400 dark:hover:bg-gray-700"
                  }`}
                >
                  <span className="mr-2">{item.icon}</span>
                  {item.label}
                </Link>
              ];
            }
            
            // For mobile, flatten dropdown items
            return item.items?.map((subItem) => {
              const isActive = pathname === subItem.href;
              return (
                <Link
                  key={subItem.href}
                  href={subItem.href}
                  className={`block pl-6 pr-4 py-2 border-l-4 text-base font-medium cursor-pointer ${
                    isActive
                      ? "border-blue-500 text-blue-700 bg-blue-50 dark:bg-blue-900 dark:text-blue-200"
                      : "border-transparent text-gray-500 hover:text-gray-700 hover:bg-gray-50 dark:text-gray-400 dark:hover:bg-gray-700"
                  }`}
                >
                  <span className="mr-2">{subItem.icon}</span>
                  {subItem.label}
                </Link>
              );
            }) || [];
          })}
        </div>
      </div>
    </nav>
  );
}