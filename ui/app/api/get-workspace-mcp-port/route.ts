import { NextRequest, NextResponse } from 'next/server';
import { readFileSync } from 'fs';
import { resolve } from 'path';

export async function POST(request: NextRequest) {
  let debugEnabled = false; // Will be set once we read env_vars.json
  
  try {
    // Helper function to log only if debug is enabled (defined inside try for access to debugEnabled)
    const debugLog = (message: string, level: string = 'INFO') => {
      if (debugEnabled) {
        console.log(`[get-workspace-mcp-port:${level}] ${message}`);
      }
    };
    const { workspaceId } = await request.json();
    
    // FIXED: Handle bootstrap case where workspaceId is empty (for workspace detection)
    let effectiveWorkspaceId = workspaceId;
    
    if (!workspaceId || typeof workspaceId !== 'string' || workspaceId === '') {
      // Bootstrap case: use process.cwd() since each launcher runs from its workspace
      try {
        const requestUrl = new URL(request.url);
        const requestPort = parseInt(requestUrl.port) || 3000;
        
        // Can't check debug mode yet since we don't have workspace_id
        // console.log(`Bootstrap workspace detection for UI port: ${requestPort}`);
        
        // FIXED: Use central port-to-workspace mapping (simple and efficient)
        try {
          const fs = require('fs');
          const centralMappingFile = resolve(process.cwd(), '..', 'context_portal_aimed', 'ui-cache', 'port_workspace_mapping.json');
          
          if (fs.existsSync(centralMappingFile)) {
            const mapping = JSON.parse(fs.readFileSync(centralMappingFile, 'utf-8'));
            effectiveWorkspaceId = mapping[requestPort.toString()];
            
            if (effectiveWorkspaceId) {
              // Try to read debug flag early if we have workspace
              try {
                const envVarsFile = resolve(effectiveWorkspaceId, 'context_portal_aimed', 'ui-cache', 'env_vars.json');
                const envVarsData = JSON.parse(readFileSync(envVarsFile, 'utf-8'));
                debugEnabled = envVarsData?.data?.debug_enabled === true;
              } catch {
                debugEnabled = false;
              }
              
              debugLog(`Found workspace ${effectiveWorkspaceId} for UI port ${requestPort} via central mapping`, 'INFO');
            } else {
              debugLog(`No workspace mapping found for UI port ${requestPort}`, 'WARN');
            }
          } else {
            debugLog(`Central port mapping file not found: ${centralMappingFile}`, 'WARN');
          }
        } catch (error) {
          debugLog(`Failed to read central port mapping: ${error}`, 'WARN');
        }
        
        if (!effectiveWorkspaceId) {
          debugLog(`No workspace found for UI port ${requestPort}`, 'ERROR');
          return NextResponse.json(
            { error: 'No workspace found for UI port' },
            { status: 400 }
          );
        }
        
        // Verify env_vars.json exists and read actual workspace_id from it
        try {
          const envVarsFile = resolve(effectiveWorkspaceId, 'context_portal_aimed', 'ui-cache', 'env_vars.json');
          const envVarsData = JSON.parse(readFileSync(envVarsFile, 'utf-8'));
          const envVars = envVarsData?.data;
          
          // Use authoritative workspace_id from env_vars.json
          if (envVars?.workspace_id) {
            effectiveWorkspaceId = envVars.workspace_id;
            debugLog(`Detected workspace ${effectiveWorkspaceId} for UI port ${requestPort}`, 'INFO');
          }
        } catch (error) {
          debugLog(`Could not read env_vars.json from ${effectiveWorkspaceId}: ${error}`, 'WARN');
          // Keep using process.cwd() as fallback
        }
        
        if (!effectiveWorkspaceId) {
          return NextResponse.json(
            { error: 'No workspace detected and no workspace_id provided' },
            { status: 400 }
          );
        }
      } catch (error) {
        debugLog(`Error during bootstrap workspace detection: ${error}`, 'ERROR');
        return NextResponse.json(
          { error: 'Failed to detect workspace' },
          { status: 500 }
        );
      }
    }
    
    // Try to read consolidated environment variables from UI cache
    try {
      const contextPortalPath = resolve(effectiveWorkspaceId, 'context_portal_aimed');
      const uiCachePath = resolve(contextPortalPath, 'ui-cache');
      const envVarsFile = resolve(uiCachePath, 'env_vars.json');
      
      const envVarsData = JSON.parse(readFileSync(envVarsFile, 'utf-8'));
      const envVars = envVarsData?.data;
      
      if (envVars && typeof envVars === 'object') {
        // Validate critical fields
        const port = envVars.mcp_server_port || envVars.port;
        const workspace_id = envVars.workspace_id || effectiveWorkspaceId;
        
        return NextResponse.json({
          // Backward compatibility
          port: port || 8020,
          workspace_id,
          source: 'consolidated_ui_cache',
          
          // Full consolidated environment variables
          env_vars: {
            workspace_id,
            mcp_server_port: port || 8020,
            ui_port: envVars.ui_port || 3000,
            conport_server_url: envVars.conport_server_url || `http://localhost:${port || 8020}/mcp/`,
            wsl2_ip: envVars.wsl2_ip,
            wsl2_gateway_ip: envVars.wsl2_gateway_ip
          }
        });
      }
    } catch (error) {
      debugLog(`No consolidated env_vars.json found for workspace: ${effectiveWorkspaceId} ${error}`, 'ERROR');
      // NO LEGACY FALLBACKS - env_vars.json is required
    }
    
    // Return defaults if no cache found
    return NextResponse.json({
      // Backward compatibility
      port: 8020,
      workspace_id: effectiveWorkspaceId,
      source: 'default',
      
      // Default environment variables
      env_vars: {
        workspace_id: effectiveWorkspaceId,
        mcp_server_port: 8020,
        ui_port: 3000,
        conport_server_url: 'http://localhost:8020/mcp/',
        wsl2_ip: null,
        wsl2_gateway_ip: null
      }
    });
    
  } catch (error) {
    console.error(`Error in get-workspace-mcp-port API: ${error}`);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}