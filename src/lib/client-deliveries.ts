import type { DeliveryReceipt } from "./delivery";
export function deliveryQuery(articleId: string) {
  return {
    queryKey: ["buffer-deliveries", articleId],
    queryFn: async () => {
      const response = await fetch(
        `/api/buffer/deliveries?articleId=${encodeURIComponent(articleId)}&sync=true`,
      );
      const data = await response.json();
      if (!response.ok)
        throw new Error(data.error || "Couldn’t load Note status.");
      return data as { deliveries: DeliveryReceipt[]; warning?: string };
    },
    staleTime: 30000,
    refetchInterval: 60000,
    refetchOnWindowFocus: true,
  };
}
