import React, { createContext, useContext, useState, useEffect } from 'react';
import { themes } from './themes';

const ThemeContext = createContext();

export const ThemeProvider = ({ children }) => {
  const [themeName, setThemeName] = useState(() => {
    return localStorage.getItem('theme') || 'dark';
  });

  const theme = themes[themeName] || themes.dark;

  useEffect(() => {
    localStorage.setItem('theme', themeName);
    
    // Apply CSS variables to root
    const root = document.documentElement;
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
  }, [themeName, theme]);

  const toggleTheme = (name) => {
    if (themes[name]) {
      setThemeName(name);
    }
  };

  return (
    <ThemeContext.Provider value={{ theme, themeName, setTheme: toggleTheme }}>
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
