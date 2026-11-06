export type AutoSettings = {
  enabled: boolean;
  version: number;
};
export type ImportIntent = { version: number };
export const autoQuery = {
  queryKey: ["auto-approve"],
  queryFn: async (): Promise<AutoSettings> => {
    const response = await fetch("/api/automation");
    if (!response.ok) throw new Error("Couldn’t load approval preferences.");
    return response.json();
  },
};
