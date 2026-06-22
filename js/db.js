// ============ БАЗА ДАННЫХ В LOCALSTORAGE ============

const DB_KEY = 'neoncareer_db';

function getDB() {
    const raw = localStorage.getItem(DB_KEY);
    if (!raw) {
        const initial = {
            users: [],
            vacancies: [],
            resumes: [],
            responses: [],
            messages: [],              // Чат между пользователями
            complaints: [],            // Жалобы на вакансии/резюме
            invitations: [],           // Приглашения на собеседование
            candidate_reviews: [],     // Оценки кандидатов после собеседования
            blacklist: [],             // Чёрный список (работодатель скрывает кандидата)
            job_fairs: [],             // Ярмарки вакансий (мероприятия)
            job_fair_registrations: [], // Запись пользователей на ярмарки
            notifications: []          // Системные уведомления для пользователей
        };
        localStorage.setItem(DB_KEY, JSON.stringify(initial));
        return initial;
    }
    return JSON.parse(raw);
}

function saveDB(db) {
    localStorage.setItem(DB_KEY, JSON.stringify(db));
}

// Новая генерация ID с использованием crypto.randomUUID()
function generateId() {
    if (typeof crypto !== 'undefined' && crypto.randomUUID) {
        return crypto.randomUUID();
    }
    return Date.now() + '-' + Math.random().toString(36).substring(2, 15);
}

// ============ РАБОТА С ПОЛЬЗОВАТЕЛЕМ ============

function getCurrentUser() {
    const raw = localStorage.getItem('neoncareer_current_user');
    return raw ? JSON.parse(raw) : null;
}

function setCurrentUser(user) {
    if (user) {
        localStorage.setItem('neoncareer_current_user', JSON.stringify(user));
    } else {
        localStorage.removeItem('neoncareer_current_user');
    }
}

function isLoggedIn() {
    return !!getCurrentUser();
}

function getCurrentUserId() {
    const user = getCurrentUser();
    return user ? user.id : null;
}

function logout() {
    setCurrentUser(null);
    window.location.href = 'index.html';
}

// ============ ФУНКЦИИ ДЛЯ УВЕДОМЛЕНИЙ ============

function getNotificationsForCurrentUser() {
    const db = getDB();
    const userId = getCurrentUserId();
    if (!userId) return [];
    return (db.notifications || []).filter(n => n.userId === userId).sort((a, b) => new Date(b.created_at) - new Date(a.created_at));
}

function addNotification(userId, text, type = 'info') {
    const db = getDB();
    db.notifications = db.notifications || [];
    db.notifications.unshift({
        id: generateId(),
        userId: userId,
        text: text,
        type: type,
        read: false,
        created_at: new Date().toISOString()
    });
    const userNotifs = db.notifications.filter(n => n.userId === userId);
    if (userNotifs.length > 100) {
        const toDelete = userNotifs.slice(100);
        db.notifications = db.notifications.filter(n => !toDelete.includes(n));
    }
    saveDB(db);
}

function markNotificationAsRead(notificationId) {
    const db = getDB();
    const notif = (db.notifications || []).find(n => n.id === notificationId);
    if (notif) {
        notif.read = true;
        saveDB(db);
    }
}

// ============ ОБНОВЛЕНИЕ УВЕДОМЛЕНИЙ ============

function updateNotificationBadge() {
    const badge = document.getElementById('notifBadge');
    if (!badge) return;
    const unread = getNotificationsForCurrentUser().filter(n => !n.read).length;
    if (unread > 0) {
        badge.innerText = unread > 9 ? '9+' : unread;
        badge.style.display = 'inline-block';
    } else {
        badge.innerText = '';
        badge.style.display = 'none';
    }
}

// ============ ФУНКЦИИ ДЛЯ ЧАТА ============

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
        if (!user) return null;
        const lastMsg = messages.filter(m => 
            (m.from_id === uid && m.to_id === currentUserId) || 
            (m.from_id === currentUserId && m.to_id === uid)
        ).sort((a, b) => new Date(b.created_at) - new Date(a.created_at))[0];
        const unreadCount = messages.filter(m => 
            m.from_id === uid && m.to_id === currentUserId && !m.read
        ).length;
        return { user, lastMsg, unreadCount };
    }).filter(d => d !== null).sort((a, b) => new Date(b.lastMsg?.created_at) - new Date(a.lastMsg?.created_at));
}

function markMessagesAsRead(otherUserId) {
    const db = getDB();
    const currentUserId = getCurrentUserId();
    let changed = false;
    (db.messages || []).forEach(m => {
        if (m.from_id === otherUserId && m.to_id === currentUserId && !m.read) {
            m.read = true;
            changed = true;
        }
    });
    if (changed) saveDB(db);
}

// ============ ФУНКЦИИ ДЛЯ ОЦЕНОК И ПРИГЛАШЕНИЙ ============

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
    addNotification(candidateId, `📩 Приглашение на собеседование от работодателя: ${message.substring(0, 100)}`, 'invitation');
    return invitation;
}

// ============ ФУНКЦИИ ДЛЯ ЧЁРНОГО СПИСКА ============

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
    return true;
}

function isInBlacklist(candidateId) {
    const blacklist = getBlacklistForEmployer();
    return blacklist.includes(candidateId);
}

// ============ ФУНКЦИИ ДЛЯ ЖАЛОБ ============

function addComplaint(type, targetId, reason) {
    const db = getDB();
    const currentUser = getCurrentUser();
    if (!currentUser) return false;
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
    return true;
}

// ============ АВТООБНОВЛЕНИЕ БЕЙДЖА УВЕДОМЛЕНИЙ ============
if (typeof window !== 'undefined') {
    // Обновляем при загрузке страницы
    document.addEventListener('DOMContentLoaded', function() {
        updateNotificationBadge();
    });
    
    // И каждые 5 секунд
    setInterval(updateNotificationBadge, 5000);
}