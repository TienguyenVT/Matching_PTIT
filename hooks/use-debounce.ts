import { useEffect, useState } from 'react';

/**
 * Hook debounce - Delay execution until user stops typing
 * @param value - Value to debounce
 * @param delay - Delay in milliseconds (default: 300ms)
 * @returns Debounced value
 */
export function useDebounce<T>(value: T, delay: number = 300): T {
  const [debouncedValue, setDebouncedValue] = useState<T>(value);

  useEffect(() => {
    // Set timeout to update debounced value after delay
    const handler = setTimeout(() => {
      setDebouncedValue(value);
    }, delay);

    // Cleanup: Cancel timeout if value changes before delay expires
    return () => {
      clearTimeout(handler);
    };
  }, [value, delay]);

  return debouncedValue;
}

/**
 * Hook throttle - Execute at most once per specified interval
 * @param value - Value to throttle
 * @param interval - Minimum interval between updates (default: 300ms)
 * @returns Throttled value
 */
export function useThrottle<T>(value: T, interval: number = 300): T {
  const [throttledValue, setThrottledValue] = useState<T>(value);
  const [lastExecuted, setLastExecuted] = useState<number>(Date.now());

  useEffect(() => {
    const now = Date.now();
    const timeSinceLastExecuted = now - lastExecuted;

    if (timeSinceLastExecuted >= interval) {
      // Enough time has passed, update immediately
      setThrottledValue(value);
      setLastExecuted(now);
    } else {
      // Schedule update after remaining time
      const timeoutId = setTimeout(() => {
        setThrottledValue(value);
        setLastExecuted(Date.now());
      }, interval - timeSinceLastExecuted);

      return () => clearTimeout(timeoutId);
    }
  }, [value, interval, lastExecuted]);

  return throttledValue;
}
