export const AUTO_POLICY_VERSION = 1;
export function mayAutoPublish(
  config:
    | {
        enabled: boolean;
        channelId: string | null;
        version: number;
        consentAt: Date | null;
        policyVersion: number;
      }
    | undefined,
  jobVersion: number | null,
) {
  return Boolean(
    config?.enabled &&
      config.channelId &&
      config.consentAt &&
      config.policyVersion === AUTO_POLICY_VERSION &&
      jobVersion !== null &&
      config.version === jobVersion,
  );
}
