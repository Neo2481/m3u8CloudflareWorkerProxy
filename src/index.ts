import { M3u8ProxyV1 } from "./logic/v1";
import { M3u8ProxyV2 } from "./logic/v2";

addEventListener("fetch", (event) => {
  event.respondWith(handleRequest(event.request));
});

async function handleRequest(request: Request): Promise<Response> {
  const url = new URL(request.url);

  // Handle CORS preflight requests
  if (request.method === "OPTIONS") {
    return handleCors();
  }

  try {
    let response: Response;

    switch (url.pathname) {
      case "/":
        response = await M3u8ProxyV1(request);
        break;
      case "/v2":
        response = await M3u8ProxyV2(request);
        break;
      default:
        return new Response("Not Found", { status: 404, headers: getCorsHeaders() });
    }

    // Clone response to avoid body consumption issues
    response = new Response(response.clone().body, {
      status: response.status,
      headers: {
        ...Object.fromEntries(response.headers),
        ...getCorsHeaders(),
        "Cache-Control": "public, max-age=3600, stale-while-revalidate=60, must-revalidate", // 1 hour caching
      },
    });

    return response;
  } catch (error) {
    console.error(`Error: ${error}`);
    return new Response("Internal Server Error", {
      status: 500,
      headers: getCorsHeaders(),
    });
  }
}

function handleCors(): Response {
  return new Response(null, {
    status: 204,
    headers: getCorsHeaders(),
  });
}

function getCorsHeaders(): Record<string, string> {
  return {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type, Authorization",
  };
}
