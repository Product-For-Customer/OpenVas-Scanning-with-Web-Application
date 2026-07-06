import React from "react";
import AnimationSuccess from "./index";

/**
 * Standalone preview route (no auth/router-state required) that plays the
 * after-login success animation and then holds forever at the 100% /
 * "ACCESS GRANTED" frame — for taking a screenshot to use in presentations.
 */
const AnimationPreview: React.FC = () => {
  return <AnimationSuccess duration={2200} freeze />;
};

export default AnimationPreview;
