export function getUrl(input: string, fallbackUrl: URL): URL {
  try {
    return new URL(input); // If input is an absolute URL, return it directly.
  } catch (e) {
    const newUrl = new URL(fallbackUrl.toString()); // Create a copy of fallbackUrl

    if (input.startsWith("/")) {
      newUrl.pathname = input; // Use absolute path
    } else {
      newUrl.pathname = new URL(input, newUrl).pathname; // Append relative path correctly
    }

    return newUrl;
  }
}
