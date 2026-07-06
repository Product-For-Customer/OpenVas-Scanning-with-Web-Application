import React from "react";
import NetworkScanAnimation, {
  preloadLoginSuccessAnimationAssets as preloadNetworkScan,
} from "./variants/NetworkScanAnimation";
import SpaceEarthAnimation, {
  preloadLoginSuccessAnimationAssets as preloadSpaceEarth,
} from "./variants/space/DashboardAfterLogin";
import VulnerabilityScanAnimation, {
  preloadLoginSuccessAnimationAssets as preloadVulnScan,
} from "./variants/VulnerabilityScanAnimation";

type Props = {
  onFinished?: () => void;
  duration?: number;
  freeze?: boolean;
};

/**
 * Swap this to switch the after-login success animation style.
 * "vuln-scan" is the terminal/shield scan-log scene (current default);
 * "network-scan" is the original logo-reveal animation; "space" is the
 * cinematic Earth scene. All three are kept as drop-in fallbacks.
 */
const ACTIVE_VARIANT: "vuln-scan" | "space" | "network-scan" = "vuln-scan";

const variants = {
  "vuln-scan": { Component: VulnerabilityScanAnimation, preload: preloadVulnScan },
  space: { Component: SpaceEarthAnimation, preload: preloadSpaceEarth },
  "network-scan": { Component: NetworkScanAnimation, preload: preloadNetworkScan },
} as const;

export const preloadLoginSuccessAnimationAssets = (): Promise<void> =>
  variants[ACTIVE_VARIANT].preload();

const Index: React.FC<Props> = (props) => {
  const { Component } = variants[ACTIVE_VARIANT];
  return <Component {...props} />;
};

export default Index;
