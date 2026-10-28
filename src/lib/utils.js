/**
 * Utility helpers for CampusBid
 */

/**
 * Format a number as INR currency
 */
export function formatINR(amount) {
  return new Intl.NumberFormat('en-IN', {
    style: 'currency',
    currency: 'INR',
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(amount);
}

/**
 * Get a human-readable time-remaining string from a closing date
 * Returns { text, urgency } where urgency is 'critical' | 'warning' | 'normal'
 */
export function getTimeRemaining(closingAt) {
  const now = Date.now();
  const end = new Date(closingAt).getTime();
  const diff = end - now;

  if (diff <= 0) {
    return { text: 'Ended', urgency: 'ended', totalSeconds: 0 };
  }

  const totalSeconds = Math.floor(diff / 1000);
  const days = Math.floor(totalSeconds / 86400);
  const hours = Math.floor((totalSeconds % 86400) / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;

  let urgency = 'normal';
  if (totalSeconds <= 300) urgency = 'critical';       // 5 min
  else if (totalSeconds <= 3600) urgency = 'warning';   // 1 hour

  let text;
  if (days > 0) {
    text = `${days}d ${hours}h`;
  } else if (hours > 0) {
    text = `${hours}h ${minutes}m`;
  } else if (minutes > 0) {
    text = `${minutes}m ${seconds}s`;
  } else {
    text = `${seconds}s`;
  }

  return { text, urgency, totalSeconds, days, hours, minutes, seconds };
}

/**
 * Build initials from a name string
 */
export function getInitials(name) {
  if (!name) return '?';
  return name
    .split(' ')
    .filter(Boolean)
    .map((w) => w[0])
    .join('')
    .toUpperCase()
    .slice(0, 2);
}

/**
 * Classname merge helper (simple version)
 */
export function cn(...classes) {
  return classes.filter(Boolean).join(' ');
}
