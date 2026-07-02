import { conditionIdFromApiValue, getCondition } from '../conditions';
import { applyRemoteProfile } from '../profile';
import { createClient, isSupabaseConfigured } from './client';

const PROFILE_COLUMNS_FULL = 'id, email, full_name, condition, age, sex';
const PROFILE_COLUMNS_BASE = 'id, email, full_name, condition';

function isMissingColumnError(error) {
  const message = String(error?.message || '').toLowerCase();
  return (
    error?.code === '42703'
    || message.includes('does not exist')
    || message.includes('schema cache')
  );
}

async function fetchProfileRow(supabase, userId) {
  let result = await supabase
    .from('profiles')
    .select(PROFILE_COLUMNS_FULL)
    .eq('id', userId)
    .maybeSingle();

  if (result.error && isMissingColumnError(result.error)) {
    result = await supabase
      .from('profiles')
      .select(PROFILE_COLUMNS_BASE)
      .eq('id', userId)
      .maybeSingle();
  }

  return result;
}

function rowToProfile(data, userId) {
  if (!data?.condition) return null;

  const conditionId = conditionIdFromApiValue(data.condition);
  if (!conditionId) return null;

  return {
    conditionId,
    patientName: data.full_name || 'Patient',
    age: data.age ?? undefined,
    sex: data.sex === 0 || data.sex === 1 ? data.sex : undefined,
    userId,
    email: data.email ?? undefined,
  };
}

export async function fetchProfileFromSupabase(userId) {
  if (!userId || !isSupabaseConfigured()) return null;

  const supabase = createClient();
  if (!supabase) return null;

  const { data, error } = await fetchProfileRow(supabase, userId);

  if (error) {
    console.warn('Profile fetch failed:', error.message);
    return null;
  }

  return rowToProfile(data, userId);
}

/** Pull cloud profile into localStorage (for new devices / after login). */
export async function hydrateProfileFromSupabase(userId) {
  const remote = await fetchProfileFromSupabase(userId);
  if (!remote) return null;
  return applyRemoteProfile(remote);
}

export async function syncProfileToSupabase(profile, userId, email = null) {
  if (!userId || !profile?.conditionId || !isSupabaseConfigured()) {
    return { ok: false, error: 'Missing user, profile, or Supabase config' };
  }

  const supabase = createClient();
  if (!supabase) return { ok: false, error: 'Supabase client unavailable' };
  const condition = getCondition(profile.conditionId);

  const baseRow = {
    id: userId,
    full_name: profile.patientName || 'Patient',
    condition: condition?.apiValue || profile.conditionId,
    updated_at: new Date().toISOString(),
  };
  if (email) baseRow.email = email;

  const fullRow = { ...baseRow };
  if (Number.isFinite(profile.age)) fullRow.age = profile.age;
  if (profile.sex === 0 || profile.sex === 1) fullRow.sex = profile.sex;

  let { error } = await supabase.from('profiles').upsert(fullRow, { onConflict: 'id' });

  if (error && isMissingColumnError(error) && ('age' in fullRow || 'sex' in fullRow)) {
    ({ error } = await supabase.from('profiles').upsert(baseRow, { onConflict: 'id' }));
  }

  if (error) {
    console.warn('Profile sync failed:', error.message);
    return { ok: false, error: error.message };
  }
  return { ok: true };
}
