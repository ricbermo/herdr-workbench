export function normalizeProfileState(saved = {}) {
  saved = saved && typeof saved === "object" && !Array.isArray(saved) ? saved : {};
  const profiles = [...new Set(Array.isArray(saved.profiles) ? saved.profiles.filter((name) => typeof name === "string" && name.trim() && name.length <= 32) : [])];
  if (!profiles.length) profiles.push("Work", "Personal");
  return {
    profiles,
    active: profiles.includes(saved.active) ? saved.active : profiles[0],
    assignments: saved.assignments && typeof saved.assignments === "object" && !Array.isArray(saved.assignments) ? saved.assignments : {},
  };
}

export function addProfile(saved, rawName) {
  const state = normalizeProfileState(saved), name = rawName.trim();
  if (!name || name.length > 32 || state.profiles.some((profile) => profile.toLowerCase() === name.toLowerCase())) return null;
  return { ...state, profiles: [...state.profiles, name], active: name };
}

export function renameProfile(saved, profile, rawName) {
  const state = normalizeProfileState(saved), name = rawName.trim();
  if (!state.profiles.includes(profile) || !name || name.length > 32 || state.profiles.some((p) => p !== profile && p.toLowerCase() === name.toLowerCase())) return null;
  return {
    ...state,
    profiles: state.profiles.map((p) => p === profile ? name : p),
    active: state.active === profile ? name : state.active,
    assignments: Object.fromEntries(Object.entries(state.assignments).map(([id, p]) => [id, p === profile ? name : p])),
  };
}

export function deleteProfile(saved, profile) {
  const state = normalizeProfileState(saved), profiles = state.profiles.filter((p) => p !== profile);
  if (profiles.length === state.profiles.length || !profiles.length) return null;
  const fallback = profiles.includes("Work") ? "Work" : profiles[0];
  return {
    ...state,
    profiles,
    active: state.active === profile ? fallback : state.active,
    assignments: Object.fromEntries(Object.entries(state.assignments).map(([id, p]) => [id, p === profile ? fallback : p])),
  };
}

export function assignUnassignedSpaces(saved, spaces) {
  const state = normalizeProfileState(saved);
  state.assignments = { ...state.assignments };
  for (const space of spaces) if (!state.profiles.includes(state.assignments[space.id])) state.assignments[space.id] = state.active;
  return state;
}
