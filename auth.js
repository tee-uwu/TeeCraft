// Supabase Authentication & Cloud Progress Saver
const SUPABASE_URL = 'https://ikrjclzzvlwqofrkdihp.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImlrcmpjbHp6dmx3cW9mcmtkaWhwIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODU0MjgzNzAsImV4cCI6MjEwMTAwNDM3MH0.0Hm4xdTvIqHNwXp6S4Gga31AwTbzQ268KV66VXnnBLg';

export let supabase = null;

if (window.supabase) {
    supabase = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
}

export async function getCurrentUser() {
    if (!supabase) return null;
    try {
        const { data: { session } } = await supabase.auth.getSession();
        return session ? session.user : null;
    } catch (e) {
        return null;
    }
}

export async function signUp(email, password) {
    if (!supabase) return { error: { message: 'Supabase SDK not loaded' } };
    const redirectUrl = window.location.origin + window.location.pathname;
    const { data, error } = await supabase.auth.signUp({
        email,
        password,
        options: {
            emailRedirectTo: redirectUrl
        }
    });

    if (!error && data && !data.session) {
        // Try auto-login in case email confirmation is turned off in Supabase
        const loginRes = await supabase.auth.signInWithPassword({ email, password });
        if (!loginRes.error && loginRes.data.session) {
            return { data: loginRes.data, error: null };
        }
    }
    return { data, error };
}

export async function signIn(email, password) {
    if (!supabase) return { error: { message: 'Supabase SDK not loaded' } };
    const { data, error } = await supabase.auth.signInWithPassword({ email, password });
    return { data, error };
}

export async function signInWithGoogle() {
    if (!supabase) return { error: { message: 'Supabase SDK not loaded' } };
    const redirectUrl = window.location.origin + window.location.pathname;
    const { data, error } = await supabase.auth.signInWithOAuth({
        provider: 'google',
        options: {
            redirectTo: redirectUrl
        }
    });
    return { data, error };
}

export async function signOut() {
    if (!supabase) return;
    await supabase.auth.signOut();
}

export async function saveProgressToCloud(saveData) {
    const user = await getCurrentUser();
    if (!user) return false;

    try {
        // Try saving to player_saves table
        const { error } = await supabase
            .from('player_saves')
            .upsert({
                user_id: user.id,
                save_data: saveData,
                updated_at: new Date().toISOString()
            }, { onConflict: 'user_id' });

        if (error) {
            // Fallback to Auth User Metadata
            await supabase.auth.updateUser({
                data: { teecraft_save: saveData }
            });
        }
        return true;
    } catch (e) {
        try {
            await supabase.auth.updateUser({
                data: { teecraft_save: saveData }
            });
            return true;
        } catch (err) {
            console.warn('Cloud save failed:', err);
            return false;
        }
    }
}

export async function loadProgressFromCloud() {
    const user = await getCurrentUser();
    if (!user) return null;

    try {
        const { data, error } = await supabase
            .from('player_saves')
            .select('save_data')
            .eq('user_id', user.id)
            .single();

        if (data && data.save_data) {
            return data.save_data;
        }

        if (user.user_metadata && user.user_metadata.teecraft_save) {
            return user.user_metadata.teecraft_save;
        }
        return null;
    } catch (e) {
        if (user.user_metadata && user.user_metadata.teecraft_save) {
            return user.user_metadata.teecraft_save;
        }
        return null;
    }
}
