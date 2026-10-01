import { useEffect } from 'react';

interface WebVitalMetric {
  name: string;
  value: number;
  rating: 'good' | 'needs-improvement' | 'poor';
}

export function usePerformanceMonitoring() {
  useEffect(() => {
    if (typeof window === 'undefined' || !('PerformanceObserver' in window)) return;

    try {
      const lcpObserver = new PerformanceObserver((list) => {
        const entries = list.getEntries();
        const lastEntry = entries[entries.length - 1];
        if (lastEntry) {
          const value = lastEntry.startTime;
          const rating = value <= 2500 ? 'good' : value <= 4000 ? 'needs-improvement' : 'poor';
          reportMetric({ name: 'LCP', value: Math.round(value), rating });
        }
      });
      lcpObserver.observe({ type: 'largest-contentful-paint', buffered: true });

      let clsValue = 0;
      const clsObserver = new PerformanceObserver((list) => {
        for (const entry of list.getEntries()) {
          if (!(entry as unknown as Record<string, unknown>).hadRecentInput) {
            clsValue += (entry as unknown as Record<string, unknown>).value as number;
          }
        }
        const rating = clsValue <= 0.1 ? 'good' : clsValue <= 0.25 ? 'needs-improvement' : 'poor';
        reportMetric({ name: 'CLS', value: parseFloat(clsValue.toFixed(3)), rating });
      });
      clsObserver.observe({ type: 'layout-shift', buffered: true });

      const interactionObserver = new PerformanceObserver((list) => {
        for (const entry of list.getEntries()) {
          const value = (entry as unknown as Record<string, unknown>).duration as number;
          const rating = value <= 200 ? 'good' : value <= 500 ? 'needs-improvement' : 'poor';
          reportMetric({ name: (entry as unknown as Record<string, unknown>).entryType === 'first-input' ? 'FID' : 'INP', value: Math.round(value), rating });
        }
      });
      interactionObserver.observe({ type: 'first-input', buffered: true });
      interactionObserver.observe({ type: 'event', durationThreshold: 100, buffered: true } as PerformanceObserverInit);

      return () => {
        lcpObserver.disconnect();
        clsObserver.disconnect();
        interactionObserver.disconnect();
      };
    } catch {
      // PerformanceObserver not supported
    }
  }, []);
}

function reportMetric(metric: WebVitalMetric) {
  if (import.meta.env.DEV) {
    console.debug(`[Web Vital] ${metric.name}: ${metric.value} (${metric.rating})`);
  }
}
