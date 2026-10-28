import { useState, useEffect, useRef } from 'react';
import { getTimeRemaining } from '../lib/utils';

/**
 * Hook that returns a live countdown to the given closing date.
 * Updates every second when urgency is critical, every 10s otherwise.
 */
export function useCountdown(closingAt) {
  const [remaining, setRemaining] = useState(() => getTimeRemaining(closingAt));
  const intervalRef = useRef(null);

  useEffect(() => {
    function tick() {
      const r = getTimeRemaining(closingAt);
      setRemaining(r);
      if (r.totalSeconds <= 0 && intervalRef.current) {
        clearInterval(intervalRef.current);
      }
    }

    tick();
    const delay = remaining.urgency === 'critical' ? 1000 : 1000;
    intervalRef.current = setInterval(tick, delay);

    return () => clearInterval(intervalRef.current);
  }, [closingAt]);

  return remaining;
}
