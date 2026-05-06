import { useState, useEffect } from 'react';

export type Theme = 'light' | 'dark' | 'high-contrast';

/**
 * Hook to manage and apply Kerry Design System themes.
 */
export function useTheme(defaultTheme: Theme = 'light') {
  const [theme, setTheme] = useState<Theme>(() => {
    if (typeof window === 'undefined') return defaultTheme;
    return (localStorage.getItem('kerry-theme') as Theme) || defaultTheme;
  });

  useEffect(() => {
    document.documentElement.setAttribute('data-theme', theme);
    localStorage.setItem('kerry-theme', theme);
  }, [theme]);

  const toggleTheme = () => {
    setTheme((prev) => (prev === 'light' ? 'dark' : 'light'));
  };

  return { theme, setTheme, toggleTheme };
}
