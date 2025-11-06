// Debug endpoint to test if the client can reach the MCP server
export async function GET(request) {
  const serverUrl = process.env.NEXT_PUBLIC_CONPORT_SERVER_URL;
  
  if (!serverUrl) {
    return Response.json({ error: "NEXT_PUBLIC_CONPORT_SERVER_URL not set" }, { status: 500 });
  }

  try {
    // Test if the server-side can connect to MCP server
    const response = await fetch(serverUrl.replace('/mcp/', '/health'), {
      method: 'GET',
      timeout: 5000
    });
    
    const result = await response.text();
    
    return Response.json({
      success: true,
      server_url: serverUrl,
      health_check: {
        status: response.status,
        body: result,
        reachable: response.ok
      }
    });
  } catch (error) {
    return Response.json({
      success: false,
      server_url: serverUrl,
      error: error.message
    });
  }
}