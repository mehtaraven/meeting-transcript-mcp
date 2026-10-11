// Extend Express Request to include the authenticated user
// This is populated by the authenticateUser middleware in middleware/auth.ts
declare namespace Express {
  interface Request {
    user?: {
      id: string;
      email: string;
    };
  }
}
