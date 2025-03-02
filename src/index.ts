import { M3u8ProxyV1 } from "./logic/v1";
import { M3u8ProxyV2 } from "./logic/v2";

addEventListener("fetch", (event) => {
  event.respondWith(handleRequest(event.request));
});

async function handleRequest(request: Request): Promise<Response> {
  try {
    const url = new URL(request.url);
    const pathname = url.pathname;

    // Handle CORS preflight requests
    if (request.method === "OPTIONS") {
      return new Response(null, {
        status: 204,
        headers: getCorsHeaders(),
      });
    }

    let response: Response;

    switch (pathname) {
      case "/":
        response = await M3u8ProxyV1(request);
        break;
      case "/v2":
        response = await M3u8ProxyV2(request);
        break;
      default:
        response = new Response("Not Found", { status: 404 });
    }

    // Add CORS headers to all responses
    return new Response(response.body, {
      status: response.status,
      headers: { ...Object.fromEntries(response.headers), ...getCorsHeaders() },
    });
  } catch (error) {
    return new Response("Internal Server Error", { status: 500, headers: getCorsHeaders() });
  }
}

function getCorsHeaders() {
  return {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type, Authorization",
  };
}
