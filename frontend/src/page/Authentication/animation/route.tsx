import React, { useEffect, useRef } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { useAuth } from "../../../contexts/AuthContext";
import AnimationSuccess from "./index";

type AnimationRouteState = {
  redirectTo: string;
  refreshAuth?: boolean;
};

/**
 * Route-level wrapper for the shared success animation.
 * Navigated to (never rendered directly) with router state telling it
 * where to go once the animation finishes — e.g. /admin after login,
 * or /login after register/reset-password verification.
 */
const LogoAnimationRoute: React.FC = () => {
  const navigate  = useNavigate();
  const location  = useLocation();
  const { refreshMe } = useAuth();
  const isMounted = useRef(true);

  const state = (location.state as AnimationRouteState | null) ?? null;

  useEffect(() => {
    isMounted.current = true;
    if (!state?.redirectTo) {
      navigate("/login", { replace: true });
    }
    return () => { isMounted.current = false; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  if (!state?.redirectTo) return null;

  const handleFinished = async () => {
    if (state.refreshAuth) {
      try { await refreshMe(); } catch { /* non-critical */ }
    }
    if (isMounted.current) {
      navigate(state.redirectTo, { replace: true });
    }
  };

  return <AnimationSuccess duration={2200} onFinished={handleFinished} />;
};

export default LogoAnimationRoute;
