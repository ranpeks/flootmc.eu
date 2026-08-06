import { createClient } from 'https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2/+esm';

const supabase = createClient(
    'https://mwelwsjtkjolaxjgdzyi.supabase.co',
    'sb_publishable_E9oA-OKDJeHcS0MG8cJlCA_LcKvdoiN'
);

const admins = {
    og_ranpeks: { email: 'og_ranpeks@flootmc.eu', skin: 'OG_Ranpeks', label: 'OG_Ranpeks' },
    betez_x: { email: 'betezx@flootmc.eu', skin: 'Betez68', label: 'Betez_x' },
    x_bartek_x: { email: 'x_bartek_x@flootmc.eu', skin: 'x_Bartek_x', label: 'x_Bartek_x' }
};

const getAdminByEmail = (email) => Object.entries(admins).find(([, admin]) => admin.email === email)?.[1] ?? null;

export async function signIn(nick, password) {
    const admin = admins[nick.trim().toLowerCase()];
    if (!admin) return { error: { message: 'Nieprawidłowy nick administratora.' } };
    return supabase.auth.signInWithPassword({ email: admin.email, password });
}

export async function changePassword(password) {
    return supabase.auth.updateUser({ password });
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
    if (!admin) window.location.replace('logowanie.html');
    return admin;
}

async function renderAccountButton() {
    const admin = await getCurrentAdmin();
    if (!admin || document.querySelector('.account-menu')) return;

    const menu = document.createElement('div');
    menu.className = 'account-menu';
    menu.innerHTML = `
        <button class="account-avatar" type="button" aria-expanded="false" aria-label="Otwórz konto administratora">
            <img src="https://mc-heads.net/avatar/${encodeURIComponent(admin.skin)}/96" alt="Skin ${admin.label}">
        </button>
        <div class="account-dropdown" hidden>
            <strong>${admin.label}</strong>
            <a href="panel.html">Mój profil</a>
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
        window.location.assign('index.html');
    });
}

renderAccountButton();
