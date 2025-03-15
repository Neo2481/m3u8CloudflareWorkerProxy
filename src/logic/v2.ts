import { getUrl } from "../utils";

// List of supported m3u8 content types
const m3u8ContentTypes = [
  "application/vnd.",
  "video/mp2t",
  "application/x-mpegurl",
  "application/mpegurl",
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
      headers: {
        "Access-Control-Allow-Origin": "*",
      },
    });
  }

  let scrapeHeadersObject: Record<string, string> | null;
  try {
    scrapeHeadersObject = scrapeHeadersString ? JSON.parse(scrapeHeadersString) : null;
  } catch (e) {
    return new Response(JSON.stringify({ success: false, message: "Invalid headers format" }), {
      status: 400,
      headers: {
        "Access-Control-Allow-Origin": "*",
      },
    });
  }

  // Construct headers for the outgoing request
  const headers: Record<string, string> = {
    ...(scrapeHeadersObject || {}),
  };

  // Pass Range header for seeking support in video streams
  const rangeHeader = request.headers.get("Range");
  if (rangeHeader) headers["Range"] = rangeHeader;

  // Fetch the target URL
  const response = await fetch(scrapeUrlString, { headers });
  const responseContentType = response.headers.get("Content-Type")?.toLowerCase();
  let responseBody: BodyInit | null = response.body;

  // Check if the file is an m3u8 playlist
  const isM3u8 =
    scrapeUrlString.endsWith(".m3u8") ||
    (responseContentType && m3u8ContentTypes.some((type) => responseContentType.includes(type)));

  if (isM3u8) {
    const m3u8File = await response.text();
    const scrapeUrl = new URL(scrapeUrlString);

    const m3u8AdjustedChunks: string[] = [];

    for (const line of m3u8File.split("\n")) {
      const trimmedLine = line.trim();

      // Keep comments and empty lines
      if (!trimmedLine || trimmedLine.startsWith("#")) {
        // Handle EXT-X-MAP separately
        if (trimmedLine.startsWith("#EXT-X-MAP:URI=")) {
          const mapUrlMatch = trimmedLine.match(/#EXT-X-MAP:URI="(.+?)"/);
          if (mapUrlMatch) {
            const adjustedUrl = getUrl(mapUrlMatch[1], scrapeUrl);
            m3u8AdjustedChunks.push(`#EXT-X-MAP:URI="${adjustedUrl}"`);
          } else {
            m3u8AdjustedChunks.push(trimmedLine);
          }
        } else {
          m3u8AdjustedChunks.push(trimmedLine);
        }
        continue;
      }

      // Adjust segment URLs
      const segmentUrl = getUrl(trimmedLine, scrapeUrl);
      m3u8AdjustedChunks.push(segmentUrl);
    }

    // Combine modified m3u8 content
    responseBody = m3u8AdjustedChunks.join("\n");
  }

  // Prepare headers for the client response
  const responseHeaders = new Headers(response.headers);
  responseHeaders.set("Access-Control-Allow-Origin", "*");
  responseHeaders.set("Access-Control-Allow-Methods", "GET, HEAD, OPTIONS");
  responseHeaders.set("Access-Control-Allow-Headers", "Content-Type");
  responseHeaders.set(
    "Cache-Control",
    "public, max-age=3600, stale-while-revalidate=60, must-revalidate"
  );

  if (isM3u8) {
    responseHeaders.set("Content-Type", "application/vnd.apple.mpegurl");
  }

  return new Response(responseBody, {
    status: response.status,
    headers: responseHeaders,
  });
};
