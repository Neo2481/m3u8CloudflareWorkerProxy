export const M3u8ProxyV1 = async (request: Request) => {
  const url = new URL(request.url);
  const refererUrl = url.searchParams.get("referer") || "";
  const targetUrl = url.searchParams.get("url");
  const originUrl = url.searchParams.get("origin") || "";
  const proxyAll = url.searchParams.get("all") || "";

  if (!targetUrl) {
    return new Response("Invalid URL", { status: 400 });
  }

  const response = await fetch(targetUrl, {
    headers: {
      Referer: refererUrl,
      Origin: originUrl,
    },
    keepalive: true, // Helps with persistent connections
  });

  if (!response.ok) {
    return new Response("Failed to fetch", { status: response.status });
  }

  // If it's an m3u8 file, modify it
  if (targetUrl.includes(".m3u8")) {
    const targetBase = targetUrl.substring(0, targetUrl.lastIndexOf("/") + 1);
    const content = await response.text();

    const modifiedM3u8 = content
      .split("\n")
      .map((line) => {
        line = line.trim();
        if (!line || line.startsWith("#")) return line; // Keep comments and empty lines

        if (proxyAll === "yes" && line.startsWith("http")) {
          return `${url.origin}/m3u8proxy?url=${encodeURIComponent(line)}`;
        }

        // Handle relative paths
        return targetBase + line;
      })
      .join("\n");

    return new Response(modifiedM3u8, {
      status: 200,
      headers: {
        "Access-Control-Allow-Origin": "*",
        "Content-Type": "application/vnd.apple.mpegurl",
      },
    });
  }

  // Stream response directly for .ts and other files
  return new Response(response.body, {
    status: response.status,
    headers: {
      "Access-Control-Allow-Origin": "*",
      "Content-Type": response.headers.get("Content-Type") || "application/octet-stream",
    },
  });
};
