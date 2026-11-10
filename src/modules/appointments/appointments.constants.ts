export const APPOINTMENT_STATUSES = ['pending', 'confirmed', 'rescheduled', 'in-progress', 'completed', 'cancelled', 'no-show'] as const;
export type AppointmentStatus = (typeof APPOINTMENT_STATUSES)[number];

export const APPOINTMENT_TYPES = ['initial-consultation', 'follow-up', 'expert-report', 'assessment', 'training-session', 'other'] as const;
export type AppointmentType = (typeof APPOINTMENT_TYPES)[number];

export const MEETING_PROVIDERS = ['google-meet', 'zoom', 'teams', 'other'] as const;
export type MeetingProvider = (typeof MEETING_PROVIDERS)[number];
