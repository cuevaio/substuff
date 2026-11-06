export function parseSubstackUrl(value: string) {
  let url: URL;
  try {
    url = new URL(value.trim());
  } catch {
    throw new Error("Add a published Substack post link.");
  }
  const match = url.pathname.match(
    /^\/p\/([a-zA-Z0-9][a-zA-Z0-9-]{0,199})\/?$/,
  );
  if (
    url.protocol !== "https:" ||
    url.port ||
    url.username ||
    url.password ||
    !/^[a-z0-9][a-z0-9-]{0,62}\.substack\.com$/.test(url.hostname) ||
    !match
  ) {
    throw new Error("Use a post link like yourname.substack.com/p/post-title.");
  }
  return {
    url: `https://${url.hostname}/p/${match[1]}`,
    host: url.hostname,
    slug: match[1],
  };
}
