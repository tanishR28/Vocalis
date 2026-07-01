const PROFILE_KEY = 'vocalis_patient_profile';

export function getProfile() {
  if (typeof window === 'undefined') return null;
  try {
    const raw = localStorage.getItem(PROFILE_KEY);
    if (!raw) return null;
    const profile = JSON.parse(raw);
    if (!profile?.conditionId) return null;
    return profile;
  } catch {
    return null;
  }
}

export function saveProfile({ conditionId, patientName }) {
  const existing = getProfile();
  const profile = {
    conditionId,
    patientName: (patientName || 'Patient').trim() || 'Patient',
    onboardedAt: existing?.onboardedAt || new Date().toISOString(),
  };
  localStorage.setItem(PROFILE_KEY, JSON.stringify(profile));
  return profile;
}

export function updateProfile(updates) {
  const existing = getProfile();
  if (!existing) return null;
  const profile = {
    ...existing,
    ...updates,
    patientName: (updates.patientName ?? existing.patientName).trim() || 'Patient',
  };
  localStorage.setItem(PROFILE_KEY, JSON.stringify(profile));
  return profile;
}

export function clearProfile() {
  if (typeof window === 'undefined') return;
  localStorage.removeItem(PROFILE_KEY);
}

/** Clear session and return user to onboarding. */
export function exitSession() {
  clearProfile();
  localStorage.removeItem('vocalis_latest_analysis');
  localStorage.removeItem('vocalis_just_updated');
}

export function isOnboardingComplete() {
  return Boolean(getProfile()?.conditionId);
}
