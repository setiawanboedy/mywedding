document.addEventListener('DOMContentLoaded', () => {
    // 1. Cover Page Logic
    const btnOpen = document.getElementById('btn-open');
    const coverPage = document.getElementById('cover-page');

    // To prevent scrolling when cover is active
    document.body.style.overflow = 'hidden';

    if (btnOpen) {
        btnOpen.addEventListener('click', () => {
            if (coverPage) {
                coverPage.classList.add('cover-slide-up');
            }
            document.body.style.overflow = 'auto'; // allow scroll
        });
    }

    // 2. Scroll Animations using Intersection Observer
    const observerOptions = {
        root: null,
        rootMargin: '0px',
        threshold: 0.15
    };

    const observer = new IntersectionObserver((entries, observer) => {
        entries.forEach(entry => {
            if (entry.isIntersecting) {
                entry.target.classList.add('visible');
                observer.unobserve(entry.target); // Optional: stop observing once animated
            }
        });
    }, observerOptions);

    const animatedElements = document.querySelectorAll('.fade-in');
    animatedElements.forEach(el => observer.observe(el));

    // 3. Countdown Timer
    const countdownDate = new Date("Dec 31, 2026 09:00:00").getTime();

    const timer = setInterval(() => {
        const now = new Date().getTime();
        const distance = countdownDate - now;

        if (distance < 0) {
            clearInterval(timer);
            document.getElementById("countdown").innerHTML = "Acara Sedang Berlangsung / Selesai";
            return;
        }

        const days = Math.floor(distance / (1000 * 60 * 60 * 24));
        const hours = Math.floor((distance % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
        const minutes = Math.floor((distance % (1000 * 60 * 60)) / (1000 * 60));
        const seconds = Math.floor((distance % (1000 * 60)) / 1000);

        if(document.getElementById("days")) {
            document.getElementById("days").innerText = days.toString().padStart(2, '0');
            document.getElementById("hours").innerText = hours.toString().padStart(2, '0');
            document.getElementById("minutes").innerText = minutes.toString().padStart(2, '0');
            document.getElementById("seconds").innerText = seconds.toString().padStart(2, '0');
        }
    }, 1000);

    // 4. Copy to Clipboard
    const copyBtns = document.querySelectorAll('.copy-btn');
    copyBtns.forEach(btn => {
        btn.addEventListener('click', () => {
            const textToCopy = btn.getAttribute('data-copy');
            copyText(textToCopy).then(() => {
                const originalText = btn.innerText;
                btn.innerText = 'Tersalin!';
                btn.classList.add('copied');
                
                setTimeout(() => {
                    btn.innerText = originalText;
                    btn.classList.remove('copied');
                }, 2000);
            });
        });
    });

    function copyText(text) {
        if (navigator.clipboard && window.isSecureContext) {
            return navigator.clipboard.writeText(text);
        }

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

    // 5. RSVP Form
    const rsvpForm = document.getElementById('rsvp-form');
    const wishesContainer = document.getElementById('wishes-container');

    if (rsvpForm) {
        rsvpForm.addEventListener('submit', (e) => {
            e.preventDefault();
            const name = document.getElementById('guest-name').value;
            const status = document.getElementById('guest-status').value;
            const message = document.getElementById('guest-message').value;

            const wishEl = document.createElement('article');
            wishEl.className = 'wish-card fade-in visible';

            const badgeClass = status === 'Hadir' ? 'badge badge-success' : 'badge badge-danger';

            const header = document.createElement('div');
            const title = document.createElement('h4');
            const badge = document.createElement('span');
            const body = document.createElement('p');
            const time = document.createElement('small');

            title.textContent = name;
            badge.className = badgeClass;
            badge.textContent = status;
            body.textContent = message;
            time.textContent = 'Baru saja';

            header.append(title, badge);
            wishEl.append(header, body, time);

            wishesContainer.prepend(wishEl);
            rsvpForm.reset();
        });
    }
});
