export const darkTheme = {
  name: 'Dark',
  colors: {
    background: '#121212',
    surface: '#1e1e1e',
    primary: '#007aff',
    secondary: '#5856d6',
    success: '#34c759',
    warning: '#ffcc00',
    error: '#ff3b30',
    info: '#007aff',
    text: '#ffffff',
    textSecondary: '#ebebf599',
    border: '#38383a',
  },
  spacing: {
    xs: '4px',
    sm: '8px',
    md: '16px',
    lg: '24px',
    xl: '32px',
  },
  borderRadius: {
    sm: '4px',
    md: '8px',
    lg: '16px',
    full: '9999px',
  },
  shadows: {
    sm: '0 2px 4px rgba(0,0,0,0.1)',
    md: '0 4px 8px rgba(0,0,0,0.2)',
    lg: '0 8px 16px rgba(0,0,0,0.3)',
  }
};

export const lightTheme = {
  name: 'Light',
  colors: {
    background: '#f2f2f7',
    surface: '#ffffff',
    primary: '#007aff',
    secondary: '#5856d6',
    success: '#34c759',
    warning: '#ffcc00',
    error: '#ff3b30',
    info: '#007aff',
    text: '#000000',
    textSecondary: '#3c3c4399',
    border: '#c6c6c8',
  },
  spacing: darkTheme.spacing,
  borderRadius: darkTheme.borderRadius,
  shadows: {
    sm: '0 2px 4px rgba(0,0,0,0.05)',
    md: '0 4px 8px rgba(0,0,0,0.1)',
    lg: '0 8px 16px rgba(0,0,0,0.15)',
  }
};

export const amoledTheme = {
  name: 'AMOLED Black',
  colors: {
    background: '#000000',
    surface: '#121212',
    primary: '#007aff',
    secondary: '#5856d6',
    success: '#30d158',
    warning: '#ffd60a',
    error: '#ff453a',
    info: '#0a84ff',
    text: '#ffffff',
    textSecondary: '#ebebf599',
    border: '#2c2c2e',
  },
  spacing: darkTheme.spacing,
  borderRadius: darkTheme.borderRadius,
  shadows: {
    sm: '0 2px 4px rgba(255,255,255,0.05)',
    md: '0 4px 8px rgba(255,255,255,0.1)',
    lg: '0 8px 16px rgba(255,255,255,0.15)',
  }
};

export const themes = {
  dark: darkTheme,
  light: lightTheme,
  amoled: amoledTheme,
};
