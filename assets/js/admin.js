document.addEventListener('DOMContentLoaded', async () => {
    const loginView = document.getElementById('login-view');
    const dashboardView = document.getElementById('dashboard-view');
    const loginForm = document.getElementById('login-form');
    const loginFeedback = document.getElementById('login-feedback');
    const settingsForm = document.getElementById('settings-form');
    let settingsLoaded = false;
    let galleryLoaded = false;
    let galleryImages = [];

    async function requestJson(url, options) {
        let response;
        try {
            response = await fetch(url, options);
        } catch {
            throw new Error('Tidak dapat terhubung ke server. Periksa koneksi lalu coba lagi.');
        }
        const responseText = await response.text();
        let result = {};
        try { result = responseText ? JSON.parse(responseText) : {}; } catch {}
        if (!response.ok) throw new Error(result.error || `Server menolak permintaan (HTTP ${response.status}).`);
        return result;
    }

    function showDashboard() {
        loginView.hidden = true;
        dashboardView.hidden = false;
        setTimeout(() => activateTab(location.hash.slice(1) || 'generator'), 0);
    }

    async function activateTab(tabName) {
        const selected = document.querySelector(`.tab-button[data-tab="${tabName}"]`) || document.querySelector('.tab-button[data-tab="generator"]');
        document.querySelectorAll('.tab-button').forEach((item) => item.classList.toggle('active', item === selected));
        document.querySelectorAll('.tab-panel').forEach((panel) => { panel.hidden = panel.id !== `tab-${selected.dataset.tab}`; });
        if (selected.dataset.tab === 'settings' && !settingsLoaded) await loadSettings();
        if (selected.dataset.tab === 'gallery' && !galleryLoaded) await loadGallery();
    }

    try {
        const session = await requestJson('/api/admin/session');
        if (session.authenticated) showDashboard();
    } catch {}

    loginForm.addEventListener('submit', async (event) => {
        event.preventDefault();
        loginFeedback.textContent = 'Memeriksa...';
        try {
            await requestJson('/api/admin/login', {
                method: 'POST', headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ key: document.getElementById('admin-key').value })
            });
            loginForm.reset();
            loginFeedback.textContent = '';
            showDashboard();
        } catch (error) {
            loginFeedback.textContent = error.message;
            loginFeedback.className = 'feedback error';
        }
    });

    document.getElementById('logout-button').addEventListener('click', async () => {
        await requestJson('/api/admin/logout', { method: 'POST' }).catch(() => {});
        location.reload();
    });

    document.querySelectorAll('.tab-button').forEach((button) => button.addEventListener('click', async () => {
        history.replaceState(null, '', `#${button.dataset.tab}`);
        await activateTab(button.dataset.tab);
    }));

    const linkForm = document.getElementById('link-form');
    const generatedLink = document.getElementById('generated-link');
    const copyLink = document.getElementById('copy-link');
    const previewLink = document.getElementById('preview-link');
    const linkFeedback = document.getElementById('link-feedback');
    linkForm.addEventListener('submit', (event) => {
        event.preventDefault();
        const name = document.getElementById('link-guest-name').value.trim();
        if (!name || name.length > 100) return;
        const url = new URL('/', window.location.origin);
        url.searchParams.set('to', name);
        generatedLink.value = url.toString();
        copyLink.disabled = false;
        previewLink.href = url.toString();
        previewLink.classList.remove('disabled');
        linkFeedback.textContent = 'Link siap digunakan.';
        linkFeedback.className = 'feedback success';
    });
    linkForm.addEventListener('reset', () => setTimeout(() => {
        copyLink.disabled = true; previewLink.href = '#'; previewLink.classList.add('disabled'); linkFeedback.textContent = '';
    }));
    copyLink.addEventListener('click', async () => {
        try {
            if (navigator.clipboard && window.isSecureContext) {
                await navigator.clipboard.writeText(generatedLink.value);
            } else {
                generatedLink.select();
                document.execCommand('copy');
            }
            linkFeedback.textContent = 'Link berhasil disalin.';
            linkFeedback.className = 'feedback success';
        } catch {
            linkFeedback.textContent = 'Link gagal disalin. Silakan salin secara manual.';
            linkFeedback.className = 'feedback error';
        }
    });

    const galleryForm = document.getElementById('gallery-upload-form');
    const galleryFiles = document.getElementById('gallery-files');
    const galleryFeedback = document.getElementById('gallery-feedback');
    const galleryList = document.getElementById('admin-gallery-list');

    async function loadGallery() {
        galleryFeedback.textContent = 'Memuat galeri...';
        try {
            const { images } = await requestJson('/api/admin/gallery');
            galleryImages = images;
            galleryLoaded = true;
            renderAdminGallery();
            galleryFeedback.textContent = '';
        } catch (error) {
            galleryFeedback.textContent = error.message;
            galleryFeedback.className = 'feedback error';
        }
    }

    galleryForm.addEventListener('submit', async (event) => {
        event.preventDefault();
        const button = document.getElementById('gallery-upload-button');
        const files = [...galleryFiles.files];
        if (!files.length) return;
        const allowedTypes = new Set(['image/jpeg', 'image/png', 'image/webp']);
        const invalidType = files.find((file) => !allowedTypes.has(file.type));
        const oversized = files.find((file) => file.size > 10 * 1024 * 1024);
        if (galleryImages.length + files.length > 12) {
            galleryFeedback.textContent = `Sisa slot hanya ${12 - galleryImages.length} gambar.`;
            galleryFeedback.className = 'feedback error';
            return;
        }
        if (invalidType) {
            galleryFeedback.textContent = `${invalidType.name}: format harus JPEG, PNG, atau WebP.`;
            galleryFeedback.className = 'feedback error';
            return;
        }
        if (oversized) {
            galleryFeedback.textContent = `${oversized.name}: ukuran ${(oversized.size / 1024 / 1024).toFixed(1)} MB, maksimal 10 MB.`;
            galleryFeedback.className = 'feedback error';
            return;
        }
        const formData = new FormData();
        files.forEach((file) => formData.append('images', file));
        button.disabled = true;
        galleryFeedback.textContent = 'Mengupload gambar...';
        try {
            const { images } = await requestJson('/api/admin/gallery', { method: 'POST', body: formData });
            galleryImages = images;
            galleryForm.reset();
            renderAdminGallery();
            galleryFeedback.textContent = 'Gambar berhasil diupload.';
            galleryFeedback.className = 'feedback success';
        } catch (error) {
            galleryFeedback.textContent = error.message;
            galleryFeedback.className = 'feedback error';
        } finally { button.disabled = false; }
    });

    galleryList.addEventListener('click', async (event) => {
        const button = event.target.closest('button[data-image-id]');
        if (!button) return;
        const id = Number(button.dataset.imageId);
        const index = galleryImages.findIndex((image) => image.id === id);
        if (button.classList.contains('delete-image')) {
            if (!confirm('Hapus gambar ini dari galeri?')) return;
            await updateGallery(() => requestJson(`/api/admin/gallery/${id}`, { method: 'DELETE' }), 'Gambar berhasil dihapus.');
            return;
        }
        const direction = button.dataset.direction;
        const targetIndex = direction === 'up' ? index - 1 : index + 1;
        if (index < 0 || targetIndex < 0 || targetIndex >= galleryImages.length) return;
        const ids = galleryImages.map((image) => image.id);
        [ids[index], ids[targetIndex]] = [ids[targetIndex], ids[index]];
        await updateGallery(() => requestJson('/api/admin/gallery/order', {
            method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ ids })
        }), 'Urutan galeri berhasil diubah.');
    });

    async function updateGallery(action, successMessage) {
        galleryFeedback.textContent = 'Menyimpan perubahan...';
        try {
            const { images } = await action();
            galleryImages = images;
            renderAdminGallery();
            galleryFeedback.textContent = successMessage;
            galleryFeedback.className = 'feedback success';
        } catch (error) {
            galleryFeedback.textContent = error.message;
            galleryFeedback.className = 'feedback error';
        }
    }

    function renderAdminGallery() {
        galleryList.replaceChildren();
        document.getElementById('gallery-slot-info').textContent = `${galleryImages.length} dari 12 gambar`;
        document.getElementById('gallery-empty').hidden = galleryImages.length > 0;
        galleryFiles.disabled = galleryImages.length >= 12;
        document.getElementById('gallery-upload-button').disabled = galleryImages.length >= 12;
        galleryImages.forEach((image, index) => {
            const card = document.createElement('article');
            card.className = 'admin-gallery-card';
            const preview = document.createElement('img');
            preview.src = image.url;
            preview.alt = `Gambar galeri ${index + 1}`;
            preview.loading = 'lazy';
            const footer = document.createElement('div');
            footer.className = 'gallery-card-footer';
            const position = document.createElement('span');
            position.className = 'gallery-position';
            position.textContent = index === 0 ? 'Utama' : `#${index + 1}`;
            const actions = document.createElement('div');
            actions.className = 'gallery-card-actions';
            actions.innerHTML = `<button type="button" data-image-id="${image.id}" data-direction="up" aria-label="Geser gambar ke atas" ${index === 0 ? 'disabled' : ''}>↑</button><button type="button" data-image-id="${image.id}" data-direction="down" aria-label="Geser gambar ke bawah" ${index === galleryImages.length - 1 ? 'disabled' : ''}>↓</button><button type="button" class="delete-image" data-image-id="${image.id}" aria-label="Hapus gambar">×</button>`;
            footer.append(position, actions);
            card.append(preview, footer);
            galleryList.append(card);
        });
    }

    async function loadSettings() {
        const feedback = document.getElementById('settings-feedback');
        feedback.textContent = 'Memuat pengaturan...';
        try {
            const { settings } = await requestJson('/api/admin/settings');
            fillSettings(settings);
            settingsLoaded = true;
            feedback.textContent = '';
        } catch (error) {
            feedback.textContent = error.message;
            feedback.className = 'feedback error';
        }
    }

    settingsForm.addEventListener('submit', async (event) => {
        event.preventDefault();
        const button = document.getElementById('save-settings');
        const feedback = document.getElementById('settings-feedback');
        button.disabled = true; feedback.textContent = 'Menyimpan...';
        try {
            await requestJson('/api/admin/settings', {
                method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(readSettings())
            });
            feedback.textContent = 'Pengaturan berhasil disimpan dan langsung aktif.';
            feedback.className = 'feedback success';
        } catch (error) {
            feedback.textContent = error.message;
            feedback.className = 'feedback error';
        } finally { button.disabled = false; }
    });

    function field(name) { return settingsForm.elements.namedItem(name); }
    function fillSettings(data) {
        const values = {
            groomName:data.couple.groom.name, groomShortName:data.couple.groom.shortName, groomInstagramHandle:data.couple.groom.instagram.handle, groomInstagramUrl:data.couple.groom.instagram.url,
            brideName:data.couple.bride.name, brideShortName:data.couple.bride.shortName, brideInstagramHandle:data.couple.bride.instagram.handle, brideInstagramUrl:data.couple.bride.instagram.url,
            countdownTarget:data.wedding.countdownTarget.slice(0,16), akadDate:data.events[0].date, akadTime:data.events[0].time, akadVenue:data.events[0].venue, akadAddress:data.events[0].address, akadMapUrl:data.events[0].mapUrl,
            receptionDate:data.events[1].date, receptionTime:data.events[1].time, receptionVenue:data.events[1].venue, receptionAddress:data.events[1].address, receptionMapUrl:data.events[1].mapUrl,
            bank1Name:data.accounts[0].bank, bank1Number:data.accounts[0].number, bank1Holder:data.accounts[0].holder, bank2Name:data.accounts[1].bank, bank2Number:data.accounts[1].number, bank2Holder:data.accounts[1].holder
        };
        Object.entries(values).forEach(([name,value]) => { field(name).value = value; });
    }
    function readSettings() {
        return {
            couple:{ groom:{ name:field('groomName').value, shortName:field('groomShortName').value, instagram:{ handle:field('groomInstagramHandle').value, url:field('groomInstagramUrl').value } }, bride:{ name:field('brideName').value, shortName:field('brideShortName').value, instagram:{ handle:field('brideInstagramHandle').value, url:field('brideInstagramUrl').value } } },
            wedding:{ countdownTarget:`${field('countdownTarget').value}:00+07:00` },
            events:[
                { type:'Akad Nikah', date:field('akadDate').value, time:field('akadTime').value, venue:field('akadVenue').value, address:field('akadAddress').value, mapUrl:field('akadMapUrl').value },
                { type:'Resepsi', date:field('receptionDate').value, time:field('receptionTime').value, venue:field('receptionVenue').value, address:field('receptionAddress').value, mapUrl:field('receptionMapUrl').value }
            ],
            accounts:[
                { bank:field('bank1Name').value, number:field('bank1Number').value, holder:field('bank1Holder').value },
                { bank:field('bank2Name').value, number:field('bank2Number').value, holder:field('bank2Holder').value }
            ]
        };
    }
});
