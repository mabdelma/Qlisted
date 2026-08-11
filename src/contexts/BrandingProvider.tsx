import { useEffect, useRef, type ReactNode } from 'react';

export function lightenColor(hex: string, percent: number): string {
  const num = parseInt(hex.replace('#', ''), 16);
  const R = Math.min(255, (num >> 16) + Math.round(2.55 * percent));
  const G = Math.min(255, ((num >> 8) & 0x00ff) + Math.round(2.55 * percent));
  const B = Math.min(255, (num & 0x0000ff) + Math.round(2.55 * percent));
  return `rgb(${R}, ${G}, ${B})`;
}

interface BrandingProviderProps {
  primaryColor?: string | null;
  accentColor?: string | null;
  logoUrl?: string | null;
  faviconUrl?: string | null;
  children: ReactNode;
}

export function BrandingProvider({ primaryColor, accentColor, faviconUrl, children }: BrandingProviderProps) {
  const metaRef = useRef<HTMLMetaElement | null>(null);
  const faviconRef = useRef<HTMLLinkElement | null>(null);

  useEffect(() => {
    const root = document.documentElement;
    const p = primaryColor || '#0f766e';
    const a = accentColor || '#1e3a5f';
    root.style.setProperty('--color-brand', p);
    root.style.setProperty('--color-brand-hover', a);
    root.style.setProperty('--color-brand-light', lightenColor(p, 60));

    if (!metaRef.current) {
      let meta = document.querySelector('meta[name="theme-color"]') as HTMLMetaElement | null;
      if (!meta) {
        meta = document.createElement('meta');
        meta.name = 'theme-color';
        document.head.appendChild(meta);
      }
      metaRef.current = meta;
    }
    metaRef.current.content = p;
  }, [primaryColor, accentColor]);

  useEffect(() => {
    if (faviconUrl) {
      let link = document.querySelector('link[rel="icon"]') as HTMLLinkElement | null;
      if (!link) {
        link = document.createElement('link');
        link.rel = 'icon';
        document.head.appendChild(link);
      }
      link.href = faviconUrl;
      faviconRef.current = link;
    }
  }, [faviconUrl]);

  return <>{children}</>;
}
