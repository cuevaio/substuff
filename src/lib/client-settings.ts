export type AutoSettings = {
  enabled: boolean;
  version: number;
  channelId: string;
  notesPerPost: number;
};
export type ImportIntent = { version: number; publishNow: boolean };
export const autoQuery = {
  queryKey: ["auto-publish"],
  queryFn: async (): Promise<AutoSettings> => {
    const response = await fetch("/api/automation");
    if (!response.ok) throw new Error("Couldn’t load publishing preferences.");
    return response.json();
  },
};
