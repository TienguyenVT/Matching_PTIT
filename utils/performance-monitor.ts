'use client';

interface PerformanceMetrics {
  requests: Map<string, number>;
  duplicates: Map<string, number>;
  cacheHits: number;
  cacheMisses: number;
  startTime: number;
}

class PerformanceMonitor {
  private metrics: PerformanceMetrics = {
    requests: new Map(),
    duplicates: new Map(),
    cacheHits: 0,
    cacheMisses: 0,
    startTime: Date.now(),
  };

  private enabled = process.env.NODE_ENV === 'development';

  trackRequest(url: string, cached: boolean = false) {
    if (!this.enabled) return;

    const key = this.extractKey(url);
    const count = this.metrics.requests.get(key) || 0;
    this.metrics.requests.set(key, count + 1);

    if (count > 0) {
      const dupCount = this.metrics.duplicates.get(key) || 0;
      this.metrics.duplicates.set(key, dupCount + 1);
      
      if (process.env.NODE_ENV === 'development') {
        console.warn(`⚠️ Duplicate request detected: ${key} (${count + 1} times)`);
      }
    }

    if (cached) {
      this.metrics.cacheHits++;
    } else {
      this.metrics.cacheMisses++;
    }
  }

  private extractKey(url: string): string {
    try {
      const urlObj = new URL(url);
      
      // For Supabase requests
      if (urlObj.hostname.includes('supabase')) {
        const match = urlObj.pathname.match(/\/rest\/v1\/(\w+)/);
        if (match) {
          return `supabase:${match[1]}`;
        }
      }
      
      // For internal API routes
      if (url.startsWith('/api/')) {
        return url.split('?')[0];
      }
      
      return urlObj.pathname;
    } catch {
      return url;
    }
  }

  getCacheHitRate(): number {
    const total = this.metrics.cacheHits + this.metrics.cacheMisses;
    if (total === 0) return 0;
    return (this.metrics.cacheHits / total) * 100;
  }

  getDuplicateRate(): number {
    const totalRequests = Array.from(this.metrics.requests.values()).reduce((a, b) => a + b, 0);
    const totalDuplicates = Array.from(this.metrics.duplicates.values()).reduce((a, b) => a + b, 0);
    if (totalRequests === 0) return 0;
    return (totalDuplicates / totalRequests) * 100;
  }

  getReport() {
    const elapsed = (Date.now() - this.metrics.startTime) / 1000;
    
    return {
      totalRequests: Array.from(this.metrics.requests.values()).reduce((a, b) => a + b, 0),
      uniqueEndpoints: this.metrics.requests.size,
      duplicates: Array.from(this.metrics.duplicates.entries()).map(([key, count]) => ({ 
        endpoint: key, 
        duplicateCount: count 
      })),
      cacheHitRate: this.getCacheHitRate().toFixed(2) + '%',
      duplicateRate: this.getDuplicateRate().toFixed(2) + '%',
      timeElapsed: elapsed.toFixed(2) + 's',
    };
  }

  reset() {
    this.metrics = {
      requests: new Map(),
      duplicates: new Map(),
      cacheHits: 0,
      cacheMisses: 0,
      startTime: Date.now(),
    };
  }

  logReport() {
    if (!this.enabled) return;
    
    const report = this.getReport();
    
    console.group('📊 Performance Report');
    console.log('Total Requests:', report.totalRequests);
    console.log('Unique Endpoints:', report.uniqueEndpoints);
    console.log('Cache Hit Rate:', report.cacheHitRate);
    console.log('Duplicate Rate:', report.duplicateRate);
    console.log('Time Elapsed:', report.timeElapsed);
    
    if (report.duplicates.length > 0) {
      console.group('⚠️ Duplicate Requests');
      report.duplicates.forEach(({ endpoint, duplicateCount }) => {
        console.log(`${endpoint}: ${duplicateCount} duplicates`);
      });
      console.groupEnd();
    }
    
    console.groupEnd();
  }
}

// Create singleton instance
const monitor = new PerformanceMonitor();

// Hook into global fetch to track requests (only in dev)
if (typeof window !== 'undefined' && process.env.NODE_ENV === 'development') {
  const originalFetch = window.fetch;
  
  window.fetch = async (...args: Parameters<typeof fetch>) => {
    const url = args[0].toString();
    const cached = args[1]?.cache === 'force-cache';
    
    monitor.trackRequest(url, cached);
    
    return originalFetch(...args);
  };

  // Log report every 30 seconds in dev
  setInterval(() => {
    monitor.logReport();
  }, 30000);
}

export default monitor;
