// ============ ОБЩИЕ ФУНКЦИИ ДЛЯ ВСЕХ СТРАНИЦ ============

// Загрузка вакансий на главную (исправлена фильтрация)
function loadVacancies(filter = '') {
    const db = getDB();
    // Проверяем, что вакансии существуют и is_active !== false
    let vacancies = (db.vacancies || []).filter(v => v.is_active === true || v.is_active !== false);
    // Если поле is_active не задано, считаем вакансию активной
    vacancies = vacancies.filter(v => v.is_active !== false);
    
    if (filter) {
        const q = filter.toLowerCase();
        vacancies = vacancies.filter(v =>
            (v.title || '').toLowerCase().includes(q) ||
            (v.company || '').toLowerCase().includes(q) ||
            (v.description || '').toLowerCase().includes(q)
        );
    }
    return vacancies;
}

// Загрузка резюме
function loadResumes(filter = '') {
    const db = getDB();
    let resumes = (db.resumes || []).filter(r => r.is_active === true || r.is_active !== false);
    resumes = resumes.filter(r => r.is_active !== false);
    
    if (filter) {
        const q = filter.toLowerCase();
        resumes = resumes.filter(r =>
            (r.title || '').toLowerCase().includes(q) ||
            (r.desired_position || '').toLowerCase().includes(q) ||
            (r.about_me || '').toLowerCase().includes(q)
        );
    }
    return resumes;
}

// Отклик на вакансию (создаёт диалог в чате)
function respondToVacancy(vacancyId) {
    if (!isLoggedIn()) {
        alert('Для отклика необходимо войти в систему');
        window.location.href = 'login.html';
        return;
    }

    const currentUser = getCurrentUser();
    if (currentUser && currentUser.role !== 'candidate') {
        alert('Только соискатели могут откликаться на вакансии');
        return;
    }

    const db = getDB();
    const currentUserFull = db.users.find(u => u.id === currentUser.id);
    if (currentUserFull && currentUserFull.blocked) {
        alert('Ваш аккаунт заблокирован. Вы не можете откликаться на вакансии.');
        return;
    }

    // Ищем вакансию
    let vacancy = null;
    for (let i = 0; i < db.vacancies.length; i++) {
        if (String(db.vacancies[i].id) === String(vacancyId)) {
            vacancy = db.vacancies[i];
            break;
        }
    }

    if (!vacancy) {
        alert('Вакансия не найдена');
        return;
    }

    if (vacancy.employer_id === currentUser.id) {
        alert('Вы не можете откликнуться на свою вакансию');
        return;
    }

    // Проверяем существующий отклик
    const existing = db.responses.find(r =>
        String(r.vacancy_id) === String(vacancyId) && r.candidate_id === currentUser.id
    );

    if (existing) {
        alert('Вы уже откликались на эту вакансию');
        return;
    }

    // СОЗДАЁМ ОТКЛИК
    const newResponse = {
        id: generateId(),
        vacancy_id: vacancyId,
        candidate_id: currentUser.id,
        status: 'Новый',
        created_at: new Date().toISOString()
    };
    db.responses.push(newResponse);
    saveDB(db);

    // === НОВОЕ: СОЗДАЁМ ДИАЛОГ (автоматическое сообщение) ===
    // Проверяем, есть ли уже диалог между соискателем и работодателем
    const existingMessages = (db.messages || []).filter(m =>
        (m.from_id === currentUser.id && m.to_id === vacancy.employer_id) ||
        (m.from_id === vacancy.employer_id && m.to_id === currentUser.id)
    );

    // Если диалога нет – создаём первое сообщение
    if (existingMessages.length === 0) {
        const firstMessage = {
            id: generateId(),
            from_id: currentUser.id,
            to_id: vacancy.employer_id,
            text: `👋 Здравствуйте! Я откликнулся(ась) на вашу вакансию "${vacancy.title}". Готов(а) обсудить детали.`,
            read: false,
            created_at: new Date().toISOString()
        };
        db.messages = db.messages || [];
        db.messages.push(firstMessage);
        saveDB(db);
        
        // Уведомление работодателю о новом сообщении
        addNotification(vacancy.employer_id, `💬 Новое сообщение от ${currentUser.name} по вакансии "${vacancy.title}"`, 'message');
    }

    // Уведомление работодателю об отклике
    addNotification(vacancy.employer_id, `📬 Новый отклик на вакансию "${vacancy.title}" от ${currentUser.name}`, 'response');
    
    // Показываем сообщение и перенаправляем в чат
    alert('✅ Отклик успешно отправлен!');
    
    // Перенаправляем в чат с работодателем
    if (confirm('Перейти в чат с работодателем?')) {
        window.location.href = 'chat.html?user=' + vacancy.employer_id;
    }
}

// Получение данных пользователя по ID
function getUserById(userId) {
    const db = getDB();
    return db.users.find(u => u.id === userId);
}

// Получение резюме по ID
function getResumeById(resumeId) {
    const db = getDB();
    return db.resumes.find(r => r.id === resumeId);
}

// ⭐ Избранное (отдельный ключ в localStorage)
const FAVORITES_KEY = 'neoncareer_favorites';

function getFavorites() {
    const raw = localStorage.getItem(FAVORITES_KEY);
    return raw ? JSON.parse(raw) : [];
}

function addFavorite(vacancyId) {
    const favs = getFavorites();
    if (!favs.includes(vacancyId)) {
        favs.push(vacancyId);
        localStorage.setItem(FAVORITES_KEY, JSON.stringify(favs));
        showToast('⭐ Добавлено в избранное');
    }
}

function removeFavorite(vacancyId) {
    let favs = getFavorites();
    favs = favs.filter(id => id !== vacancyId);
    localStorage.setItem(FAVORITES_KEY, JSON.stringify(favs));
    showToast('🗑 Удалено из избранного');
}

function isFavorite(vacancyId) {
    return getFavorites().includes(vacancyId);
}

// ============ УВЕДОМЛЕНИЯ (ТОСТЫ И ЦЕНТР УВЕДОМЛЕНИЙ) ============

// Показать всплывающий тост
function showToast(text, duration = 4000) {
    let toast = document.getElementById('toast');
    if (!toast) {
        toast = document.createElement('div');
        toast.id = 'toast';
        toast.style.cssText = `
            position: fixed;
            bottom: 30px;
            right: 30px;
            background: linear-gradient(135deg, #00F0FF, #B900FF);
            color: #0A0E27;
            padding: 12px 24px;
            border-radius: 8px;
            font-weight: bold;
            z-index: 10001;
            opacity: 0;
            transition: opacity 0.3s ease;
            box-shadow: 0 0 20px rgba(0,240,255,0.5);
            max-width: 300px;
        `;
        document.body.appendChild(toast);
    }
    toast.textContent = text;
    toast.style.opacity = '1';
    setTimeout(() => {
        toast.style.opacity = '0';
    }, duration);
}

// Системные уведомления (колокольчик)
let notificationsStore = JSON.parse(localStorage.getItem('neoncareer_notifications') || '[]');

function getNotificationsForCurrentUser() {
    const userId = getCurrentUserId();
    if (!userId) return [];
    return notificationsStore.filter(n => n.userId === userId).sort((a, b) => new Date(b.created_at) - new Date(a.created_at));
}

function addNotification(userId, text, type = 'info') {
    const id = generateId();
    notificationsStore.unshift({
        id: id,
        userId: userId,
        text: text,
        type: type,
        read: false,
        created_at: new Date().toISOString()
    });
    // Ограничиваем 100 уведомлениями на пользователя
    const userNotifs = notificationsStore.filter(n => n.userId === userId);
    if (userNotifs.length > 100) {
        const toDelete = userNotifs.slice(100);
        notificationsStore = notificationsStore.filter(n => !toDelete.includes(n));
    }
    localStorage.setItem('neoncareer_notifications', JSON.stringify(notificationsStore));
    
    // Если текущий пользователь - получатель, показать тост
    if (getCurrentUserId() === userId) {
        showToast(text);
        updateNotificationBadge();
    }
}

function markNotificationAsRead(notificationId) {
    const idx = notificationsStore.findIndex(n => n.id === notificationId);
    if (idx !== -1) {
        notificationsStore[idx].read = true;
        localStorage.setItem('neoncareer_notifications', JSON.stringify(notificationsStore));
        updateNotificationBadge();
    }
}

function markAllNotificationsAsRead() {
    const userId = getCurrentUserId();
    notificationsStore.forEach(n => {
        if (n.userId === userId) n.read = true;
    });
    localStorage.setItem('neoncareer_notifications', JSON.stringify(notificationsStore));
    updateNotificationBadge();
}

function updateNotificationBadge() {
    const badge = document.getElementById('notifBadge');
    if (!badge) return;
    const unread = getNotificationsForCurrentUser().filter(n => !n.read).length;
    if (unread > 0) {
        badge.innerText = unread;
        badge.style.display = 'inline-block';
    } else {
        badge.innerText = '';
        badge.style.display = 'none';
    }
}

// ============ ПРИГЛАШЕНИЯ НА СОБЕСЕДОВАНИЕ ============

function createInvitation(employerId, candidateId, resumeId, vacancyId, message) {
    const db = getDB();
    db.invitations = db.invitations || [];
    const invitation = {
        id: generateId(),
        from_employer_id: employerId,
        to_candidate_id: candidateId,
        resume_id: resumeId,
        vacancy_id: vacancyId,
        message: message,
        status: 'pending',
        created_at: new Date().toISOString()
    };
    db.invitations.push(invitation);
    saveDB(db);
    
    // Уведомление кандидату
    addNotification(candidateId, `📩 Приглашение на собеседование от работодателя: ${message.substring(0, 100)}`, 'invitation');
    showToast('Приглашение отправлено кандидату');
    return invitation;
}

function getInvitationsForCandidate() {
    const db = getDB();
    const candidateId = getCurrentUserId();
    if (!candidateId) return [];
    return (db.invitations || []).filter(i => i.to_candidate_id === candidateId).sort((a, b) => new Date(b.created_at) - new Date(a.created_at));
}

function getInvitationsForEmployer() {
    const db = getDB();
    const employerId = getCurrentUserId();
    if (!employerId) return [];
    return (db.invitations || []).filter(i => i.from_employer_id === employerId).sort((a, b) => new Date(b.created_at) - new Date(a.created_at));
}

function updateInvitationStatus(invitationId, status) {
    const db = getDB();
    const invitation = (db.invitations || []).find(i => i.id === invitationId);
    if (invitation) {
        invitation.status = status;
        saveDB(db);
        // Уведомление работодателю
        addNotification(invitation.from_employer_id, `Кандидат ${status === 'accepted' ? 'принял' : 'отклонил'} приглашение на собеседование`, 'invitation');
    }
}

// ============ ОЦЕНКИ КАНДИДАТОВ ============

function addCandidateReview(candidateId, vacancyId, rating, comment) {
    const db = getDB();
    db.candidate_reviews = db.candidate_reviews || [];
    db.candidate_reviews.push({
        id: generateId(),
        candidate_id: candidateId,
        employer_id: getCurrentUserId(),
        vacancy_id: vacancyId,
        rating: rating,
        comment: comment,
        created_at: new Date().toISOString()
    });
    saveDB(db);
    showToast('⭐ Оценка сохранена');
}

function getCandidateReviews(candidateId) {
    const db = getDB();
    return (db.candidate_reviews || []).filter(r => r.candidate_id === candidateId).sort((a, b) => new Date(b.created_at) - new Date(a.created_at));
}

function getCandidateAverageRating(candidateId) {
    const reviews = getCandidateReviews(candidateId);
    if (reviews.length === 0) return null;
    const sum = reviews.reduce((acc, r) => acc + r.rating, 0);
    return (sum / reviews.length).toFixed(1);
}

// ============ ЧЁРНЫЙ СПИСОК ============

function getBlacklistForEmployer() {
    const db = getDB();
    const employerId = getCurrentUserId();
    if (!employerId) return [];
    return (db.blacklist || []).filter(b => b.employer_id === employerId).map(b => b.candidate_id);
}

function addToBlacklist(candidateId) {
    const db = getDB();
    const employerId = getCurrentUserId();
    if (!employerId) return false;
    db.blacklist = db.blacklist || [];
    if (!db.blacklist.some(b => b.employer_id === employerId && b.candidate_id === candidateId)) {
        db.blacklist.push({
            id: generateId(),
            employer_id: employerId,
            candidate_id: candidateId,
            created_at: new Date().toISOString()
        });
        saveDB(db);
        showToast('🚫 Кандидат добавлен в чёрный список');
        return true;
    }
    return false;
}

function removeFromBlacklist(candidateId) {
    const db = getDB();
    const employerId = getCurrentUserId();
    if (!employerId) return false;
    db.blacklist = (db.blacklist || []).filter(b => !(b.employer_id === employerId && b.candidate_id === candidateId));
    saveDB(db);
    showToast('✅ Кандидат удалён из чёрного списка');
    return true;
}

function isInBlacklist(candidateId) {
    const blacklist = getBlacklistForEmployer();
    return blacklist.includes(candidateId);
}

// ============ ЖАЛОБЫ ============

function addComplaint(type, targetId, reason) {
    const db = getDB();
    const currentUser = getCurrentUser();
    if (!currentUser) {
        alert('Необходимо войти в систему');
        return false;
    }
    db.complaints = db.complaints || [];
    db.complaints.push({
        id: generateId(),
        type: type,
        target_id: targetId,
        from_id: currentUser.id,
        from_name: currentUser.name,
        reason: reason,
        created_at: new Date().toISOString()
    });
    saveDB(db);
    showToast('⚠️ Жалоба отправлена администратору');
    return true;
}

// ============ ЯРМАРКИ ВАКАНСИЙ ============

function getJobFairs() {
    const db = getDB();
    return (db.job_fairs || []).sort((a, b) => new Date(a.date) - new Date(b.date));
}

function registerForJobFair(jobFairId) {
    const db = getDB();
    const userId = getCurrentUserId();
    if (!userId) {
        alert('Необходимо войти в систему');
        return false;
    }
    db.job_fair_registrations = db.job_fair_registrations || [];
    if (db.job_fair_registrations.some(r => r.job_fair_id === jobFairId && r.user_id === userId)) {
        alert('Вы уже записаны на это мероприятие');
        return false;
    }
    db.job_fair_registrations.push({
        id: generateId(),
        job_fair_id: jobFairId,
        user_id: userId,
        registered_at: new Date().toISOString()
    });
    saveDB(db);
    showToast('✅ Вы успешно записались на ярмарку вакансий');
    return true;
}

function getUserJobFairRegistrations() {
    const db = getDB();
    const userId = getCurrentUserId();
    if (!userId) return [];
    return (db.job_fair_registrations || []).filter(r => r.user_id === userId);
}

// ============ СТАТИСТИКА РАБОТОДАТЕЛЯ ============

function getEmployerVacanciesWithStats() {
    const db = getDB();
    const employerId = getCurrentUserId();
    if (!employerId) return [];
    const vacancies = (db.vacancies || []).filter(v => v.employer_id === employerId);
    const vacancyIds = vacancies.map(v => v.id);
    const responses = (db.responses || []).filter(r => vacancyIds.includes(r.vacancy_id));
    
    return vacancies.map(v => ({
        ...v,
        views: v.views || 0,
        responses_count: responses.filter(r => r.vacancy_id === v.id).length,
        accepted_count: responses.filter(r => r.vacancy_id === v.id && r.status === 'Принят').length,
        conversion: (() => {
            const respCount = responses.filter(r => r.vacancy_id === v.id).length;
            const accCount = responses.filter(r => r.vacancy_id === v.id && r.status === 'Принят').length;
            return respCount > 0 ? ((accCount / respCount) * 100).toFixed(1) : 0;
        })()
    }));
}

function getDailyResponsesForEmployer() {
    const db = getDB();
    const employerId = getCurrentUserId();
    if (!employerId) return [];
    const vacancies = (db.vacancies || []).filter(v => v.employer_id === employerId);
    const vacancyIds = vacancies.map(v => v.id);
    const responses = (db.responses || []).filter(r => vacancyIds.includes(r.vacancy_id));
    
    const last7Days = [];
    for (let i = 6; i >= 0; i--) {
        const d = new Date();
        d.setDate(d.getDate() - i);
        last7Days.push(d.toISOString().slice(0, 10));
    }
    
    return last7Days.map(day => ({
        date: day,
        count: responses.filter(r => r.created_at && r.created_at.startsWith(day)).length
    }));
}

// ============ ЧАТ ============

function sendMessage(toUserId, text) {
    const db = getDB();
    const fromUserId = getCurrentUserId();
    if (!fromUserId) {
        alert('Необходимо войти в систему');
        return false;
    }
    if (!text.trim()) return false;
    
    db.messages = db.messages || [];
    const message = {
        id: generateId(),
        from_id: fromUserId,
        to_id: toUserId,
        text: text.trim(),
        read: false,
        created_at: new Date().toISOString()
    };
    db.messages.push(message);
    saveDB(db);
    
    // Уведомление получателю
    addNotification(toUserId, `💬 Новое сообщение от ${getCurrentUser().name}`, 'message');
    return true;
}

function getMessagesWithUser(otherUserId) {
    const db = getDB();
    const currentUserId = getCurrentUserId();
    if (!currentUserId) return [];
    return (db.messages || []).filter(m => 
        (m.from_id === currentUserId && m.to_id === otherUserId) ||
        (m.from_id === otherUserId && m.to_id === currentUserId)
    ).sort((a, b) => new Date(a.created_at) - new Date(b.created_at));
}

function getDialogsForCurrentUser() {
    const db = getDB();
    const currentUserId = getCurrentUserId();
    if (!currentUserId) return [];
    
    const messages = (db.messages || []).filter(m => m.from_id === currentUserId || m.to_id === currentUserId);
    const userIds = new Set();
    messages.forEach(m => {
        userIds.add(m.from_id === currentUserId ? m.to_id : m.from_id);
    });
    
    return Array.from(userIds).map(uid => {
        const user = db.users.find(u => u.id === uid);
        const lastMsg = messages.filter(m => 
            (m.from_id === uid && m.to_id === currentUserId) || 
            (m.from_id === currentUserId && m.to_id === uid)
        ).sort((a, b) => new Date(b.created_at) - new Date(a.created_at))[0];
        return { user, lastMsg };
    }).sort((a, b) => new Date(b.lastMsg?.created_at) - new Date(a.lastMsg?.created_at));
}

// ============ УВЕДОМЛЕНИЯ БРАУЗЕРА (PUSH) ============

const NOTIFY_KEY = 'neoncareer_notify_enabled';
const LAST_VACANCY_KEY = 'neoncareer_last_vacancy_date';

async function requestNotificationPermission() {
    if (!('Notification' in window)) {
        alert('Ваш браузер не поддерживает уведомления');
        return false;
    }
    if (Notification.permission === 'granted') {
        localStorage.setItem(NOTIFY_KEY, 'true');
        showToast('Уведомления включены');
        return true;
    }
    if (Notification.permission !== 'denied') {
        const permission = await Notification.requestPermission();
        if (permission === 'granted') {
            localStorage.setItem(NOTIFY_KEY, 'true');
            showToast('Уведомления включены');
            return true;
        }
    }
    localStorage.setItem(NOTIFY_KEY, 'false');
    return false;
}

function isNotifyEnabled() {
    return localStorage.getItem(NOTIFY_KEY) === 'true';
}

function checkNewVacanciesAndNotify() {
    if (!isNotifyEnabled() || Notification.permission !== 'granted') return;
    const db = getDB();
    const lastDate = localStorage.getItem(LAST_VACANCY_KEY);
    const now = new Date();
    let newVacancies = db.vacancies.filter(v => v.is_active !== false);
    if (lastDate) {
        newVacancies = newVacancies.filter(v => new Date(v.created_at) > new Date(lastDate));
    }
    if (newVacancies.length > 0) {
        new Notification('NeonCareer hub', {
            body: `📢 Появилось ${newVacancies.length} новых вакансий! Заходите скорее.`,
            icon: 'https://via.placeholder.com/64?text=NC',
            tag: 'new-vacancies'
        });
    }
    localStorage.setItem(LAST_VACANCY_KEY, now.toISOString());
}

// Запускаем проверку новых вакансий (если есть подписка)
if (typeof window !== 'undefined') {
    setInterval(checkNewVacanciesAndNotify, 60000);
    checkNewVacanciesAndNotify();
}