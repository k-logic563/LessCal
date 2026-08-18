export const GET_CALENDARS_MESSAGE = 'calendar-presets:get-calendars';
export const APPLY_CALENDAR_PRESET_MESSAGE =
  'calendar-presets:apply-calendar-preset';

export type CalendarIdentifier = {
  attribute: 'data-calendar-id' | 'data-id';
  value: string;
};

export type CalendarDomItem = {
  name: string;
  isVisible: boolean;
  identifier: CalendarIdentifier | null;
  isSelf: true | null;
};

export type CalendarDomDiagnostics = {
  matchedToggleCount: number;
  calendarsWithIdentifier: number;
  signedInAccountVisible: boolean;
};

export type GetCalendarsMessage = {
  type: typeof GET_CALENDARS_MESSAGE;
};

export type ApplyCalendarPresetMessage = {
  type: typeof APPLY_CALENDAR_PRESET_MESSAGE;
  calendarIds: string[];
};

export type GetCalendarsResponse =
  | {
      ok: true;
      calendars: CalendarDomItem[];
      diagnostics: CalendarDomDiagnostics;
    }
  | {
      ok: false;
      error: string;
    };

export type ApplyCalendarPresetResponse =
  | {
      ok: true;
      changedCalendarCount: number;
      missingCalendarIds: string[];
    }
  | {
      ok: false;
      error: string;
    };

export type CalendarMessageResponse =
  | GetCalendarsResponse
  | ApplyCalendarPresetResponse;

export function isGetCalendarsMessage(
  message: unknown,
): message is GetCalendarsMessage {
  return (
    typeof message === 'object' &&
    message !== null &&
    'type' in message &&
    message.type === GET_CALENDARS_MESSAGE
  );
}

export function isApplyCalendarPresetMessage(
  message: unknown,
): message is ApplyCalendarPresetMessage {
  return (
    typeof message === 'object' &&
    message !== null &&
    'type' in message &&
    message.type === APPLY_CALENDAR_PRESET_MESSAGE &&
    'calendarIds' in message &&
    Array.isArray(message.calendarIds) &&
    message.calendarIds.every((id) => typeof id === 'string')
  );
}
