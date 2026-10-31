import type { UserRole } from '../modules/users/users.constants';

declare global {
  namespace Express {
    /** Minimal, safe view of the authenticated user attached by `authenticate`. */
    interface AuthUser {
      id: string;
      email: string;
      name: string;
      role: UserRole;
    }

    interface Request {
      user?: AuthUser;
    }
  }
}

export {};
