// Version 1 authorized immediate publication. It must never enable this new mode.
export const AUTO_POLICY_VERSION = 2;
export function mayAutoApprove(
  config:
    | {
        enabled: boolean;
        version: number;
        consentAt: Date | null;
        policyVersion: number;
      }
    | undefined,
  jobVersion: number | null,
) {
  return Boolean(
    config?.enabled &&
      config.consentAt &&
      config.policyVersion === AUTO_POLICY_VERSION &&
      jobVersion !== null &&
      config.version === jobVersion,
  );
}
