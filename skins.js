(() => {
    const skinVersion = new Date().toISOString().slice(0, 10);

    document.querySelectorAll('[data-mc-player]').forEach((image) => {
        const player = image.dataset.mcPlayer;
        if (!player) return;

        image.src = `https://mc-heads.net/avatar/${encodeURIComponent(player)}/160?updated=${skinVersion}`;
    });
})();
