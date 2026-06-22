// ============ ВСПОМОГАТЕЛЬНЫЕ ФУНКЦИИ ============

function escapeHtml(text) {
    if (!text) return '';
    const div = document.createElement('div');
    div.textContent = String(text);
    return div.innerHTML;
}

function formatSalary(from, to, currency = '₽') {
    if (!from && !to) return 'Не указана';
    if (from && to) return `${from} — ${to} ${currency}`;
    if (from) return `от ${from} ${currency}`;
    return `до ${to} ${currency}`;
}

function getRelativeTime(dateStr) {
    if (!dateStr) return '';
    const now = new Date();
    const date = new Date(dateStr);
    const diff = Math.floor((now - date) / 1000);
    if (diff < 60) return 'только что';
    if (diff < 3600) return `${Math.floor(diff / 60)} мин назад`;
    if (diff < 86400) return `${Math.floor(diff / 3600)} ч назад`;
    if (diff < 2592000) return `${Math.floor(diff / 86400)} дн назад`;
    return date.toLocaleDateString('ru-RU');
}

// Плавное появление/исчезновение сообщений
function showMessage(elementId, text, type) {
    const el = document.getElementById(elementId);
    if (!el) return;
    el.textContent = (type === 'error' ? '❌ ' : '✅ ') + text;
    el.className = 'message-box ' + (type || 'success');
    // Плавное появление
    el.style.opacity = '0';
    el.style.display = 'block';
    el.style.transition = 'opacity 0.3s ease';
    setTimeout(() => { el.style.opacity = '1'; }, 10);
    // Плавное исчезновение через 4 секунды
    setTimeout(() => {
        el.style.opacity = '0';
        setTimeout(() => { el.style.display = 'none'; }, 300);
    }, 4000);
}

function getQueryParam(param) {
    const urlParams = new URLSearchParams(window.location.search);
    return urlParams.get(param);
}

// ============ ПРОВЕРКА АВТОРИЗАЦИИ ПРИ ЗАГРУЗКЕ ============

function requireAuth() {
    if (!isLoggedIn()) {
        window.location.href = 'login.html';
        return false;
    }
    return true;
}

function requireRole(role) {
    if (!requireAuth()) return false;
    const user = getCurrentUser();
    if (user.role !== role) {
        alert('У вас нет доступа к этой странице');
        window.location.href = 'index.html';
        return false;
    }
    return true;
}

// 🔼 Кнопка «Наверх»
function initScrollToTop() {
    // Удаляем старую кнопку, если есть
    const oldBtn = document.getElementById('scrollToTopBtn');
    if (oldBtn) oldBtn.remove();

    const btn = document.createElement('div');
    btn.id = 'scrollToTopBtn';
    btn.innerHTML = '⬆️';
    btn.style.cssText = `
        display: none;
        position: fixed;
        bottom: 30px;
        right: 30px;
        z-index: 1000;
        background: var(--neon-blue);
        color: var(--bg-deep);
        width: 48px;
        height: 48px;
        border-radius: 50%;
        text-align: center;
        line-height: 48px;
        font-size: 24px;
        cursor: pointer;
        box-shadow: 0 0 15px rgba(0, 240, 255, 0.5);
        transition: opacity 0.3s;
    `;
    btn.addEventListener('click', () => {
        window.scrollTo({ top: 0, behavior: 'smooth' });
    });
    document.body.appendChild(btn);

    window.addEventListener('scroll', () => {
        if (window.scrollY > 300) {
            btn.style.display = 'block';
        } else {
            btn.style.display = 'none';
        }
    });
}// ============ БУРГЕР-МЕНЮ ============
function initBurgerMenu() {
    const burgerBtn = document.getElementById('burgerBtn');
    const mobileMenu = document.getElementById('mobileMenu');
    const overlay = document.getElementById('menuOverlay');
    
    if (!burgerBtn || !mobileMenu || !overlay) return;
    
    function toggleMenu() {
        burgerBtn.classList.toggle('active');
        mobileMenu.classList.toggle('open');
        overlay.classList.toggle('active');
        document.body.style.overflow = mobileMenu.classList.contains('open') ? 'hidden' : '';
    }
    
    function closeMenu() {
        burgerBtn.classList.remove('active');
        mobileMenu.classList.remove('open');
        overlay.classList.remove('active');
        document.body.style.overflow = '';
    }
    
    burgerBtn.addEventListener('click', toggleMenu);
    overlay.addEventListener('click', closeMenu);
    
    // Закрытие при клике на ссылку в меню
    mobileMenu.querySelectorAll('a, button').forEach(el => {
        el.addEventListener('click', () => {
            // Не закрываем для кнопки темы и выхода
            if (el.classList.contains('mobile-theme-btn')) return;
            if (el.textContent.includes('Выйти')) return;
            closeMenu();
        });
    });
    
    // Закрытие при изменении размера окна (если стало больше 992px)
    window.addEventListener('resize', () => {
        if (window.innerWidth > 992) {
            closeMenu();
        }
    });
}
// Вызывать после загрузки DOM
document.addEventListener('DOMContentLoaded', function() {
    initBurgerMenu();
});