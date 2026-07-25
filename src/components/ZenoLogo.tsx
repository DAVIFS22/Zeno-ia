import React, { useState, useEffect, useMemo } from 'react';

interface ZenoLogoProps {
  size?: 'xs' | 'sm' | 'md' | 'lg' | 'xl' | number;
  className?: string;
  theme?: 'dark' | 'light' | 'auto';
  variant?: 'monochrome' | 'gradient';
}

export const ZenoLogo: React.FC<ZenoLogoProps> = ({
  size = 'md',
  className = '',
  theme = 'dark',
  variant = 'monochrome',
}) => {
  const sizeMap: Record<string, number> = {
    xs: 18,
    sm: 24,
    md: 32,
    lg: 56,
    xl: 72,
  };

  const pxSize = typeof size === 'number' ? size : sizeMap[size] || 32;

  // Proportional font size and corner radius
  const fontSize = Math.max(11, Math.round(pxSize * 0.58));
  const borderRadius = Math.max(6, Math.round(pxSize * 0.28));

  const [systemTheme, setSystemTheme] = useState<'dark' | 'light'>(() => {
    if (typeof window !== 'undefined') {
      return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
    }
    return 'dark';
  });

  useEffect(() => {
    if (typeof window === 'undefined') return;
    const mediaQuery = window.matchMedia('(prefers-color-scheme: dark)');
    const handleChange = (e: MediaQueryListEvent) => {
      setSystemTheme(e.matches ? 'dark' : 'light');
    };
    mediaQuery.addEventListener('change', handleChange);
    return () => mediaQuery.removeEventListener('change', handleChange);
  }, []);

  const resolvedTheme = useMemo(() => {
    if (theme === 'auto') {
      return systemTheme;
    }
    return theme || 'dark';
  }, [theme, systemTheme]);

  const isDark = resolvedTheme === 'dark';

  if (variant === 'gradient') {
    return (
      <div
        style={{
          width: `${pxSize}px`,
          height: `${pxSize}px`,
          minWidth: `${pxSize}px`,
          minHeight: `${pxSize}px`,
          fontSize: `${fontSize}px`,
          borderRadius: `${borderRadius}px`,
        }}
        className={`inline-flex items-center justify-center font-extrabold text-neutral-900 bg-neutral-100 border border-neutral-300 shadow-xs select-none flex-shrink-0 ${className}`}
      >
        Z
      </div>
    );
  }

  return (
    <div
      style={{
        width: `${pxSize}px`,
        height: `${pxSize}px`,
        minWidth: `${pxSize}px`,
        minHeight: `${pxSize}px`,
        fontSize: `${fontSize}px`,
        borderRadius: `${borderRadius}px`,
      }}
      className={`inline-flex items-center justify-center font-extrabold select-none flex-shrink-0 shadow-xs transition-all duration-150 ${
        isDark
          ? 'bg-white text-neutral-950 border border-white/20'
          : 'bg-neutral-900 text-white border border-neutral-800'
      } ${className}`}
    >
      Z
    </div>
  );
};

