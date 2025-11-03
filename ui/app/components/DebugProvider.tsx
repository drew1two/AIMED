"use client";

import { useState, useEffect } from "react";
import { getConportClient, WorkspaceManager } from "../../shared/conport/client";
import WorkspaceIsolationDebugInfo from "./workspace_isolation_debug_info";

export function DebugProvider() {
  const [showDebugInfo, setShowDebugInfo] = useState(false);

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

  // Listen for debug toggle events from Navigation
  useEffect(() => {
    const handleDebugToggle = (event: CustomEvent) => {
      setShowDebugInfo(event.detail);
    };

    window.addEventListener('debugInfoToggle', handleDebugToggle as EventListener);
    return () => {
      window.removeEventListener('debugInfoToggle', handleDebugToggle as EventListener);
    };
  }, []);

  return (
    <>
      {showDebugInfo && <WorkspaceIsolationDebugInfo />}
    </>
  );
}