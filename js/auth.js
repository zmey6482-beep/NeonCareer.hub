// ============ ВАЛИДАЦИЯ EMAIL ============

function validateEmail(email) {
    return /^[^\s@]+@([^\s@]+\.)+[^\s@]+$/.test(email);
}

// ============ АВТОРИЗАЦИЯ ============

function login(email, password) {
    const db = getDB();
    const user = db.users.find(u => u.email === email && u.password === password);
    if (!user) {
        throw new Error('Неверный email или пароль');
    }
    if (user.blocked) {
        throw new Error('Ваш аккаунт заблокирован администратором');
    }
    setCurrentUser({
        id: user.id,
        email: user.email,
        name: user.name,
        role: user.role
    });
    return user;
}

function register(name, email, password, role) {
    const db = getDB();

    if (!validateEmail(email)) {
        throw new Error('Введите корректный email (например: name@domain.ru)');
    }
    if (db.users.find(u => u.email === email)) {
        throw new Error('Пользователь с таким email уже существует');
    }
    if (password.length < 6) {
        throw new Error('Пароль должен содержать минимум 6 символов');
    }

    const newUser = {
        id: generateId(),
        email: email,
        password: password,
        name: name,
        role: role,
        company: '',
        company_description: '',
        specialization: '',
        bio: '',
        avatar_url: '',
        banner_url: '',
        blocked: false,
        quiz_score: null,
        created_at: new Date().toISOString()
    };

    db.users.push(newUser);
    saveDB(db);

    setCurrentUser({
        id: newUser.id,
        email: newUser.email,
        name: newUser.name,
        role: newUser.role
    });

    localStorage.setItem('just_registered', 'true');
    return newUser;
}

// Обновление навигации
function updateNavigation() {
    const user = getCurrentUser();
    const isLogged = !!user;
    const isCandidate = isLogged && user.role === 'candidate';
    const isEmployer = isLogged && user.role === 'employer';
    const isAdmin = isLogged && user.role === 'admin';

    const candidateLinks = document.querySelectorAll('.nav-candidate');
    const employerLinks = document.querySelectorAll('.nav-employer');
    const adminLinks = document.querySelectorAll('.nav-admin');
    const authLinks = document.querySelectorAll('.nav-auth');
    const guestLinks = document.querySelectorAll('.nav-guest');

    candidateLinks.forEach(el => el.style.display = isCandidate ? 'inline-block' : 'none');
    employerLinks.forEach(el => el.style.display = isEmployer ? 'inline-block' : 'none');
    adminLinks.forEach(el => el.style.display = isAdmin ? 'inline-block' : 'none');
    authLinks.forEach(el => el.style.display = isLogged ? 'inline-block' : 'none');
    guestLinks.forEach(el => el.style.display = isLogged ? 'none' : 'inline-block');

    // Мобильное меню
    document.querySelectorAll('.mobile-menu .nav-candidate').forEach(el => {
        el.style.display = isCandidate ? 'block' : 'none';
    });
    document.querySelectorAll('.mobile-menu .nav-employer').forEach(el => {
        el.style.display = isEmployer ? 'block' : 'none';
    });
    document.querySelectorAll('.mobile-menu .nav-admin').forEach(el => {
        el.style.display = isAdmin ? 'block' : 'none';
    });
    document.querySelectorAll('.mobile-menu .nav-auth').forEach(el => {
        el.style.display = isLogged ? 'block' : 'none';
    });
    document.querySelectorAll('.mobile-menu .nav-guest').forEach(el => {
        el.style.display = isLogged ? 'none' : 'block';
    });

    const notifBadge = document.getElementById('notifBadge');
    if (notifBadge && isLogged && typeof getNotificationsForCurrentUser !== 'undefined') {
        const notifs = getNotificationsForCurrentUser();
        const unread = notifs.filter(n => !n.read).length;
        notifBadge.innerText = unread > 0 ? unread : '';
        notifBadge.style.display = unread > 0 ? 'inline-block' : 'none';
    } else if (notifBadge) {
        notifBadge.innerText = '';
        notifBadge.style.display = 'none';
    }
}

// Обновление навигации (расширенная версия с добавлением новых страниц)
function updateNavigation() {
    const user = getCurrentUser();
    const isLogged = !!user;
    const isCandidate = isLogged && user.role === 'candidate';
    const isEmployer = isLogged && user.role === 'employer';
    const isAdmin = isLogged && user.role === 'admin';

    // Основная навигация (десктоп)
    const candidateLinks = document.querySelectorAll('.nav-candidate');
    const employerLinks = document.querySelectorAll('.nav-employer');
    const adminLinks = document.querySelectorAll('.nav-admin');
    const authLinks = document.querySelectorAll('.nav-auth');
    const guestLinks = document.querySelectorAll('.nav-guest');

    candidateLinks.forEach(el => el.style.display = isCandidate ? 'inline-block' : 'none');
    employerLinks.forEach(el => el.style.display = isEmployer ? 'inline-block' : 'none');
    adminLinks.forEach(el => el.style.display = isAdmin ? 'inline-block' : 'none');
    authLinks.forEach(el => el.style.display = isLogged ? 'inline-block' : 'none');
    guestLinks.forEach(el => el.style.display = isLogged ? 'none' : 'inline-block');

    // Мобильное меню (те же классы)
    document.querySelectorAll('.mobile-menu .nav-candidate').forEach(el => {
        el.style.display = isCandidate ? 'block' : 'none';
    });
    document.querySelectorAll('.mobile-menu .nav-employer').forEach(el => {
        el.style.display = isEmployer ? 'block' : 'none';
    });
    document.querySelectorAll('.mobile-menu .nav-auth').forEach(el => {
        el.style.display = isLogged ? 'block' : 'none';
    });
    document.querySelectorAll('.mobile-menu .nav-guest').forEach(el => {
        el.style.display = isLogged ? 'none' : 'block';
    });

    // Обновляем бейдж уведомлений
    updateNotificationBadge();
}

    // Дополнительно обновляем бейдж уведомлений, если он есть на странице
    const notifBadge = document.getElementById('notifBadge');
    if (notifBadge && isLogged && typeof getNotificationsForCurrentUser !== 'undefined') {
        const notifs = getNotificationsForCurrentUser();
        const unread = notifs.filter(n => !n.read).length;
        notifBadge.innerText = unread > 0 ? unread : '';
        notifBadge.style.display = unread > 0 ? 'inline-block' : 'none';
    } else if (notifBadge) {
        notifBadge.innerText = '';
        notifBadge.style.display = 'none';
    }

// ============ ФУНКЦИИ ДЛЯ ОНБОРДИНГА ============

// Показать онбординг (модальное окно с подсказками)
function showOnboarding() {
    // Удаляем старую модалку, если есть
    const oldModal = document.getElementById('onboardingModal');
    if (oldModal) oldModal.remove();

    const user = getCurrentUser();
    const isEmployer = user && user.role === 'employer';
    
    const modal = document.createElement('div');
    modal.id = 'onboardingModal';
    modal.style.cssText = `
        position: fixed;
        top: 0;
        left: 0;
        width: 100%;
        height: 100%;
        background: rgba(0, 0, 0, 0.85);
        display: flex;
        align-items: center;
        justify-content: center;
        z-index: 10000;
        backdrop-filter: blur(5px);
    `;
    
    modal.innerHTML = `
        <div class="glass-card" style="max-width: 450px; width: 90%; text-align: center; animation: fadeInUp 0.3s ease;">
            <h3 style="color: #00F0FF; font-size: 28px; margin-bottom: 16px;">👋 Добро пожаловать!</h3>
            <p style="color: #E0E7FF; margin-bottom: 24px;">Вы успешно зарегистрировались на портале <strong>NeonCareer hub</strong></p>
            
            <div style="text-align: left; margin: 20px 0;">
                <p style="margin: 12px 0;">📄 <strong>Создайте резюме</strong> — нажмите "Мои резюме" → "+ Создать"</p>
                <p style="margin: 12px 0;">🔍 <strong>Ищите вакансии</strong> на главной странице</p>
                ${!isEmployer ? '<p style="margin: 12px 0;">💬 <strong>Общайтесь с работодателями</strong> в чате</p>' : ''}
                ${isEmployer ? '<p style="margin: 12px 0;">➕ <strong>Публикуйте вакансии</strong> — кнопка "+ Создать вакансию"</p>' : ''}
                ${isEmployer ? '<p style="margin: 12px 0;">📊 <strong>Смотрите статистику</strong> в разделе "Статистика"</p>' : ''}
                <p style="margin: 12px 0;">🎨 <strong>Настройте профиль</strong> — загрузите аватарку и баннер</p>
            </div>
            
            <button id="closeOnboarding" class="neon-btn" style="width: 100%; margin-top: 16px;">🚀 Начать работу</button>
        </div>
    `;
    
    document.body.appendChild(modal);
    
    // Добавляем анимацию
    const style = document.createElement('style');
    style.textContent = `
        @keyframes fadeInUp {
            from {
                opacity: 0;
                transform: translateY(30px);
            }
            to {
                opacity: 1;
                transform: translateY(0);
            }
        }
    `;
    document.head.appendChild(style);
    
    document.getElementById('closeOnboarding').addEventListener('click', () => {
        modal.remove();
    });
    
    // Закрытие по клику на фон
    modal.addEventListener('click', (e) => {
        if (e.target === modal) modal.remove();
    });
}

// Проверка, нужно ли показать онбординг (вызывать на странице профиля)
function checkAndShowOnboarding() {
    if (localStorage.getItem('just_registered') === 'true') {
        localStorage.removeItem('just_registered');
        showOnboarding();
        return true;
    }
    return false;
}

// ============ ФУНКЦИИ ДЛЯ БЛОКИРОВКИ ПОЛЬЗОВАТЕЛЕЙ (админские) ============

// Заблокировать или разблокировать пользователя (только для админа)
function toggleBlockUser(userId) {
    const currentUser = getCurrentUser();
    if (!currentUser || currentUser.role !== 'admin') {
        throw new Error('Доступ запрещён. Только администратор может блокировать пользователей');
    }
    
    const db = getDB();
    const user = db.users.find(u => u.id === userId);
    if (!user) throw new Error('Пользователь не найден');
    if (user.role === 'admin') throw new Error('Нельзя блокировать администратора');
    
    user.blocked = !user.blocked;
    saveDB(db);
    
    // Отправляем уведомление заблокированному пользователю
    if (user.blocked && typeof addNotification !== 'undefined') {
        addNotification(userId, 'Ваш аккаунт был заблокирован администратором. Для разблокировки обратитесь в поддержку.', 'warning');
    } else if (!user.blocked && typeof addNotification !== 'undefined') {
        addNotification(userId, 'Ваш аккаунт был разблокирован. Вы снова можете пользоваться порталом.', 'success');
    }
    
    return user.blocked;
}

// Получить всех пользователей с информацией о блокировке (только для админа)
function getAllUsersForAdmin() {
    const currentUser = getCurrentUser();
    if (!currentUser || currentUser.role !== 'admin') {
        throw new Error('Доступ запрещён');
    }
    
    const db = getDB();
    return db.users.map(u => ({
        id: u.id,
        name: u.name,
        email: u.email,
        role: u.role,
        blocked: u.blocked || false,
        created_at: u.created_at,
        vacancies_count: (db.vacancies || []).filter(v => v.employer_id === u.id).length,
        resumes_count: (db.resumes || []).filter(r => r.candidate_id === u.id).length
    }));
}

// ============ ФУНКЦИИ ДЛЯ ОБНОВЛЕНИЯ ПРОФИЛЯ (с поддержкой блокировки) ============

function updateUserProfile(updates) {
    const currentUser = getCurrentUser();
    if (!currentUser) throw new Error('Не авторизован');
    if (currentUser.blocked) throw new Error('Ваш аккаунт заблокирован');
    
    const db = getDB();
    const userIndex = db.users.findIndex(u => u.id === currentUser.id);
    if (userIndex === -1) throw new Error('Пользователь не найден');
    
    const allowedFields = ['name', 'company', 'company_description', 'specialization', 'bio', 'avatar_url', 'banner_url'];
    allowedFields.forEach(field => {
        if (updates[field] !== undefined) {
            db.users[userIndex][field] = updates[field];
        }
    });
    
    db.users[userIndex].updated_at = new Date().toISOString();
    saveDB(db);
    
    setCurrentUser({
        id: db.users[userIndex].id,
        email: db.users[userIndex].email,
        name: db.users[userIndex].name,
        role: db.users[userIndex].role
    });
    
    return db.users[userIndex];
}

// ============ ИНИЦИАЛИЗАЦИЯ ПРИ ЗАГРУЗКЕ ============
if (typeof window !== 'undefined') {
    document.addEventListener('DOMContentLoaded', function() {
        if (typeof updateNotificationBadge === 'function') {
            updateNotificationBadge();
        }
    });
}