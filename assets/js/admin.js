document.addEventListener('DOMContentLoaded', async () => {
    const loginView = document.getElementById('login-view');
    const dashboardView = document.getElementById('dashboard-view');
    const loginForm = document.getElementById('login-form');
    const loginFeedback = document.getElementById('login-feedback');
    const settingsForm = document.getElementById('settings-form');
    let settingsLoaded = false;

    async function requestJson(url, options) {
        const response = await fetch(url, options);
        const result = await response.json().catch(() => ({}));
        if (!response.ok) throw new Error(result.error || 'Terjadi kesalahan. Silakan coba lagi.');
        return result;
    }

    function showDashboard() {
        loginView.hidden = true;
        dashboardView.hidden = false;
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
        document.querySelectorAll('.tab-button').forEach((item) => item.classList.toggle('active', item === button));
        document.querySelectorAll('.tab-panel').forEach((panel) => { panel.hidden = panel.id !== `tab-${button.dataset.tab}`; });
        if (button.dataset.tab === 'settings' && !settingsLoaded) {
            await loadSettings();
        }
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
