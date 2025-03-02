import { getUrl } from "../utils";

const m3u8ContentTypes = [
  "application/vnd.",
  "video/mp2t",
  "application/x-mpegurl",
  "application/mpegurl",
  "application/x-mpegurl",
  "application/vnd.apple.mpegurl",
  "audio/mpegurl",
  "audio/x-mpegurl",
  "video/x-mpegurl",
  "application/vnd.apple.mpegurl.audio",
  "application/vnd.apple.mpegurl.video",
];

export const M3u8ProxyV2 = async (request: Request): Promise<Response> => {
  const url = new URL(request.url);
  const scrapeUrlString = url.searchParams.get("url");
  const scrapeHeadersString = url.searchParams.get("headers");

  if (!scrapeUrlString) {
    return new Response(JSON.stringify({ success: false, message: "No scrape URL provided" }), {
      status: 400,
      headers: { "Access-Control-Allow-Origin": "*" },
    });
  }

  let scrapeHeadersObject: Record<string, string> | null;
  try {
    scrapeHeadersObject = scrapeHeadersString ? JSON.parse(scrapeHeadersString) : null;
  } catch (e) {
    return new Response(JSON.stringify({ success: false, message: "Invalid headers format" }), {
      status: 400,
      headers: { "Access-Control-Allow-Origin": "*" },
    });
  }

  const headers: Record<string, string> = {
    ...(scrapeHeadersObject || {}),
  };
  const rangeHeader = request.headers.get("Range");
  if (rangeHeader) headers["Range"] = rangeHeader;

  const response = await fetch(scrapeUrlString, { headers });
  const responseContentType = response.headers.get("Content-Type")?.toLowerCase();
  let responseBody: BodyInit | null = response.body;

  const isM3u8 =
    scrapeUrlString.endsWith(".m3u8") ||
    (responseContentType && m3u8ContentTypes.some((name) => responseContentType.includes(name)));

  if (isM3u8) {
    const m3u8File = await response.text();
    const scrapeUrl = new URL(scrapeUrlString);
    const m3u8AdjustedChunks: string[] = [];

    for (const line of m3u8File.split("\n")) {
      if (line.startsWith("#") || !line.trim()) {
        if (line.startsWith("#EXT-X-MAP:URI=")) {
          const mapUrlMatch = line.match(/#EXT-X-MAP:URI="(.+?)"/);
          if (mapUrlMatch) {
            const url = getUrl(mapUrlMatch[1], scrapeUrl);
            m3u8AdjustedChunks.push(`#EXT-X-MAP:URI="${url}"`);
          } else {
            m3u8AdjustedChunks.push(line);
          }
        } else {
          m3u8AdjustedChunks.push(line);
        }
        continue;
      }

      const segmentUrl = getUrl(line, scrapeUrl);
      m3u8AdjustedChunks.push(segmentUrl);
    }

    responseBody = m3u8AdjustedChunks.join("\n");
  }

  const responseHeaders = new Headers(response.headers);
  responseHeaders.set("Access-Control-Allow-Origin", "*");
  responseHeaders.set("Access-Control-Allow-Methods", "GET, HEAD, OPTIONS");
  responseHeaders.set("Access-Control-Allow-Headers", "Content-Type");

  return new Response(responseBody, {
    status: response.status,
    headers: responseHeaders,
  });
};
