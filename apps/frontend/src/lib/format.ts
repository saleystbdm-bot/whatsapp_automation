export function formatTime(isoTimestamp: string): string {
  return new Date(isoTimestamp).toLocaleTimeString('en-US', {
    hour: 'numeric',
    minute: '2-digit',
    hour12: true,
  });
}

export function formatDate(isoTimestamp: string): string {
  return new Date(isoTimestamp).toLocaleDateString('en-US', {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  });
}

export function formatStatusLabel(status: string): string {
  return status.replace(/_/g, ' ');
}

/**
 * Formats a bare business-date string (YYYY-MM-DD) without any timezone
 * conversion — the date is a calendar day, not an instant, so it must
 * render the same regardless of the viewer's local timezone.
 */
export function formatDateOnly(dateOnly: string): string {
  const [year, month, day] = dateOnly.split('-').map(Number);
  return new Date(Date.UTC(year, month - 1, day)).toLocaleDateString('en-US', {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
    timeZone: 'UTC',
  });
}
