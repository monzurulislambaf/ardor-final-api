export const USER_ROLES = ['user', 'client', 'staff', 'manager', 'admin'] as const;
export type UserRole = (typeof USER_ROLES)[number];

export const USER_STATUSES = ['active', 'inactive', 'suspended'] as const;
export type UserStatus = (typeof USER_STATUSES)[number];

export const DEFAULT_USER_ROLE: UserRole = 'user';
export const DEFAULT_USER_STATUS: UserStatus = 'active';
