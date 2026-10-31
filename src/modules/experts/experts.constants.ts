export const EXPERT_CATEGORIES = ['psychologist', 'country-forensic', 'training'] as const;
export type ExpertCategory = (typeof EXPERT_CATEGORIES)[number];

export const EXPERT_STATUSES = ['active', 'inactive'] as const;
export type ExpertStatus = (typeof EXPERT_STATUSES)[number];
