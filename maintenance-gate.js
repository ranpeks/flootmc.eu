import { getCurrentAdmin, getSiteAvailability } from './auth.js?v=credentials-minimums';

const access = document.documentElement;
const path = window.location.pathname.replace(/index\.html$/, '').replace(/\/$/, '') || '/';
const excludedPaths = new Set(['/panel', '/logowanie', '/reset-hasla']);

if (excludedPaths.has(path)) {
    access.removeAttribute('data-site-access');
} else {
    try {
        const [admin, status] = await Promise.all([getCurrentAdmin(), getSiteAvailability()]);
        const mode = status.data;
        if (admin || (!status.error && mode === 'live')) {
            access.removeAttribute('data-site-access');
        } else {
            showGate(mode === 'disabled' ? 'disabled' : 'maintenance');
        }
    } catch {
        showGate('maintenance');
    }
}

function showGate(mode) {
    const disabled = mode === 'disabled';
    const title = disabled ? 'Strona jest chwilowo wyłączona' : 'Przerwa konserwacyjna';
    const description = disabled
        ? 'FlootMC jest teraz niedostępne. Wróć później, aby sprawdzić, czy strona została ponownie włączona.'
        : 'Pracujemy nad aktualizacją FlootMC. Strona będzie dostępna ponownie po zakończeniu prac.';
    document.title = `${title} — FlootMC`;

    const style = document.createElement('style');
    style.textContent = `
        html[data-site-access="checking"] body { visibility: visible; }
        html[data-site-access="blocked"] body > :not(#site-access-screen) { visibility: hidden !important; }
        #site-access-screen { position: fixed; inset: 0; z-index: 2147483000; display: grid; min-height: 100dvh; place-items: center; padding: 24px; color: #f7f4ff; background: radial-gradient(circle at 18% 18%, rgba(198, 18, 255, .22), transparent 34%), radial-gradient(circle at 88% 82%, rgba(32, 35, 255, .2), transparent 35%), #090712; font-family: Inter, system-ui, sans-serif; text-align: center; }
        #site-access-screen .site-access-card { width: min(560px, 100%); padding: clamp(28px, 7vw, 54px); border: 1px solid rgba(255,255,255,.13); border-radius: 24px; background: rgba(12, 9, 24, .85); box-shadow: 0 30px 100px rgba(0,0,0,.4); }
        #site-access-screen img { width: 82px; height: 82px; object-fit: contain; }
        #site-access-screen .site-access-brand { display: flex; align-items: center; justify-content: center; gap: 12px; margin-bottom: 26px; color: #fff; font-size: 1.2rem; font-weight: 900; }
        #site-access-screen h1 { margin: 0; font-size: clamp(2rem, 7vw, 3rem); line-height: 1.08; }
        #site-access-screen p { margin: 18px 0 28px; color: #c6bed7; font-size: 1.03rem; line-height: 1.65; }
        #site-access-screen a { display: inline-flex; min-height: 46px; align-items: center; justify-content: center; padding: 11px 22px; border-radius: 999px; color: #fff; background: linear-gradient(135deg,#f000ff,#8e00ad); font-weight: 800; text-decoration: none; }
    `;
    document.head.append(style);

    const screen = document.createElement('main');
    screen.id = 'site-access-screen';
    screen.setAttribute('role', 'status');
    screen.innerHTML = `
        <section class="site-access-card" aria-labelledby="site-access-title">
            <div class="site-access-brand"><img src="https://i.imgur.com/WM6NQHV.png" alt=""><span>FlootMC</span></div>
            <h1 id="site-access-title"></h1>
            <p id="site-access-description"></p>
            <a href="/logowanie/">Logowanie administratora</a>
        </section>`;
    screen.querySelector('#site-access-title').textContent = title;
    screen.querySelector('#site-access-description').textContent = description;
    document.documentElement.dataset.siteAccess = 'blocked';
    document.body.append(screen);
}
