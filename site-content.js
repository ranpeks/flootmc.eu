try {
    const response = await fetch(new URL('./site-content.json', import.meta.url), { cache: 'no-store' });
    if (!response.ok) throw new Error('Nie udało się wczytać treści strony.');
    const content = await response.json();
    for (const element of document.querySelectorAll('[data-site-content]')) {
        const key = element.dataset.siteContent;
        if (!(key in content)) continue;
        if (element.dataset.siteContentAttribute) {
            const attribute = element.dataset.siteContentAttribute;
            const value = content[key];
            if (['href', 'src', 'data-shop-url'].includes(attribute) && !/^(https?:\/\/|\/|\.\.?\/)/i.test(value)) continue;
            element.setAttribute(attribute, value);
            if (attribute === 'data-mc-player') {
                element.src = `https://mc-heads.net/avatar/${encodeURIComponent(value)}/160`;
            }
        } else {
            element.textContent = content[key];
        }
    }
    window.siteContent = content;
} catch (error) {
    console.error('FlootMC site content could not be loaded:', error);
}
