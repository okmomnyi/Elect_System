/**
 * Role-Based Access Control Middleware
 * Restricts access to routes based on user role
 */

/**
 * Create middleware that requires specific roles
 * @param  {...string} allowedRoles - Roles that can access the route
 * @returns {Function} Express middleware
 */
function requireRole(...allowedRoles) {
  return (req, res, next) => {
    if (!req.user) {
      return res.status(401).json({
        success: false,
        error: 'Authentication required',
      });
    }
    
    const userRole = req.user.role;
    
    if (!allowedRoles.includes(userRole)) {
      return res.status(403).json({
        success: false,
        error: 'Insufficient permissions',
      });
    }
    
    next();
  };
}

/**
 * Require admin or super_admin role
 */
const requireAdmin = requireRole('admin', 'super_admin');

/**
 * Require super_admin role only
 */
const requireSuperAdmin = requireRole('super_admin');

/**
 * Require student role (or higher)
 */
const requireStudent = requireRole('student', 'admin', 'super_admin');

module.exports = {
  requireRole,
  requireAdmin,
  requireSuperAdmin,
  requireStudent,
};
