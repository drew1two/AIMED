import { NextRequest, NextResponse } from 'next/server';
import { promises as fs, readFileSync } from 'fs';
import path from 'path';

async function getWorkspaceFromEnvVars(request: NextRequest): Promise<string | null> {
  try {
    // Get actual UI port from request URL (each project has different port: 3001, 3002, etc.)
    const requestUrl = new URL(request.url);
    const requestPort = parseInt(requestUrl.port);//<-cannot do a default 3000, that could contaminate the isolation required    
    // Read central port-to-workspace mapping from AIMED installation
    const centralMappingFile = path.resolve(process.cwd(), '..', 'context_portal_aimed', 'ui-cache', 'port_workspace_mapping.json');
    const mapping = JSON.parse(readFileSync(centralMappingFile, 'utf-8'));
    const workspaceId = mapping[requestPort.toString()];
    
    if (!workspaceId) {
      console.warn(`No workspace mapping found for UI port ${requestPort}`);
      return null;
    }
    
    // Read actual workspace_id from user's project env_vars.json
    const envVarsFile = path.resolve(workspaceId, 'context_portal_aimed', 'ui-cache', 'env_vars.json');
    const envVarsData = JSON.parse(readFileSync(envVarsFile, 'utf-8'));
    
    return envVarsData?.data?.workspace_id || workspaceId;
  } catch (error) {
    console.error('Failed to get workspace from env_vars:', error);
    return null;
  }
}

export async function GET(request: NextRequest) {
  try {
    // Get the actual user's project workspace root from env_vars.json using request port
    const workspaceRoot = await getWorkspaceFromEnvVars(request);
    
    if (!workspaceRoot) {
      return NextResponse.json({
        files: [],
        exportPath: 'conport_markdown_export',
        error: 'Could not detect workspace. Please ensure the MCP server is running.'
      });
    }
    
    // Export path in user's project folder
    const exportPath = path.join(workspaceRoot, 'conport_markdown_export');
    
    // Check if export directory exists
    try {
      await fs.access(exportPath);
    } catch {
      return NextResponse.json({
        files: [],
        exportPath: 'conport_markdown_export',
        message: 'Export directory not found. Click "Export from ConPort" to create it.'
      });
    }
    
    // Read all markdown files recursively
    const files: Array<{ name: string; path: string; category?: string }> = [];
    
    async function scanDirectory(dir: string, category?: string) {
      const entries = await fs.readdir(dir, { withFileTypes: true });
      
      for (const entry of entries) {
        const fullPath = path.join(dir, entry.name);
        const relativePath = path.relative(exportPath, fullPath);
        
        if (entry.isDirectory()) {
          // Recursively scan subdirectories (like custom_data/)
          await scanDirectory(fullPath, entry.name);
        } else if (entry.isFile() && entry.name.endsWith('.md')) {
          files.push({
            name: entry.name.replace('.md', ''),
            path: relativePath,
            category: category || 'Core'
          });
        }
      }
    }
    
    await scanDirectory(exportPath);
    
    // Sort files: Core files first, then by category and name
    files.sort((a, b) => {
      if (a.category === 'Core' && b.category !== 'Core') return -1;
      if (a.category !== 'Core' && b.category === 'Core') return 1;
      if (a.category !== b.category) return (a.category || '').localeCompare(b.category || '');
      return a.name.localeCompare(b.name);
    });
    
    return NextResponse.json({
      files,
      exportPath: 'conport_markdown_export'
    });
  } catch (error: any) {
    console.error('Error listing markdown files:', error);
    return NextResponse.json(
      { error: error.message || 'Failed to list markdown files' },
      { status: 500 }
    );
  }
}