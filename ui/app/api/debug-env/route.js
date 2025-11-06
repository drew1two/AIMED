// Debug API endpoint to check server-side environment variables
export async function GET(request) {
  const envVars = {
    NEXT_PUBLIC_CONPORT_SERVER_URL: process.env.NEXT_PUBLIC_CONPORT_SERVER_URL,
    NEXT_PUBLIC_DEFAULT_WORKSPACE_ID: process.env.NEXT_PUBLIC_DEFAULT_WORKSPACE_ID,
    NODE_ENV: process.env.NODE_ENV,
    HOST: process.env.HOST,
    PORT: process.env.PORT,
    all_next_public: Object.keys(process.env)
      .filter(key => key.startsWith('NEXT_PUBLIC_'))
      .reduce((obj, key) => {
        obj[key] = process.env[key];
        return obj;
      }, {})
  };
  
  return Response.json(envVars);
}