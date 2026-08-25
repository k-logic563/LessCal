export function isGoogleCalendarUrl(url: string | undefined): boolean {
  if (!url) return false;

  try {
    const parsedUrl = new URL(url);
    return (
      parsedUrl.protocol === 'https:' &&
      parsedUrl.hostname === 'calendar.google.com'
    );
  } catch {
    return false;
  }
}
