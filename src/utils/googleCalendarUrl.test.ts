import { describe, expect, it } from 'vitest';
import { isGoogleCalendarUrl } from './googleCalendarUrl';

describe('isGoogleCalendarUrl', () => {
  it.each([
    'https://calendar.google.com/',
    'https://calendar.google.com/calendar/u/0/r',
  ])('accepts Google Calendar URL: %s', (url) => {
    expect(isGoogleCalendarUrl(url)).toBe(true);
  });

  it.each([
    undefined,
    'https://example.com/',
    'https://calendar.google.com.example.com/',
    'https://example.com/calendar.google.com/',
    'http://calendar.google.com/',
    'not-a-url',
  ])('rejects non-Google Calendar URL: %s', (url) => {
    expect(isGoogleCalendarUrl(url)).toBe(false);
  });
});
