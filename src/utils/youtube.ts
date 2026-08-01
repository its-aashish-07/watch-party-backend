const VIDEO_ID_PATTERN = /^[a-zA-Z0-9_-]{11}$/;

export function extractYouTubeVideoId(value: string): string | null {
  const input = value.trim();
  if (VIDEO_ID_PATTERN.test(input)) return input;

  try {
    const url = new URL(input);
    const hostname = url.hostname.replace(/^www\./, "");

    if (hostname === "youtu.be") {
      const id = url.pathname.slice(1).split("/")[0];
      return id && VIDEO_ID_PATTERN.test(id) ? id : null;
    }

    if (hostname === "youtube.com" || hostname === "m.youtube.com") {
      const pathId = url.pathname.startsWith("/shorts/") || url.pathname.startsWith("/embed/")
        ? url.pathname.split("/")[2]
        : url.searchParams.get("v");
      return pathId && VIDEO_ID_PATTERN.test(pathId) ? pathId : null;
    }
  } catch {
    return null;
  }

  return null;
}
