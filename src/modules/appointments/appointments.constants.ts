export const APPOINTMENT_STATUSES = ['pending', 'confirmed', 'in-progress', 'completed', 'cancelled'] as const;
export type AppointmentStatus = (typeof APPOINTMENT_STATUSES)[number];

export const APPOINTMENT_TYPES = ['initial-consultation', 'follow-up', 'expert-report', 'assessment', 'training-session', 'other'] as const;
export type AppointmentType = (typeof APPOINTMENT_TYPES)[number];
