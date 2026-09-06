document.addEventListener('DOMContentLoaded', async () => {
    const btnOpen = document.getElementById('btn-open');
    const coverPage = document.getElementById('cover-page');
    const weddingMusic = document.getElementById('wedding-music');
    const musicToggle = document.getElementById('music-toggle');
    const navMenuToggle = document.getElementById('nav-menu-toggle');
    const navigationSheet = document.getElementById('navigation-sheet');
    const navigationBackdrop = document.getElementById('navigation-backdrop');
    const navigationClose = document.getElementById('navigation-close');
    const navigationLinks = [...document.querySelectorAll('[data-nav-target]')];
    let navigationCloseTimer;
    document.body.style.overflow = 'hidden';

    btnOpen?.addEventListener('click', async () => {
        coverPage?.classList.add('cover-slide-up');
        document.body.style.overflow = 'auto';
        musicToggle.hidden = false;
        navMenuToggle.hidden = false;
        try {
            await weddingMusic.play();
        } catch {
            updateMusicButton(false);
        }
    });

    function openNavigation() {
        clearTimeout(navigationCloseTimer);
        navigationSheet.hidden = false;
        navigationBackdrop.hidden = false;
        document.body.classList.add('navigation-open');
        navMenuToggle.setAttribute('aria-expanded', 'true');
        requestAnimationFrame(() => {
            navigationSheet.classList.add('is-open');
            navigationBackdrop.classList.add('is-open');
            navigationLinks[0].focus();
        });
    }

    function closeNavigation({ restoreFocus = true } = {}) {
        navigationSheet.classList.remove('is-open');
        navigationBackdrop.classList.remove('is-open');
        document.body.classList.remove('navigation-open');
        navMenuToggle.setAttribute('aria-expanded', 'false');
        const finish = () => {
            navigationSheet.hidden = true;
            navigationBackdrop.hidden = true;
            if (restoreFocus) navMenuToggle.focus();
        };
        if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) finish();
        else navigationCloseTimer = setTimeout(finish, 260);
    }

    navMenuToggle?.addEventListener('click', openNavigation);
    navigationClose?.addEventListener('click', () => closeNavigation());
    navigationBackdrop?.addEventListener('click', () => closeNavigation());
    navigationLinks.forEach((link) => link.addEventListener('click', (event) => {
        event.preventDefault();
        const target = document.getElementById(link.dataset.navTarget);
        closeNavigation({ restoreFocus: false });
        const behavior = window.matchMedia('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth';
        setTimeout(() => target?.scrollIntoView({ behavior, block: 'start' }), 50);
    }));

    document.addEventListener('keydown', (event) => {
        if (navigationSheet.hidden) return;
        if (event.key === 'Escape') {
            event.preventDefault();
            closeNavigation();
            return;
        }
        if (event.key !== 'Tab') return;
        const focusable = [navigationClose, ...navigationLinks];
        const first = focusable[0];
        const last = focusable.at(-1);
        if (event.shiftKey && document.activeElement === first) {
            event.preventDefault(); last.focus();
        } else if (!event.shiftKey && document.activeElement === last) {
            event.preventDefault(); first.focus();
        }
    });

    const sectionObserver = new IntersectionObserver((entries) => {
        entries.forEach((entry) => {
            if (!entry.isIntersecting) return;
            navigationLinks.forEach((link) => {
                const active = link.dataset.navTarget === entry.target.id;
                link.classList.toggle('active', active);
                if (active) link.setAttribute('aria-current', 'page');
                else link.removeAttribute('aria-current');
            });
        });
    }, { rootMargin: '-30% 0px -55% 0px', threshold: 0 });
    ['beranda', 'mempelai', 'lokasi', 'rsvp'].forEach((id) => sectionObserver.observe(document.getElementById(id)));

    musicToggle?.addEventListener('click', async () => {
        if (weddingMusic.paused) {
            try {
                await weddingMusic.play();
            } catch {
                updateMusicButton(false);
            }
        } else {
            weddingMusic.pause();
        }
    });

    weddingMusic?.addEventListener('play', () => updateMusicButton(true));
    weddingMusic?.addEventListener('pause', () => updateMusicButton(false));

    function updateMusicButton(isPlaying) {
        const icon = musicToggle.querySelector('.music-toggle-icon');
        icon.textContent = isPlaying ? '❚❚' : '▶';
        musicToggle.setAttribute('aria-label', isPlaying ? 'Jeda musik' : 'Putar musik');
        musicToggle.setAttribute('aria-pressed', String(isPlaying));
        musicToggle.classList.toggle('is-paused', !isPlaying);
    }

    const observer = new IntersectionObserver((entries) => {
        entries.forEach((entry) => {
            if (entry.isIntersecting) {
                entry.target.classList.add('visible');
                observer.unobserve(entry.target);
            }
        });
    }, { root: null, rootMargin: '0px', threshold: 0.15 });

    document.querySelectorAll('.fade-in').forEach((element) => observer.observe(element));

    try {
        const config = await requestJson('/api/config');
        applyConfig(config);
        startCountdown(config.wedding.countdownTarget);
    } catch (error) {
        console.error('Gagal memuat konfigurasi undangan:', error);
        document.getElementById('countdown').textContent = 'Gagal memuat waktu acara';
    }

    try {
        const { images } = await requestJson('/api/gallery');
        renderGallery(images);
    } catch {
        document.getElementById('galeri').hidden = true;
    }

    document.addEventListener('click', async (event) => {
        const button = event.target.closest('.copy-btn');
        if (!button) return;
        try {
            await copyText(button.dataset.copy);
            const originalText = button.textContent;
            button.textContent = 'Tersalin!';
            button.classList.add('copied');
            setTimeout(() => {
                button.textContent = originalText;
                button.classList.remove('copied');
            }, 2000);
        } catch {
            button.textContent = 'Gagal menyalin';
        }
    });

    const rsvpForm = document.getElementById('rsvp-form');
    const submitButton = document.getElementById('rsvp-submit');
    const feedback = document.getElementById('rsvp-feedback');
    const wishesContainer = document.getElementById('wishes-container');
    const loadMoreButton = document.getElementById('wishes-load-more');
    const personalizedGuestName = getGuestNameFromUrl();
    let nextCursor = null;

    if (personalizedGuestName) {
        const guestNameInput = document.getElementById('guest-name');
        document.getElementById('guest-name-cover').textContent = personalizedGuestName;
        guestNameInput.value = personalizedGuestName;
        guestNameInput.defaultValue = personalizedGuestName;
    }

    async function loadWishes(reset = false) {
        const params = new URLSearchParams({ limit: '5' });
        if (!reset && nextCursor) params.set('before', String(nextCursor));
        loadMoreButton.disabled = true;
        loadMoreButton.textContent = 'Memuat...';
        try {
            const page = await requestJson(`/api/wishes?${params}`);
            renderWishPage(wishesContainer, page.wishes, reset);
            nextCursor = page.nextCursor;
            loadMoreButton.hidden = !page.hasMore;
        } finally {
            loadMoreButton.disabled = false;
            loadMoreButton.textContent = 'Muat Lebih Banyak';
        }
    }

    try {
        await loadWishes(true);
    } catch {
        wishesContainer.innerHTML = '<p class="wishes-state">Ucapan belum dapat dimuat.</p>';
        loadMoreButton.hidden = true;
    }

    loadMoreButton?.addEventListener('click', async () => {
        try {
            await loadWishes();
        } catch {
            feedback.textContent = 'Ucapan berikutnya gagal dimuat. Silakan coba lagi.';
            feedback.className = 'form-feedback form-feedback-error';
        }
    });

    rsvpForm?.addEventListener('submit', async (event) => {
        event.preventDefault();
        feedback.textContent = '';
        submitButton.disabled = true;
        submitButton.textContent = 'Mengirim...';

        try {
            await requestJson('/api/wishes', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    name: document.getElementById('guest-name').value,
                    attendance: document.getElementById('guest-status').value,
                    message: document.getElementById('guest-message').value
                })
            });
            rsvpForm.reset();
            feedback.textContent = 'Ucapan berhasil dikirim.';
            feedback.className = 'form-feedback form-feedback-success';
            try {
                await loadWishes(true);
            } catch {
                feedback.textContent = 'Ucapan tersimpan, tetapi daftar belum dapat diperbarui.';
            }
        } catch (error) {
            feedback.textContent = error.message || 'Ucapan gagal dikirim. Silakan coba lagi.';
            feedback.className = 'form-feedback form-feedback-error';
        } finally {
            submitButton.disabled = false;
            submitButton.textContent = 'Kirim Ucapan';
        }
    });
});

async function requestJson(url, options) {
    const response = await fetch(url, options);
    const result = await response.json().catch(() => ({}));
    if (!response.ok) throw new Error(result.error || 'Terjadi kesalahan. Silakan coba lagi.');
    return result;
}

function applyConfig(config) {
    const { groom, bride } = config.couple;
    const coupleNames = `${groom.shortName} & ${bride.shortName}`;
    document.title = `Undangan Pernikahan | ${coupleNames}`;
    document.getElementById('page-description').content = `Undangan Pernikahan Digital ${coupleNames}`;
    document.querySelectorAll('[data-couple-names]').forEach((node) => { node.textContent = coupleNames; });

    const groomInitial = (groom.shortName || groom.name || 'B').trim().charAt(0).toUpperCase();
    const brideInitial = (bride.shortName || bride.name || 'W').trim().charAt(0).toUpperCase();
    const initials = `${groomInitial} & ${brideInitial}`;
    document.querySelectorAll('[data-groom-initial]').forEach((node) => { node.textContent = groomInitial; });
    document.querySelectorAll('[data-bride-initial]').forEach((node) => { node.textContent = brideInitial; });
    document.querySelectorAll('[data-couple-initials]').forEach((node) => { node.textContent = initials; });
    document.querySelectorAll('[data-cover-full-names]').forEach((node) => { node.textContent = `Undangan Pernikahan ${coupleNames}`; });

    setText('groom-name', groom.name);
    setText('bride-name', bride.name);
    setInstagram('groom-instagram', groom);
    setInstagram('bride-instagram', bride);
    document.getElementById('groom-portrait').alt = groom.name;
    document.getElementById('bride-portrait').alt = bride.name;

    const akadDate = formatEventDate(config.events[0].date);
    const shortDate = akadDate.replace(/^\p{L}+,\s*/u, '');
    document.querySelectorAll('[data-wedding-date]').forEach((node) => { node.textContent = shortDate; });

    document.querySelectorAll('[data-event-index]').forEach((card) => {
        const event = config.events[Number(card.dataset.eventIndex)];
        if (!event) return;
        card.querySelector('[data-event-type]').textContent = event.type;
        card.querySelector('[data-event-date]').textContent = formatEventDate(event.date);
        card.querySelector('[data-event-time]').textContent = event.time;
        card.querySelector('[data-event-venue]').textContent = event.venue;
        card.querySelector('[data-event-address]').textContent = event.address;
        card.querySelector('[data-event-map]').href = event.mapUrl;
    });

    document.querySelectorAll('[data-account-index]').forEach((card) => {
        const account = config.accounts[Number(card.dataset.accountIndex)];
        if (!account) return;
        card.querySelector('[data-bank-name]').textContent = account.bank;
        card.querySelector('[data-account-number]').textContent = account.number;
        card.querySelector('[data-account-holder]').textContent = `a.n ${account.holder}`;
        card.querySelector('.copy-btn').dataset.copy = account.number;
    });
}

function getGuestNameFromUrl() {
    const guestName = new URLSearchParams(window.location.search).get('to')?.trim();
    return guestName && guestName.length <= 100 ? guestName : null;
}

function renderGallery(images) {
    const section = document.getElementById('galeri');
    const grid = document.getElementById('gallery-grid');
    grid.replaceChildren();
    section.hidden = images.length === 0;
    images.forEach((image, index) => {
        const figure = document.createElement('figure');
        figure.className = `gallery-item fade-in visible${index === 0 ? ' gallery-wide' : ''}`;
        const element = document.createElement('img');
        element.src = image.url;
        element.alt = `Foto galeri pernikahan ${index + 1}`;
        element.loading = 'lazy';
        element.decoding = 'async';
        figure.append(element);
        grid.append(figure);
    });
}

function formatEventDate(value) {
    return new Intl.DateTimeFormat('id-ID', {
        weekday: 'long', day: 'numeric', month: 'long', year: 'numeric', timeZone: 'UTC'
    }).format(new Date(`${value}T00:00:00Z`));
}

function setText(id, value) {
    document.getElementById(id).textContent = value;
}

function setInstagram(id, person) {
    const link = document.getElementById(id);
    link.textContent = person.instagram.handle;
    link.href = person.instagram.url;
    link.setAttribute('aria-label', `Instagram ${person.name}`);
}

function startCountdown(target) {
    const countdownDate = Date.parse(target);
    const update = () => {
        const distance = countdownDate - Date.now();
        if (distance < 0) {
            document.getElementById('countdown').textContent = 'Acara Sedang Berlangsung / Selesai';
            return false;
        }
        const units = {
            days: Math.floor(distance / 86400000),
            hours: Math.floor((distance % 86400000) / 3600000),
            minutes: Math.floor((distance % 3600000) / 60000),
            seconds: Math.floor((distance % 60000) / 1000)
        };
        Object.entries(units).forEach(([id, value]) => {
            const element = document.getElementById(id);
            if (element) element.textContent = String(value).padStart(2, '0');
        });
        return true;
    };
    if (update()) {
        const timer = setInterval(() => { if (!update()) clearInterval(timer); }, 1000);
    }
}

function renderWishPage(container, wishes, reset) {
    if (reset) container.replaceChildren();
    if (reset && !wishes.length) {
        container.innerHTML = '<p class="wishes-state">Belum ada ucapan. Jadilah yang pertama.</p>';
        return;
    }
    container.querySelector('.wishes-state')?.remove();
    wishes.forEach((wish) => container.append(createWishElement(wish)));
}

function createWishElement(wish) {
    const article = document.createElement('article');
    article.className = 'wish-card fade-in visible';
    const header = document.createElement('div');
    const title = document.createElement('h4');
    const badge = document.createElement('span');
    const message = document.createElement('p');
    const time = document.createElement('small');

    title.textContent = wish.name;
    badge.className = wish.attendance === 'HADIR' ? 'badge badge-success' : 'badge badge-danger';
    badge.textContent = wish.attendance === 'HADIR' ? 'Hadir' : 'Tidak Hadir';
    message.textContent = wish.message;
    time.textContent = formatRelativeTime(wish.createdAt);
    header.append(title, badge);
    article.append(header, message, time);
    return article;
}

function formatRelativeTime(value) {
    const seconds = Math.max(0, Math.floor((Date.now() - Date.parse(value)) / 1000));
    if (seconds < 60) return 'Baru saja';
    if (seconds < 3600) return `${Math.floor(seconds / 60)} menit yang lalu`;
    if (seconds < 86400) return `${Math.floor(seconds / 3600)} jam yang lalu`;
    return `${Math.floor(seconds / 86400)} hari yang lalu`;
}

function copyText(text) {
    if (navigator.clipboard && window.isSecureContext) return navigator.clipboard.writeText(text);
    const textarea = document.createElement('textarea');
    textarea.value = text;
    textarea.setAttribute('readonly', '');
    textarea.style.position = 'fixed';
    textarea.style.opacity = '0';
    document.body.appendChild(textarea);
    textarea.select();
    document.execCommand('copy');
    textarea.remove();
    return Promise.resolve();
}
