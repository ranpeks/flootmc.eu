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
    // Visual edits are saved to Supabase so they are applied on every page.
    try {
        const { getSiteContent } = await import('./auth.js?v=maintenance-deadline-1');
        const { data: rows } = await getSiteContent();
        const savedDocument = rows?.find((row) => row.key === 'site_editor_document')?.value;
        if (savedDocument) editorDocument = savedDocument;
    } catch (error) {
        console.warn('FlootMC saved page edits could not be loaded:', error);
    }
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
        if (typeof edit.text === 'string') {
            if (Number.isInteger(edit.textNodeIndex)) {
                const textNode = node.childNodes[edit.textNodeIndex];
                if (textNode?.nodeType === Node.TEXT_NODE) textNode.nodeValue = edit.text;
            } else if (node.childElementCount === 0) node.textContent = edit.text;
        }
        if (typeof edit.href === 'string' && isSafeUrl(edit.href)) {
            if (node.matches('a')) node.setAttribute('href', edit.href);
            else if (node.hasAttribute('data-shop-url')) node.dataset.shopUrl = edit.href;
        }
        if (typeof edit.src === 'string' && node.matches('img') && isSafeUrl(edit.src, true)) node.setAttribute('src', edit.src);
        if (typeof edit.alt === 'string' && node.matches('img')) node.setAttribute('alt', edit.alt);
        if (typeof edit.title === 'string') node.setAttribute('title', edit.title);
        if (typeof edit.ariaLabel === 'string') node.setAttribute('aria-label', edit.ariaLabel);
        if (typeof edit.placeholder === 'string' && node.matches('input,textarea')) node.setAttribute('placeholder', edit.placeholder);
        if (typeof edit.backgroundImage === 'string' && isSafeUrl(edit.backgroundImage, true)) {
            node.style.backgroundImage = `url("${edit.backgroundImage.replace(/["\\]/g, '')}")`;
        }
    }
    window.siteContent = content;
} catch (error) {
    console.error('FlootMC site content could not be loaded:', error);
}
