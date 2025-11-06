"use client";

import { useState, useEffect } from 'react';
import { getConportClient } from '@/shared/conport/client';

export default function WorkspaceIsolationDebugInfo() {
  const [debugInfo, setDebugInfo] = useState<any>({});
  const [isVisible, setIsVisible] = useState(false);

  useEffect(() => {
    // Enable debug logging
    if (typeof window !== 'undefined') {
      localStorage.setItem('conport_debug', 'true');
    }

    const updateDebugInfo = () => {
      const client = getConportClient();
      const sessionWorkspace = sessionStorage.getItem('conport_workspace_id');
      
      setDebugInfo({
        currentWorkspaceId: (client as any).workspaceId,
        currentBaseURL: (client as any).baseURL,
        sessionStorageWorkspace: sessionWorkspace,
        hostname: window.location.hostname,
        pathname: window.location.pathname,
        port: window.location.port,
        timestamp: new Date().toISOString()
      });
    };

    // Update immediately
    updateDebugInfo();

    // Update on navigation changes
    const handleVisibilityChange = () => {
      if (!document.hidden) {
        setTimeout(updateDebugInfo, 100);
      }
    };

    // Update on focus/refresh
    window.addEventListener('focus', updateDebugInfo);
    document.addEventListener('visibilitychange', handleVisibilityChange);

    // Also track fetch requests
    const originalFetch = window.fetch;
    window.fetch = async (...args) => {
      const [url, options] = args;
      const currentClient = getConportClient();
      console.log('[DEBUG] Fetch request:', {
        url,
        body: options?.body ? JSON.parse(options.body as string) : null,
        headers: options?.headers,
        timestamp: new Date().toISOString(),
        currentWorkspace: (currentClient as any).workspaceId,
        currentBaseURL: (currentClient as any).baseURL
      });
      
      const response = await originalFetch(...args);
      const responseClone = response.clone();
      
      try {
        const responseData = await responseClone.json();
        console.log('[DEBUG] Fetch response:', {
          url,
          status: response.status,
          data: responseData,
          timestamp: new Date().toISOString()
        });
      } catch (e) {
        console.log('[DEBUG] Fetch response (non-JSON):', {
          url,
          status: response.status,
          timestamp: new Date().toISOString()
        });
      }
      
      return response;
    };

    return () => {
      window.removeEventListener('focus', updateDebugInfo);
      document.removeEventListener('visibilitychange', handleVisibilityChange);
      window.fetch = originalFetch;
    };
  }, []);

  return (
    <div 
      style={{
        position: 'fixed',
        top: 0,
        right: 0,
        background: 'rgba(0,0,0,0.8)',
        color: 'white',
        padding: '8px',
        fontSize: '11px',
        fontFamily: 'monospace',
        zIndex: 9999,
        maxWidth: '400px',
        borderLeft: '3px solid #ff6b6b'
      }}
    >
      <div 
        style={{ cursor: 'pointer', fontWeight: 'bold' }}
        onClick={() => setIsVisible(!isVisible)}
      >
        🐛 Workspace Info {isVisible ? '▼' : '▶'}
      </div>
      
      {isVisible && (
        <div style={{ marginTop: '4px', fontSize: '10px' }}>
          <div><strong>Workspace ID:</strong> {debugInfo.currentWorkspaceId || 'NONE'}</div>
          <div><strong>MCP Server:</strong> {debugInfo.currentBaseURL || 'NONE'}</div>
          <div><strong>Session Storage:</strong> {debugInfo.sessionStorageWorkspace || 'NONE'}</div>
          <div><strong>Location:</strong> {debugInfo.hostname}:{debugInfo.port}{debugInfo.pathname}</div>
          <div><strong>Updated:</strong> {debugInfo.timestamp}</div>
          <div style={{ marginTop: '4px' }}>
            <button 
              onClick={() => {
                sessionStorage.clear();
                window.location.reload();
              }}
              style={{ fontSize: '10px', padding: '2px 4px' }}
            >
              Clear Session & Reload
            </button>
          </div>
        </div>
      )}
    </div>
  );
}