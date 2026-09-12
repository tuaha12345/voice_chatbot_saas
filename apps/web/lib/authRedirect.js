export function homePathForUser(me) {
  if (!me) return "/login";
  if (me.is_admin) return "/admin";
  if (!me.is_approved) return "/pending";
  return "/dashboard";
}

export function isServiceAllowed(me) {
  return Boolean(me && (me.is_admin || me.is_approved));
}
