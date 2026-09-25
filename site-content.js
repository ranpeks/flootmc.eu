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
    let editorDocument = content.site_editor_document ?? {};
    if (typeof editorDocument === 'string') {
        try { editorDocument = JSON.parse(editorDocument); }
        catch { editorDocument = {}; }
    }
    const pagePath = (window.location.pathname.replace(/index\.html$/, '') || '/').replace(/\/?$/, '/');
    const pageEdits = editorDocument?.[pagePath] ?? {};
    const isSafeUrl = (value, image = false) => {
        if (typeof value !== 'string' || !value.trim()) return false;
        try {
            const url = new URL(value.trim(), window.location.href);
            return image ? ['https:', 'http:'].includes(url.protocol) : ['https:', 'http:', 'mailto:', 'tel:'].includes(url.protocol);
        } catch { return false; }
    };
    for (const [path, edit] of Object.entries(pageEdits)) {
        const indices = path.split('.').map(Number);
        let node = document.body;
        for (const index of indices) node = node?.childNodes[index];
        if (!(node instanceof Element)) continue;
        if (typeof edit.text === 'string' && node.childElementCount === 0) node.textContent = edit.text;
        if (typeof edit.href === 'string' && isSafeUrl(edit.href)) {
            if (node.matches('a')) node.setAttribute('href', edit.href);
            else if (node.hasAttribute('data-shop-url')) node.dataset.shopUrl = edit.href;
        }
        if (typeof edit.src === 'string' && node.matches('img') && isSafeUrl(edit.src, true)) node.setAttribute('src', edit.src);
    }
    window.siteContent = content;
} catch (error) {
    console.error('FlootMC site content could not be loaded:', error);
}
