import type { PublicUser } from '../modules/users/user.model';

declare global {
  namespace Express {
    interface Request {
      user?: PublicUser;
    }
  }
}

export {};