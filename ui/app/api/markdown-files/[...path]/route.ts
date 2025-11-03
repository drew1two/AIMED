import { NextRequest, NextResponse } from 'next/server';
import { promises as fs, readFileSync } from 'fs';
import path from 'path';

async function getWorkspaceFromEnvVars(request: NextRequest): Promise<string | null> {
  try {
    // Get actual UI port from request URL (each project has different port: 3001, 3002, etc.)
    const requestUrl = new URL(request.url);
    const requestPort = parseInt(requestUrl.port); // No default to prevent workspace isolation contamination
    
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

export async function GET(
  request: NextRequest,
  { params }: { params: { path: string[] } }
) {
  try {
    const workspaceRoot = await getWorkspaceFromEnvVars(request);
    
    if (!workspaceRoot) {
      return NextResponse.json(
        { error: 'Could not detect workspace' },
        { status: 400 }
      );
    }
    
    const exportPath = path.join(workspaceRoot, 'conport_markdown_export');
    
    // Reconstruct the file path from the URL segments
    const filePath = decodeURIComponent(params.path.join('/'));
    const fullPath = path.join(exportPath, filePath);
    
    // Security: Ensure the file is within the export directory
    const normalizedPath = path.normalize(fullPath);
    if (!normalizedPath.startsWith(path.normalize(exportPath))) {
      return NextResponse.json(
        { error: 'Invalid file path' },
        { status: 403 }
      );
    }
    
    // Read the file content
    const content = await fs.readFile(fullPath, 'utf-8');
    
    return NextResponse.json({ content });
  } catch (error: any) {
    console.error('Error reading markdown file:', error);
    return NextResponse.json(
      { error: error.message || 'Failed to read file' },
      { status: 500 }
    );
  }
}

export async function PUT(
  request: NextRequest,
  { params }: { params: { path: string[] } }
) {
  try {
    const workspaceRoot = await getWorkspaceFromEnvVars(request);
    
    if (!workspaceRoot) {
      return NextResponse.json(
        { error: 'Could not detect workspace' },
        { status: 400 }
      );
    }
    
    const exportPath = path.join(workspaceRoot, 'conport_markdown_export');
    
    // Reconstruct the file path from the URL segments
    const filePath = decodeURIComponent(params.path.join('/'));
    const fullPath = path.join(exportPath, filePath);
    
    // Security: Ensure the file is within the export directory
    const normalizedPath = path.normalize(fullPath);
    if (!normalizedPath.startsWith(path.normalize(exportPath))) {
      return NextResponse.json(
        { error: 'Invalid file path' },
        { status: 403 }
      );
    }
    
    // Get the content from request body
    const { content } = await request.json();
    
    if (typeof content !== 'string') {
      return NextResponse.json(
        { error: 'Content must be a string' },
        { status: 400 }
      );
    }
    
    // Write the file content
    await fs.writeFile(fullPath, content, 'utf-8');
    
    return NextResponse.json({ 
      success: true,
      message: 'File saved successfully'
    });
  } catch (error: any) {
    console.error('Error writing markdown file:', error);
    return NextResponse.json(
      { error: error.message || 'Failed to write file' },
      { status: 500 }
    );
  }
}