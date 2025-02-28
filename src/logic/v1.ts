export const M3u8ProxyV1 = async (request: Request<unknown>) => {
  const url = new URL(request.url);
  const refererUrl = decodeURIComponent(url.searchParams.get("referer") || "");
  const targetUrl = decodeURIComponent(url.searchParams.get("url") || "");
  const originUrl = decodeURIComponent(url.searchParams.get("origin") || "");
  const proxyAll = decodeURIComponent(url.searchParams.get("all") || "");

  if (!targetUrl) {
    return new Response("Invalid URL", { status: 400 });
  }

  const response = await fetch(targetUrl, {
    headers: {
      Referer: refererUrl || "",
      Origin: originUrl || "",
    },
  });

  let modifiedM3u8;
  if (targetUrl.includes(".m3u8")) {
    let content = await response.text();
    const targetUrlTrimmed = targetUrl.replace(/([^/]+\.m3u8)$/, "").trim();
    const encodedUrl = encodeURIComponent(refererUrl);
    const encodedOrigin = encodeURIComponent(originUrl);

    modifiedM3u8 = content.split("\n").map((line) => {
      if (line.startsWith("#") || line.trim() == '') {
        return line;
      } else if (proxyAll === "yes" && line.startsWith("http")) {
        return `${url.origin}?url=${line}`;
      }
      return `${targetUrlTrimmed}${line}${originUrl ? `&origin=${encodedOrigin}` : ""}${refererUrl ? `&referer=${encodedUrl}` : ""}`;
    }).join("\n");
  }

  const finalContent = modifiedM3u8 || await response.text();

  return new Response(finalContent, {
    status: response.status,
    statusText: response.statusText,
    headers: {
      "Access-Control-Allow-Origin": "*",
      "Access-Control-Allow-Methods": "GET, HEAD, POST, PUT, DELETE, OPTIONS",
      "Access-Control-Allow-Headers": "Content-Type",
      "Content-Type": response.headers.get("Content-Type") || "application/vnd.apple.mpegurl",
    },
  });
};
