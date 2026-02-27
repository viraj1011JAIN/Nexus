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
  // Lazy initializers read from localStorage / matchMedia only on the client.
  // On the server they fall back to safe defaults ("system" / "light").
  // This avoids calling setState synchronously inside a useEffect
  // (react-hooks/set-state-in-effect) while still hydrating from stored prefs.
  const [theme, setThemeState] = useState<Theme>(() => {
    if (typeof localStorage !== "undefined") {
      return (localStorage.getItem(STORAGE_KEY) as Theme) || "system";
    }
    return "system";
  });

  const [systemTheme, setSystemTheme] = useState<ResolvedTheme>(() => {
    if (typeof window !== "undefined") {
      return window.matchMedia(COLOR_SCHEME_QUERY).matches ? "dark" : "light";
    }
    return "light";
  });

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

    // Apply stored theme on mount (the inline theme-script already did this
    // server-side, but we need to sync the DOM once React takes over).
    const themeToApply: ResolvedTheme = theme === "system" ? systemTheme : theme;
    applyTheme(themeToApply);

    // Subscribe: update systemTheme whenever the OS dark-mode preference changes
    const handleChange = (e: MediaQueryListEvent) => {
      const newSystemTheme: ResolvedTheme = e.matches ? "dark" : "light";
      setSystemTheme(newSystemTheme);
      if (theme === "system") applyTheme(newSystemTheme);
    };

    mediaQuery.addEventListener("change", handleChange);
    return () => mediaQuery.removeEventListener("change", handleChange);
    // theme and systemTheme are intentionally omitted: we only want this to
    // run once on mount to avoid re-subscribing on every render.
    // eslint-disable-next-line react-hooks/exhaustive-deps
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