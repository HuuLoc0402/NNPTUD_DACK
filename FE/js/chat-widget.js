(function initializeMarcChatWidget() {
    if (window.__marcChatWidgetInitialized) {
        return;
    }

    window.__marcChatWidgetInitialized = true;

    const CHAT_POLL_INTERVAL = 8000;

    const state = {
        isOpen: false,
        unreadCount: 0,
        isSending: false,
        statusMessage: '',
        statusType: '',
        pollTimer: null,
        messages: []
    };

    function getStoredUser() {
        if (typeof window.getStoredUser === 'function') {
            return window.getStoredUser();
        }

        try {
            const raw = localStorage.getItem(window.CONFIG?.STORAGE_KEYS?.USER_INFO || 'marc_user_info') || localStorage.getItem('userInfo');
            return raw ? JSON.parse(raw) : null;
        } catch (error) {
            return null;
        }
    }

    function getAuthToken() {
        return localStorage.getItem(window.CONFIG?.STORAGE_KEYS?.AUTH_TOKEN || 'marc_auth_token')
            || localStorage.getItem('authToken')
            || '';
    }

    function isAuthenticated() {
        return Boolean(getAuthToken());
    }

    function getAdminConversationId() {
        const user = getStoredUser();
        return String(user?._id || user?.id || '').trim();
    }

    function escapeHtml(value) {
        return String(value || '')
            .replace(/&/g, '&amp;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;')
            .replace(/"/g, '&quot;')
            .replace(/'/g, '&#39;');
    }

    function getLoginUrl() {
        const redirect = `${window.location.pathname || ''}${window.location.search || ''}${window.location.hash || ''}`;
        return `../auth/login.html?redirect=${encodeURIComponent(redirect)}`;
    }

    async function request(path, options) {
        const config = options || {};
        const headers = { ...(config.headers || {}) };
        const token = getAuthToken();

        if (config.body && !headers['Content-Type']) {
            headers['Content-Type'] = 'application/json';
        }

        if (token) {
            headers.Authorization = `Bearer ${token}`;
        }

        const response = await fetch(`${window.CONFIG.API_BASE_URL}${path}`, {
            method: config.method || 'GET',
            headers,
            body: config.body ? JSON.stringify(config.body) : undefined
        });

        let payload = null;
        try {
            payload = await response.json();
        } catch (error) {
            payload = null;
        }

        if (!response.ok) {
            const error = new Error(payload?.message || `API Error: ${response.status}`);
            error.payload = payload;
            throw error;
        }

        return payload;
    }

    function formatTime(value) {
        if (!value) {
            return '';
        }

        const date = new Date(value);
        if (Number.isNaN(date.getTime())) {
            return '';
        }

        return date.toLocaleTimeString('vi-VN', {
            hour: '2-digit',
            minute: '2-digit'
        });
    }

    function getMessageActor(message) {
        if (!message) {
            return 'support';
        }

        const currentUser = getStoredUser();
        if (currentUser && String(message.sender?._id || message.sender) === String(currentUser._id || currentUser.id)) {
            return 'self';
        }

        return message.senderRole === 'admin' ? 'admin' : 'support';
    }

    function normalizeMessage(message) {
        const actor = getMessageActor(message);
        return {
            id: message._id || `${actor}-${message.createdAt || Date.now()}`,
            actor,
            name: message.senderName || (actor === 'self' ? 'Bạn' : 'Admin MARC'),
            text: message.message || '',
            createdAt: message.createdAt || new Date().toISOString()
        };
    }

    function setStatus(message, type) {
        state.statusMessage = message || '';
        state.statusType = type || '';
        renderStatus();
    }

    function clearStatus() {
        setStatus('', '');
    }

    function createWidget() {
        const wrapper = document.createElement('div');
        wrapper.innerHTML = `
            <button type="button" class="chat-widget-toggle" id="chatWidgetToggle" aria-label="Mở chat hỗ trợ">
                <i class="fas fa-comments"></i>
                <span class="chat-widget-badge" id="chatWidgetBadge">0</span>
            </button>
            <section class="chat-widget-panel" id="chatWidgetPanel" aria-live="polite">
                <div class="chat-widget-header">
                    <div class="chat-widget-header-top">
                        <div>
                            <h2 class="chat-widget-title">MARC Support</h2>
                            <p class="chat-widget-subtitle">Chat trực tiếp với admin để được hỗ trợ.</p>
                        </div>
                        <button type="button" class="chat-widget-close" id="chatWidgetClose" aria-label="Đóng chat">
                            <i class="fas fa-times"></i>
                        </button>
                    </div>
                </div>
                <div class="chat-widget-body">
                    <div class="chat-widget-status" id="chatWidgetStatus"></div>
                    <div class="chat-widget-messages" id="chatWidgetMessages"></div>
                    <form class="chat-widget-form" id="chatWidgetForm">
                        <div class="chat-widget-input-wrap">
                            <textarea id="chatWidgetInput" class="chat-widget-input" placeholder="Nhập nội dung cần hỗ trợ..." rows="2" maxlength="1000"></textarea>
                            <button type="submit" class="chat-widget-submit" id="chatWidgetSubmit" aria-label="Gửi tin nhắn">
                                <i class="fas fa-paper-plane"></i>
                            </button>
                        </div>
                    </form>
                </div>
            </section>
        `;

        while (wrapper.firstChild) {
            document.body.appendChild(wrapper.firstChild);
        }

        document.getElementById('chatWidgetToggle').addEventListener('click', togglePanel);
        document.getElementById('chatWidgetClose').addEventListener('click', closePanel);
        document.getElementById('chatWidgetForm').addEventListener('submit', handleSubmit);
    }

    function renderBadge() {
        const badge = document.getElementById('chatWidgetBadge');
        if (!badge) {
            return;
        }

        badge.textContent = String(state.unreadCount);
        badge.style.display = state.unreadCount > 0 ? 'inline-flex' : 'none';
    }

    function renderStatus() {
        const statusNode = document.getElementById('chatWidgetStatus');
        if (!statusNode) {
            return;
        }

        statusNode.textContent = state.statusMessage;
        statusNode.classList.toggle('is-error', state.statusType === 'error');
    }

    function renderMessages() {
        const container = document.getElementById('chatWidgetMessages');
        const input = document.getElementById('chatWidgetInput');
        const submit = document.getElementById('chatWidgetSubmit');
        if (!container || !input || !submit) {
            return;
        }

        const requiresAuth = !isAuthenticated();
        const messages = state.messages.map(normalizeMessage);

        if (requiresAuth) {
            container.innerHTML = `<div class="chat-widget-auth-note">Bạn cần <a href="${getLoginUrl()}">đăng nhập</a> để chat trực tiếp với admin.</div>`;
            input.disabled = true;
            submit.disabled = true;
            return;
        }

        input.disabled = state.isSending;
        submit.disabled = state.isSending;

        if (!messages.length) {
            container.innerHTML = '<div class="chat-widget-empty">Chưa có tin nhắn nào với admin. Hãy gửi nội dung bạn cần hỗ trợ.</div>';
            return;
        }

        container.innerHTML = messages.map((message) => {
            const classNames = ['chat-widget-message'];
            if (message.actor === 'self') {
                classNames.push('is-self');
            }
            if (message.actor === 'admin') {
                classNames.push('is-admin');
            }

            return `
                <article class="${classNames.join(' ')}">
                    <div class="chat-widget-message-header">
                        <span class="chat-widget-message-name">${escapeHtml(message.name)}</span>
                        <span class="chat-widget-message-time">${escapeHtml(formatTime(message.createdAt))}</span>
                    </div>
                    <div class="chat-widget-message-text">${escapeHtml(message.text)}</div>
                </article>
            `;
        }).join('');

        container.scrollTop = container.scrollHeight;
    }

    async function fetchUnreadCount() {
        if (!isAuthenticated()) {
            state.unreadCount = 0;
            renderBadge();
            return;
        }

        try {
            const response = await request('/chats/unread/count');
            state.unreadCount = Number(response?.data?.count || 0);
            renderBadge();
        } catch (error) {
            state.unreadCount = 0;
            renderBadge();
        }
    }

    async function loadAdminMessages() {
        if (!isAuthenticated()) {
            state.messages = [];
            renderMessages();
            return;
        }

        const conversationId = getAdminConversationId();
        if (!conversationId) {
            state.messages = [];
            renderMessages();
            return;
        }

        const response = await request(`/chats/${encodeURIComponent(conversationId)}/messages?limit=100`);
        state.messages = Array.isArray(response?.data) ? response.data : [];
        renderMessages();
        await request(`/chats/${encodeURIComponent(conversationId)}/read-all`, { method: 'PATCH' });
        state.unreadCount = 0;
        renderBadge();
    }

    async function refreshActiveTab() {
        if (!state.isOpen) {
            return;
        }

        try {
            clearStatus();
            await loadAdminMessages();
        } catch (error) {
            setStatus(error.message || 'Không thể tải lịch sử chat lúc này.', 'error');
        }
    }

    function startPolling() {
        stopPolling();
        state.pollTimer = window.setInterval(async () => {
            await fetchUnreadCount();
            if (state.isOpen) {
                await refreshActiveTab();
            }
        }, CHAT_POLL_INTERVAL);
    }

    function stopPolling() {
        if (state.pollTimer) {
            window.clearInterval(state.pollTimer);
            state.pollTimer = null;
        }
    }

    async function handleSubmit(event) {
        event.preventDefault();

        const input = document.getElementById('chatWidgetInput');
        if (!input || state.isSending) {
            return;
        }

        const message = input.value.trim();
        if (!message) {
            return;
        }

        state.isSending = true;
        input.disabled = true;
        document.getElementById('chatWidgetSubmit').disabled = true;
        clearStatus();

        try {
            const conversationId = getAdminConversationId();
            if (!conversationId) {
                throw new Error('Bạn cần đăng nhập để chat với admin.');
            }

            const response = await request(`/chats/${encodeURIComponent(conversationId)}/send`, {
                method: 'POST',
                body: { message }
            });
            const sentMessage = response?.data;
            state.messages = [...state.messages, sentMessage].filter(Boolean);

            input.value = '';
            renderMessages();
        } catch (error) {
            setStatus(error.message || 'Không thể gửi tin nhắn.', 'error');
        } finally {
            state.isSending = false;
            input.disabled = false;
            document.getElementById('chatWidgetSubmit').disabled = false;
        }
    }

    async function openPanel() {
        state.isOpen = true;
        document.getElementById('chatWidgetPanel').classList.add('is-open');
        await fetchUnreadCount();
        await refreshActiveTab();
    }

    function closePanel() {
        state.isOpen = false;
        document.getElementById('chatWidgetPanel').classList.remove('is-open');
        clearStatus();
    }

    async function togglePanel() {
        if (state.isOpen) {
            closePanel();
            return;
        }

        await openPanel();
    }

    function boot() {
        createWidget();
        renderStatus();
        renderMessages();
        fetchUnreadCount();
        startPolling();
        window.addEventListener('beforeunload', stopPolling);
    }

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', boot, { once: true });
    } else {
        boot();
    }
})();