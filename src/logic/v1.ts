export const M3u8ProxyV1 = async (request: Request) => {
  const url = new URL(request.url);
  const refererUrl = url.searchParams.get("referer") || "";
  const targetUrl = url.searchParams.get("url");
  const originUrl = url.searchParams.get("origin") || "";
  const proxyAll = url.searchParams.get("all") === "yes";

  if (!targetUrl) {
    return new Response("Invalid URL", { status: 400 });
  }

  // Fetch target URL
  const response = await fetch(targetUrl, {
    headers: {
      Referer: refererUrl,
      Origin: originUrl,
    },
    keepalive: true, // Keep connection open for better streaming
  });

  if (!response.ok) {
    return new Response(`Failed to fetch (${response.status})`, { status: response.status });
  }

  // Handle M3U8 file
  if (targetUrl.includes(".m3u8")) {
    const targetBase = targetUrl.substring(0, targetUrl.lastIndexOf("/") + 1);
    const content = await response.text();

    // Modify M3U8 content
    const modifiedM3u8 = content
      .split("\n")
      .map((line) => {
        line = line.trim();

        // Keep comments and empty lines as is
        if (!line || line.startsWith("#")) return line;

        // If proxyAll is enabled, re-route absolute URLs through the proxy
        if (proxyAll && line.startsWith("http")) {
          return `${url.origin}/m3u8proxy?url=${encodeURIComponent(line)}`;
        }

        // Handle relative URLs
        if (!line.startsWith("http")) {
          return targetBase + line;
        }

        return line;
      })
      .join("\n");

    return new Response(modifiedM3u8, {
      status: 200,
      headers: {
        "Content-Type": "application/vnd.apple.mpegurl",
        "Access-Control-Allow-Origin": "*",
        "Cache-Control": "public, max-age=3600, stale-while-revalidate=60, must-revalidate", // 1-hour cache
      },
    });
  }

  // Stream response directly for .ts and other files
  return new Response(response.body, {
    status: response.status,
    headers: {
      "Content-Type": response.headers.get("Content-Type") || "application/octet-stream",
      "Access-Control-Allow-Origin": "*",
      "Cache-Control": "public, max-age=3600, stale-while-revalidate=60, must-revalidate",
    },
  });
};
