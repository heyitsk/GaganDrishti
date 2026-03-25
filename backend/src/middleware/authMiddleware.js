import passport from 'passport';

/**
 * JWT authentication middleware.
 * Protects routes by requiring a valid Bearer token in the Authorization header.
 * On success, populates req.user with the authenticated user document.
 * On failure, returns 401 Unauthorized.
 */
export const requireAuth = passport.authenticate('jwt', { session: false });
