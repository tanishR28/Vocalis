const PROFILE_KEY = 'vocalis_patient_profile';
export const PROFILE_CHANGED = 'vocalis_profile_changed';

function notifyProfileChange() {
  if (typeof window !== 'undefined') {
    window.dispatchEvent(new Event(PROFILE_CHANGED));
  }
}

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

function normalizeAge(age) {
  const n = Number(age);
  if (!Number.isFinite(n)) return null;
  return Math.max(18, Math.min(100, Math.round(n)));
}

function normalizeSex(sex) {
  if (sex === 0 || sex === 1 || sex === '0' || sex === '1') return Number(sex);
  return null;
}

export function saveProfile({ conditionId, patientName, age, sex, userId }) {
  const existing = getProfile();
  const profile = {
    conditionId,
    patientName: (patientName || 'Patient').trim() || 'Patient',
    onboardedAt: existing?.onboardedAt || new Date().toISOString(),
  };
  const normalizedAge = normalizeAge(age ?? existing?.age);
  const normalizedSex = normalizeSex(sex ?? existing?.sex);
  if (normalizedAge !== null) profile.age = normalizedAge;
  if (normalizedSex !== null) profile.sex = normalizedSex;
  const resolvedUserId = userId ?? existing?.userId;
  if (resolvedUserId) profile.userId = resolvedUserId;
  localStorage.setItem(PROFILE_KEY, JSON.stringify(profile));
  notifyProfileChange();
  return profile;
}

export function linkUserToProfile(userId) {
  const existing = getProfile();
  if (!existing || !userId) return existing;
  const profile = { ...existing, userId };
  localStorage.setItem(PROFILE_KEY, JSON.stringify(profile));
  notifyProfileChange();
  return profile;
}

/** Apply a profile row fetched from Supabase (merges with existing local age/sex). */
export function applyRemoteProfile(remote) {
  if (!remote?.conditionId || !remote?.userId) return null;
  const existing = getProfile();
  return saveProfile({
    conditionId: remote.conditionId,
    patientName: remote.patientName,
    age: remote.age ?? existing?.age,
    sex: remote.sex ?? existing?.sex,
    userId: remote.userId,
  });
}

export function updateProfile(updates) {
  const existing = getProfile();
  if (!existing) return null;
  const profile = {
    ...existing,
    ...updates,
    patientName: (updates.patientName ?? existing.patientName).trim() || 'Patient',
  };
  if ('age' in updates) {
    const a = normalizeAge(updates.age);
    if (a !== null) profile.age = a;
    else delete profile.age;
  }
  if ('sex' in updates) {
    const s = normalizeSex(updates.sex);
    if (s !== null) profile.sex = s;
    else delete profile.sex;
  }
  localStorage.setItem(PROFILE_KEY, JSON.stringify(profile));
  notifyProfileChange();
  return profile;
}

export function clearProfile() {
  if (typeof window === 'undefined') return;
  localStorage.removeItem(PROFILE_KEY);
}

export function exitSession() {
  clearProfile();
  localStorage.removeItem('vocalis_latest_analysis');
  localStorage.removeItem('vocalis_just_updated');
}

export function isOnboardingComplete() {
  return Boolean(getProfile()?.conditionId);
}

export function hasParkinsonDemographics(profile) {
  if (!profile) return false;
  return Number.isFinite(profile.age) && (profile.sex === 0 || profile.sex === 1);
}
