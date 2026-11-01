import React from 'react';

export const GlobalStyles = () => (
  <style>{`
    :root {
      --font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif;
      --touch-target-min: 44px;
      --transition-speed: 0.3s;
    }

    * {
      box-sizing: border-box;
      -webkit-tap-highlight-color: transparent;
    }

    body {
      margin: 0;
      padding: 0;
      background-color: var(--color-background);
      color: var(--color-text);
      font-family: var(--font-family);
      transition: background-color var(--transition-speed) ease, color var(--transition-speed) ease, border-color var(--transition-speed) ease;
      -webkit-font-smoothing: antialiased;
      -moz-osx-font-smoothing: grayscale;
    }

    * {
      transition: background-color var(--transition-speed) ease, color var(--transition-speed) ease, border-color var(--transition-speed) ease, box-shadow var(--transition-speed) ease;
    }

    button, input, select, textarea {
      font-family: inherit;
    }

    h1, h2, h3, h4, h5, h6 {
      margin-top: 0;
      margin-bottom: var(--spacing-md);
      font-weight: 600;
    }

    p {
      margin-top: 0;
      margin-bottom: var(--spacing-sm);
    }

    /* Scrollbar styling */
    ::-webkit-scrollbar {
      width: 6px;
      height: 6px;
    }
    ::-webkit-scrollbar-track {
      background: var(--color-background);
    }
    ::-webkit-scrollbar-thumb {
      background: var(--color-border);
      border-radius: 3px;
    }
    ::-webkit-scrollbar-thumb:hover {
      background: var(--color-textSecondary);
    }
  `}</style>
);
