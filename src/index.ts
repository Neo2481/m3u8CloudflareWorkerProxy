import { M3u8ProxyV1 } from "./logic/v1";
import { M3u8ProxyV2 } from "./logic/v2";

addEventListener("fetch", (event) => {
  event.respondWith(handleRequest(event.request));
});

async function handleRequest(request: Request) {
  const url = new URL(request.url);
  const pathname = url.pathname;

  // Handle CORS preflight requests
  if (request.method === "OPTIONS") {
    return new Response(null, {
      status: 204, // No Content
      headers: {
        "Access-Control-Allow-Origin": "*",
        "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
        "Access-Control-Allow-Headers": "Content-Type, Authorization",
      },
    });
  }

  let response: Response;

  // Route requests
  if (pathname === "/") {
    response = await M3u8ProxyV1(request);
  } else if (pathname === "/v2") {
    response = await M3u8ProxyV2(request);
  } else {
    response = new Response("Not Found", { status: 404 });
  }

  // Add CORS headers to all responses
  response = new Response(response.body, {
    status: response.status,
    headers: {
      ...Object.fromEntries(response.headers),
      "Access-Control-Allow-Origin": "*",
      "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
      "Access-Control-Allow-Headers": "Content-Type, Authorization",
    },
  });

  return response;
}
