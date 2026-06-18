import React from "react";
import { ConfigProvider, theme as antdTheme } from "antd";
import ConfigRoutes from "./routes/mainroutes";
import { ContextProvider } from "./contexts/ProviderContext";
import { AuthProvider } from "./contexts/AuthContext";
import { LanguageProvider } from "./contexts/LanguageContext";
import { useStateContext } from "./contexts/ProviderContext";

// ── Inner component reads context (must be inside ContextProvider) ──────
const ThemedApp: React.FC = () => {
  const { currentColor, currentMode } = useStateContext();

  return (
    <ConfigProvider
      theme={{
        algorithm:
          currentMode === "Dark"
            ? antdTheme.darkAlgorithm
            : antdTheme.defaultAlgorithm,
        token: {
          colorPrimary: currentColor,
          borderRadius: 8,
        },
      }}
    >
      <div className="App">
        <ConfigRoutes />
      </div>
    </ConfigProvider>
  );
};

const App: React.FC = () => (
  <LanguageProvider>
    <ContextProvider>
      <AuthProvider>
        <ThemedApp />
      </AuthProvider>
    </ContextProvider>
  </LanguageProvider>
);

export default App;
