import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const FUNCTION_NAME = "health-check";
const FUNCTION_VERSION = "2025-10-24-v1";
const BUILD_TIME = new Date().toISOString();

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

console.log(`[${FUNCTION_NAME}] v${FUNCTION_VERSION} built at ${BUILD_TIME}`);

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  // GET request returns version info
  if (req.method === 'GET') {
    return new Response(
      JSON.stringify({
        name: FUNCTION_NAME,
        version: FUNCTION_VERSION,
        buildTime: BUILD_TIME,
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
  
  try {
    const res = { 
      ok: true, 
      time: new Date().toISOString(),
      version: {
        name: FUNCTION_NAME,
        version: FUNCTION_VERSION,
        buildTime: BUILD_TIME,
      },
    };
    console.log("health-check invoked", res);
    return new Response(JSON.stringify(res), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (e) {
    console.error("health-check error", e);
    return new Response(JSON.stringify({ error: String(e) }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
