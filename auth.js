import { createClient } from 'https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2/+esm';

const SUPABASE_URL = 'https://sawxgllonwjjbmuaddyd.supabase.co';
const SUPABASE_KEY = 'sb_publishable_PETx6WMwU5PGKzKZKQJwgw_P5WUw_i4';

const initialRecoveryHash = window.location.hash;
const supabase = createClient(
    SUPABASE_URL,
    SUPABASE_KEY
);

const admins = {
    admin: { email: 'admin@flootmc.eu', skin: 'admin', label: 'admin' },
    og_ranpeks: { email: 'og_ranpeks@flootmc.eu', skin: 'OG_Ranpeks', label: 'OG_Ranpeks' },
    betez_x: { email: 'betezx@flootmc.eu', skin: 'Betez68', label: 'Betez_x' },
    x_bartek_x: { email: 'x_bartek_x@flootmc.eu', skin: 'x_Bartek_x', label: 'x_Bartek_x' }
};

const getAdminByEmail = (email) => Object.entries(admins).find(([, admin]) => admin.email === email)?.[1] ?? null;

export async function signIn(nick, password) {
    if (nick.trim().length < 3) return { error: { message: 'Nick musi mieć co najmniej 3 znaki.' } };
    if (password.length < 6) return { error: { message: 'Hasło musi mieć co najmniej 6 znaków.' } };
    const admin = admins[nick.trim().toLowerCase()];
    if (!admin) return { error: { message: 'Nieprawidłowy nick administratora.' } };
    return supabase.auth.signInWithPassword({ email: admin.email, password });
}

export async function changePassword(password) {
    if (password.length < 6) return { error: { message: 'Hasło musi mieć co najmniej 6 znaków.' } };
    return supabase.auth.updateUser({ password });
}

export async function sendPasswordReset(nick) {
    if (String(nick ?? '').trim().length < 3) return { error: { message: 'Nick musi mieć co najmniej 3 znaki.' } };
    const recoveryUrl = new URL('/reset-hasla/', window.location.origin);
    recoveryUrl.searchParams.set('recovery', '1');
    try {
        const response = await fetch(`${SUPABASE_URL}/functions/v1/admin-user-management`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', apikey: SUPABASE_KEY },
            body: JSON.stringify({ action: 'request-reset', nick, redirectTo: recoveryUrl.toString() })
        });
        if (!response.ok) return { error: { message: 'Nie udało się wysłać wiadomości.' } };
        const data = await response.json().catch(() => ({}));
        return data.sent === false
            ? { data, error: { message: 'Nie udało się wysłać wiadomości. Spróbuj ponownie za chwilę.' } }
            : { data, error: null };
    } catch (error) {
        return { error };
    }
}

export async function manageUsers(action, user = {}) {
    const { data: { session }, error: sessionError } = await supabase.auth.getSession();
    if (sessionError || !session?.access_token) return { error: sessionError ?? new Error('Zaloguj się ponownie.') };
    try {
        const response = await fetch(`${SUPABASE_URL}/functions/v1/admin-user-management`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                apikey: SUPABASE_KEY,
                Authorization: `Bearer ${session.access_token}`
            },
            body: JSON.stringify({ action, ...user })
        });
        const result = await response.json().catch(() => ({}));
        return response.ok ? { data: result, error: null } : { error: new Error(result.error || 'Nie udało się wykonać operacji.') };
    } catch (error) {
        return { error };
    }
}

export async function getSiteContent() {
    const { data, error } = await supabase.from('site_content').select('key,value').order('key');
    return { data: data ?? [], error };
}

export async function saveSiteContent(key, value) {
    return supabase.from('site_content').upsert({ key, value }, { onConflict: 'key' });
}

export async function signOut() {
    return supabase.auth.signOut();
}

export async function getCurrentAdmin() {
    const { data: { session } } = await supabase.auth.getSession();
    return session?.user?.email ? getAdminByEmail(session.user.email) : null;
}

export async function requireAdmin() {
    const admin = await getCurrentAdmin();
    if (!admin) window.location.replace('/logowanie/');
    return admin;
}

function openPasswordRecoveryForm() {
    if (window.location.pathname.startsWith('/reset-hasla/')) return;

    const recoveryUrl = new URL('/reset-hasla/', window.location.origin);
    recoveryUrl.searchParams.set('recovery', '1');
    recoveryUrl.hash = initialRecoveryHash || window.location.hash;
    window.location.replace(recoveryUrl.toString());
}

supabase.auth.onAuthStateChange((event) => {
    if (event === 'PASSWORD_RECOVERY') openPasswordRecoveryForm();
});

if (new URLSearchParams(initialRecoveryHash.slice(1)).get('type') === 'recovery') {
    openPasswordRecoveryForm();
}

async function renderAccountButton() {
    const admin = await getCurrentAdmin();
    if (!admin || document.querySelector('.account-menu')) return;

    const menu = document.createElement('div');
    menu.className = 'account-menu';
    menu.innerHTML = `
        <button class="account-avatar" type="button" aria-expanded="false" aria-label="Otwórz konto administratora">
            <img src="https://mc-heads.net/avatar/${encodeURIComponent(admin.skin)}/96" alt="Skin ${admin.label}">
            <span class="account-gear" aria-hidden="true">⚙</span>
        </button>
        <div class="account-dropdown" hidden>
            <strong>${admin.label}</strong>
            <a href="/panel/">Panel</a>
            <button type="button" class="account-logout">Wyloguj</button>
        </div>`;
    document.body.append(menu);

    const toggle = menu.querySelector('.account-avatar');
    const dropdown = menu.querySelector('.account-dropdown');
    toggle.addEventListener('click', () => {
        const opened = dropdown.hidden;
        dropdown.hidden = !opened;
        toggle.setAttribute('aria-expanded', String(opened));
    });
    menu.querySelector('.account-logout').addEventListener('click', async () => {
        await signOut();
        window.location.assign('/');
    });
}

renderAccountButton();
