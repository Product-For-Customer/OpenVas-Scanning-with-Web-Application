import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from "react";
import type { ReactNode, ChangeEvent } from "react";

// ─────────────────────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────────────────────

interface InitialState {
  chat: boolean;
  cart: boolean;
  userProfile: boolean;
  notification: boolean;
}

export type ThemeMode = "Light" | "Dark";

interface StateContextType {
  screenSize: number | undefined;
  setScreenSize: React.Dispatch<React.SetStateAction<number | undefined>>;

  currentColor: string;
  setCurrentColor: React.Dispatch<React.SetStateAction<string>>;

  currentMode: ThemeMode;
  setCurrentMode: React.Dispatch<React.SetStateAction<ThemeMode>>;
  setTheme: (mode: ThemeMode) => void;

  themeSettings: boolean;
  setThemeSettings: React.Dispatch<React.SetStateAction<boolean>>;

  activeMenu: boolean;
  setActiveMenu: React.Dispatch<React.SetStateAction<boolean>>;

  isClicked: InitialState;
  setIsClicked: React.Dispatch<React.SetStateAction<InitialState>>;
  initialState: InitialState;

  setMode: (e: ChangeEvent<HTMLInputElement | HTMLSelectElement>) => void;
  setColor: (color: string) => void;
  handleClick: (clicked: keyof InitialState) => void;
  toggleMode: () => void;

  userRefreshTrigger: number;
  triggerUserRefresh: () => void;
}

const initialState: InitialState = {
  chat: false,
  cart: false,
  userProfile: false,
  notification: false,
};

const StateContext = createContext<StateContextType | undefined>(undefined);

// ─────────────────────────────────────────────────────────────
// Storage keys
// ─────────────────────────────────────────────────────────────

const STORAGE_KEY_MODE  = "themeMode";
const STORAGE_KEY_COLOR = "colorMode";
const DEFAULT_COLOR     = "#1A97F5";

// ─────────────────────────────────────────────────────────────
// DOM helpers
// ─────────────────────────────────────────────────────────────

const applyTheme = (mode: ThemeMode) => {
  if (mode === "Dark") document.documentElement.classList.add("dark");
  else document.documentElement.classList.remove("dark");
};

/** Sets the --accent CSS custom property used by all accent utilities */
const applyAccentColor = (color: string) => {
  document.documentElement.style.setProperty("--accent", color);
};

const getSystemPrefMode = (): ThemeMode =>
  window.matchMedia?.("(prefers-color-scheme: dark)")?.matches ? "Dark" : "Light";

// ─────────────────────────────────────────────────────────────
// Provider
// ─────────────────────────────────────────────────────────────

export const ContextProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const [screenSize, setScreenSize]         = useState<number | undefined>(undefined);
  const [currentColor, setCurrentColor]     = useState<string>(DEFAULT_COLOR);
  const [currentMode, setCurrentMode]       = useState<ThemeMode>("Light");
  const [themeSettings, setThemeSettings]   = useState<boolean>(false);
  const [activeMenu, setActiveMenu]         = useState<boolean>(true);
  const [isClicked, setIsClicked]           = useState<InitialState>(initialState);
  const [userRefreshTrigger, setUserRefreshTrigger] = useState<number>(0);

  // ── Init from localStorage ──────────────────────────────────
  useEffect(() => {
    const savedMode  = localStorage.getItem(STORAGE_KEY_MODE);
    const savedColor = localStorage.getItem(STORAGE_KEY_COLOR);

    const mode: ThemeMode =
      savedMode === "Dark" || savedMode === "Light"
        ? (savedMode as ThemeMode)
        : getSystemPrefMode();

    setCurrentMode(mode);
    applyTheme(mode);

    const color = savedColor || DEFAULT_COLOR;
    setCurrentColor(color);
    applyAccentColor(color);
  }, []);

  // ── Keep .dark class in sync with currentMode ───────────────
  useEffect(() => {
    applyTheme(currentMode);
  }, [currentMode]);

  // ── Cross-tab sync (both mode AND color) ────────────────────
  useEffect(() => {
    const onStorage = (e: StorageEvent) => {
      if (e.key === STORAGE_KEY_MODE && e.newValue) {
        const mode: ThemeMode = e.newValue === "Dark" ? "Dark" : "Light";
        setCurrentMode(mode);
      }
      if (e.key === STORAGE_KEY_COLOR && e.newValue) {
        setCurrentColor(e.newValue);
        applyAccentColor(e.newValue);
      }
    };
    window.addEventListener("storage", onStorage);
    return () => window.removeEventListener("storage", onStorage);
  }, []);

  // ── Methods ─────────────────────────────────────────────────

  /** Set dark/light mode — applies CSS class + persists to localStorage */
  const setTheme = useCallback((mode: ThemeMode) => {
    setCurrentMode(mode);
    localStorage.setItem(STORAGE_KEY_MODE, mode);
  }, []);

  const setMode = useCallback(
    (e: ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
      setTheme(e.target.value === "Dark" ? "Dark" : "Light");
    },
    [setTheme]
  );

  const toggleMode = useCallback(() => {
    setTheme(currentMode === "Dark" ? "Light" : "Dark");
  }, [currentMode, setTheme]);

  /** Set accent color — applies CSS variable + persists to localStorage */
  const setColor = useCallback((color: string) => {
    setCurrentColor(color);
    applyAccentColor(color);
    localStorage.setItem(STORAGE_KEY_COLOR, color);
  }, []);

  const handleClick = useCallback(
    (clicked: keyof InitialState) =>
      setIsClicked({ ...initialState, [clicked]: true }),
    []
  );

  const triggerUserRefresh = useCallback(
    () => setUserRefreshTrigger((prev) => prev + 1),
    []
  );

  // ── Context value ────────────────────────────────────────────
  const value = useMemo<StateContextType>(
    () => ({
      currentColor,
      currentMode,
      setCurrentMode,
      setTheme,
      activeMenu,
      screenSize,
      setScreenSize,
      handleClick,
      isClicked,
      initialState,
      setIsClicked,
      setActiveMenu,
      setCurrentColor,
      setMode,
      setColor,
      themeSettings,
      setThemeSettings,
      toggleMode,
      userRefreshTrigger,
      triggerUserRefresh,
    }),
    [
      currentColor,
      currentMode,
      setTheme,
      activeMenu,
      screenSize,
      isClicked,
      themeSettings,
      setMode,
      setColor,
      toggleMode,
      userRefreshTrigger,
      triggerUserRefresh,
    ]
  );

  return <StateContext.Provider value={value}>{children}</StateContext.Provider>;
};

// ─────────────────────────────────────────────────────────────
// Hook
// ─────────────────────────────────────────────────────────────

export const useStateContext = (): StateContextType => {
  const context = useContext(StateContext);
  if (!context) throw new Error("useStateContext must be used within a ContextProvider");
  return context;
};
