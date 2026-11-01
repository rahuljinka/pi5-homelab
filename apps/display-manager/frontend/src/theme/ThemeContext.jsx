import React, { createContext, useContext, useState, useEffect } from 'react';
import { themes } from './themes';

const ThemeContext = createContext();

// "system" follows the browser/device light-dark setting; any other value
// is a key of `themes` that the user picked explicitly.
export const SYSTEM_THEME = 'system';

const darkQuery = () => window.matchMedia('(prefers-color-scheme: dark)');

function readSavedPreference() {
  try {
    const saved = localStorage.getItem('theme');
    if (saved === SYSTEM_THEME || themes[saved]) return saved;
  } catch {
    // Storage unavailable (private mode etc.); fall through to the default.
  }
  return SYSTEM_THEME;
}

export const ThemeProvider = ({ children }) => {
  const [themeName, setThemeName] = useState(readSavedPreference);
  const [systemDark, setSystemDark] = useState(() => darkQuery().matches);

  // Track live changes to the device setting (e.g. auto dark mode at sunset).
  useEffect(() => {
    const query = darkQuery();
    const onChange = (e) => setSystemDark(e.matches);
    query.addEventListener('change', onChange);
    return () => query.removeEventListener('change', onChange);
  }, []);

  const resolvedName = themeName === SYSTEM_THEME ? (systemDark ? 'dark' : 'light') : themeName;
  const theme = themes[resolvedName] || themes.dark;

  useEffect(() => {
    try {
      localStorage.setItem('theme', themeName);
    } catch {
      // Not fatal; the choice just won't be remembered.
    }

    // Apply CSS variables to root
    const root = document.documentElement;
    root.style.colorScheme = resolvedName === 'light' ? 'light' : 'dark';
    Object.entries(theme.colors).forEach(([key, value]) => {
      root.style.setProperty(`--color-${key}`, value);
    });
    Object.entries(theme.spacing).forEach(([key, value]) => {
      root.style.setProperty(`--spacing-${key}`, value);
    });
    Object.entries(theme.borderRadius).forEach(([key, value]) => {
      root.style.setProperty(`--radius-${key}`, value);
    });
    Object.entries(theme.shadows).forEach(([key, value]) => {
      root.style.setProperty(`--shadow-${key}`, value);
    });
  }, [themeName, resolvedName, theme]);

  const setTheme = (name) => {
    if (name === SYSTEM_THEME || themes[name]) {
      setThemeName(name);
    }
  };

  return (
    <ThemeContext.Provider value={{ theme, themeName, resolvedName, setTheme }}>
      {children}
    </ThemeContext.Provider>
  );
};

export const useTheme = () => {
  const context = useContext(ThemeContext);
  if (!context) {
    throw new Error('useTheme must be used within a ThemeProvider');
  }
  return context;
};
