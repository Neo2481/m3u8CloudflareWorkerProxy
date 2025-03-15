export function getUrl(input: string, fallbackUrl: URL): URL {
  try {
    // If input is an absolute URL, return it directly
    return new URL(input);
  } catch {
    // Use fallbackUrl as base for relative URLs
    const newUrl = new URL(input, fallbackUrl);

    // Ensure no double slashes in pathname
    newUrl.pathname = newUrl.pathname.replace(/\/{2,}/g, "/");

    // Preserve query parameters from input
    const inputUrl = new URL(input, fallbackUrl);
    inputUrl.searchParams.forEach((value, key) => {
      newUrl.searchParams.set(key, value);
    });

    return newUrl;
  }
}
