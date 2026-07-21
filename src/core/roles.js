export function oppositeRole(role) {
  return role === 'target' ? 'guesser' : 'target';
}

export function oppositeLoveMode(loveMode) {
  return loveMode === 'boyTarget' ? 'girlTarget' : 'boyTarget';
}

export function createReplayPlan({ role, loveMode, swapRoles = false } = {}) {
  return {
    role: swapRoles ? oppositeRole(role) : role,
    loveMode: swapRoles ? oppositeLoveMode(loveMode) : loveMode,
  };
}
