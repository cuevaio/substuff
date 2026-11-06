import type { BufferChannel } from "./buffer";

export function httpsUrl(value?: string | null) {
  try {
    const url = new URL(value || "");
    return url.protocol === "https:" && !url.username && !url.password
      ? url.href
      : undefined;
  } catch {
    return undefined;
  }
}

// Never label a Note with an arbitrary first account in a multi-channel workspace.
export function noteProfile(channels: BufferChannel[], channelId?: string) {
  const channel = channelId
    ? channels.find((channel) => channel.id === channelId)
    : channels.length === 1
      ? channels[0]
      : undefined;
  if (!channel) return null;
  const profileUrl = httpsUrl(channel.externalLink);
  const host = profileUrl ? new URL(profileUrl).hostname : "";
  return {
    name: channel.displayName?.trim() || channel.name,
    avatar: httpsUrl(channel.avatar),
    url:
      host === "substack.com" || host.endsWith(".substack.com")
        ? profileUrl
        : undefined,
  };
}
