// Only the admin (rep 1) or root can add / edit groups (and change their CSF setting).
export const canManageGroups = (user) => !!(user?.root || user?.role?.rep === 1);