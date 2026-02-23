"use client";

import { createContext, useContext, useEffect, useState, useCallback, useMemo, memo } from "react";

// ============================================================================
// TYPES & CONSTANTS
// ============================================================================

type Theme = "light" | "dark" | "system";
type ResolvedTheme = "light" | "dark";

interface ThemeContextType {
  theme: Theme;
  resolvedTheme: ResolvedTheme;
  setTheme: (theme: Theme) => void;
  toggleTheme: () => void;
}

const STORAGE_KEY = "nexus-theme-preference";
const COLOR_SCHEME_QUERY = "(prefers-color-scheme: dark)";

// ============================================================================
// CONTEXT
// ============================================================================

const ThemeContext = createContext<ThemeContextType | undefined>(undefined);

// ============================================================================
// THEME PROVIDER COMPONENT (Optimized for Performance)
// ============================================================================

function ThemeProviderComponent({ children }: { children: React.ReactNode }) {
  const [theme, setThemeState] = useState<Theme>("system");
  const [systemTheme, setSystemTheme] = useState<ResolvedTheme>("light");

  // Memoize resolved theme to prevent recalculations
  const resolvedTheme: ResolvedTheme = useMemo(
    () => (theme === "system" ? systemTheme : theme),
    [theme, systemTheme]
  );

  // ============================================================================
  // THEME APPLICATION (Optimized - Batch DOM Updates)
  // ============================================================================

  const applyTheme = useCallback((newResolvedTheme: ResolvedTheme) => {
    const root = document.documentElement;
    // Fast class manipulation
    root.className = root.className.replace(/\b(light|dark)\b/g, '').trim() + ' ' + newResolvedTheme;
    root.style.colorScheme = newResolvedTheme;
  }, []);

  // ============================================================================
  // INITIALIZATION (Single Optimized Effect)
  // ============================================================================

  useEffect(() => {
    const mediaQuery = window.matchMedia(COLOR_SCHEME_QUERY);
    const storedTheme = (localStorage.getItem(STORAGE_KEY) as Theme) || "system";
    
    // Set initial state in single batch
    const initialSystemTheme = mediaQuery.matches ? "dark" : "light";
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setSystemTheme(initialSystemTheme);
    setThemeState(storedTheme);
    
    // Apply theme (script already did this, just sync)
    const themeToApply: ResolvedTheme = storedTheme === "system" ? initialSystemTheme : storedTheme;
    applyTheme(themeToApply);

    // Optimized system theme listener
    const handleChange = (e: MediaQueryListEvent) => {
      const newSystemTheme = e.matches ? "dark" : "light";
      setSystemTheme(newSystemTheme);
      if (storedTheme === "system") applyTheme(newSystemTheme);
    };

    mediaQuery.addEventListener("change", handleChange);
    return () => mediaQuery.removeEventListener("change", handleChange);
  }, [applyTheme]);

  // ============================================================================
  // THEME SETTERS
  // ============================================================================

  const setTheme = useCallback((newTheme: Theme) => {
    setThemeState(newTheme);
    localStorage.setItem(STORAGE_KEY, newTheme);
    
    const newResolvedTheme: ResolvedTheme = 
      newTheme === "system" ? systemTheme : newTheme;
    
    applyTheme(newResolvedTheme);
  }, [systemTheme, applyTheme]);

  const toggleTheme = useCallback(() => {
    const newTheme: ResolvedTheme = resolvedTheme === "light" ? "dark" : "light";
    setTheme(newTheme);
  }, [resolvedTheme, setTheme]);

  // ============================================================================
  // MEMOIZED CONTEXT VALUE (Prevents Unnecessary Re-renders)
  // ============================================================================

  const contextValue = useMemo(
    () => ({
      theme,
      resolvedTheme,
      setTheme,
      toggleTheme,
    }),
    [theme, resolvedTheme, setTheme, toggleTheme]
  );

  return (
    <ThemeContext.Provider value={contextValue}>
      {children}
    </ThemeContext.Provider>
  );
}

// Memoize entire provider to prevent unnecessary re-renders
export const ThemeProvider = memo(ThemeProviderComponent);

// ============================================================================
// HOOK
// ============================================================================

export function useTheme() {
  const context = useContext(ThemeContext);
  if (!context) {
    throw new Error("useTheme must be used within ThemeProvider");
  }
  return context;
}

// ============================================================================
// OPTIMIZED THEME SCRIPT (Minified, Prevents FOUC)
// Runs before React hydration for instant theme application
// ============================================================================

export const themeScript = `!function(){try{var e=localStorage.getItem('nexus-theme-preference'),t=window.matchMedia('(prefers-color-scheme: dark)').matches,r='light'===e||'dark'===e?e:t?'dark':'light',n=document.documentElement;n.className=r,n.style.colorScheme=r}catch(e){}}();`;