export function getUrl(input: string, fallbackUrl: URL): URL {
  try {
    return new URL(input); // If input is an absolute URL, return it directly.
  } catch (e) {
    const newUrl = new URL(fallbackUrl.toString()); // Create a copy of fallbackUrl

    if (input.startsWith("/")) {
      newUrl.pathname = input.replace(/^\/+/, ""); // Ensure no double slashes
    } else {
      newUrl.pathname = new URL(input, newUrl).pathname; // Append relative path correctly
    }

    // Preserve query parameters
    const inputUrl = new URL(input, newUrl);
    inputUrl.searchParams.forEach((value, key) => {
      newUrl.searchParams.set(key, value);
    });

    return newUrl;
  }
}
