/**
 * 心遇 HeartMeet - 相亲交友平台前端
 * 支持 PC端（珍爱网/世纪佳缘风格）和 手机端（探探风格）
 */

// ==================== 设备检测 ====================
const isPC = () => window.matchMedia('(min-width: 1024px)').matches;
let currentDevice = isPC() ? 'pc' : 'mobile';

window.matchMedia('(min-width: 1024px)').addEventListener('change', (e) => {
    currentDevice = e.matches ? 'pc' : 'mobile';
    navigateTo(Store.currentPage);
});

// ==================== 全局状态 ====================
const Store = {
    token: localStorage.getItem('heartmeet_token') || '',
    user: JSON.parse(localStorage.getItem('heartmeet_user') || 'null'),
    theme: localStorage.getItem('heartmeet_theme') || 'light',
    currentPage: 'home',
    chatTarget: null,

    setToken(t) { this.token = t; localStorage.setItem('heartmeet_token', t); },
    setUser(u) { this.user = u; localStorage.setItem('heartmeet_user', JSON.stringify(u)); },
    setTheme(t) {
        this.theme = t;
        localStorage.setItem('heartmeet_theme', t);
        document.documentElement.setAttribute('data-theme', t);
    },
    isLoggedIn() { return !!this.token && !!this.user; },
    logout() {
        this.token = '';
        this.user = null;
        localStorage.removeItem('heartmeet_token');
        localStorage.removeItem('heartmeet_user');
    },
};

document.documentElement.setAttribute('data-theme', Store.theme);

// ==================== API ====================
// 自动检测运行环境：本地开发用 localhost:8000，线上部署用相对路径
const isProduction = window.location.hostname !== 'localhost' && window.location.hostname !== '127.0.0.1';
const API_BASE = isProduction ? '/api' : 'http://localhost:8000/api';
const UPLOAD_BASE = isProduction ? '' : 'http://localhost:8000';

// 将 /uploads/ 路径转为完整URL（解决 file:// 直接打开导致图片加载失败的问题）
function fixUploadUrl(path) {
    if (!path) return null;
    if (path.startsWith('http://') || path.startsWith('https://')) return path;
    return UPLOAD_BASE + (path.startsWith('/') ? path : '/' + path);
}

async function api(path, options = {}) {
    const { isFormData, ...fetchOptions } = options;
    const headers = { ...(fetchOptions.headers || {}) };
    // FormData 不需要 Content-Type，浏览器会自动设置
    if (!isFormData) headers['Content-Type'] = 'application/json';
    if (Store.token) headers['Authorization'] = `Bearer ${Store.token}`;
    const res = await fetch(`${API_BASE}${path}`, { ...fetchOptions, headers });
    if (res.status === 401) { Store.logout(); navigateTo('login'); throw new Error('请重新登录'); }
    if (!res.ok) {
        const err = await res.json().catch(() => ({ detail: '请求失败' }));
        throw new Error(err.detail || '请求失败');
    }
    return res.json();
}

// ==================== Toast ====================
function showToast(msg, type = 'info') {
    const container = document.getElementById('toastContainer');
    const el = document.createElement('div');
    el.className = `toast ${type}`;
    el.textContent = msg;
    container.appendChild(el);
    setTimeout(() => el.remove(), 3000);
}

// ==================== 路由 ====================
const pages = {};
function registerPage(name, renderFn) { pages[name] = renderFn; }

function navigateTo(page, data) {
    Store.currentPage = page;

    // 更新移动端底部导航
    const bottomItems = document.querySelectorAll('.bottom-nav-item');
    bottomItems.forEach(i => i.classList.remove('active'));
    const activeBottom = document.querySelector(`.bottom-nav-item[data-page="${page}"]`);
    if (activeBottom) activeBottom.classList.add('active');

    // 更新PC端顶部导航
    const pcNavLinks = document.querySelectorAll('#pcNav a');
    pcNavLinks.forEach(a => a.classList.remove('active'));
    const pcActive = document.querySelector(`#pcNav a[data-page="${page}"]`);
    if (pcActive) pcActive.classList.add('active');

    // 登录/注册页隐藏导航
    const authPages = ['login', 'register'];
    const isAuth = authPages.includes(page);

    if (isPC()) {
        document.getElementById('pcNav').style.display = isAuth ? 'none' : 'flex';
        document.getElementById('pcNavRight').style.display = isAuth ? 'flex' : 'flex';
    }
    document.getElementById('mobileBottomNav').style.display = isAuth ? 'none' : 'flex';
    document.getElementById('mobileNavActions').style.display = isAuth ? 'none' : 'flex';

    renderNavActions();

    if (pages[page]) {
        pages[page](data);
    } else {
        pages['home']();
    }
    window.scrollTo(0, 0);
}

// ==================== 导航栏按钮 ====================
function renderNavActions() {
    const isDark = Store.theme === 'dark';
    const themeBtn = `<button class="theme-toggle-btn" onclick="toggleTheme()" title="切换主题">${isDark ? '☀️' : '🌙'}</button>`;

    if (isPC()) {
        const el = document.getElementById('pcNavRight');
        if (!el) return;
        if (Store.isLoggedIn()) {
            el.innerHTML = `${themeBtn}<button class="btn btn-outline" onclick="Store.logout();navigateTo('login')">退出</button>`;
        } else {
            el.innerHTML = `${themeBtn}<button class="btn btn-outline" onclick="navigateTo('login')">登录</button><button class="btn btn-filled" onclick="navigateTo('register')">注册</button>`;
        }
    } else {
        const el = document.getElementById('mobileNavActions');
        if (!el) return;
        if (Store.isLoggedIn()) {
            el.innerHTML = `${themeBtn}<button class="btn btn-outline" style="font-size:12px;padding:5px 12px;" onclick="Store.logout();navigateTo('login')">退出</button>`;
        } else {
            el.innerHTML = `${themeBtn}<button class="btn btn-outline" style="font-size:12px;padding:5px 12px;" onclick="navigateTo('login')">登录</button><button class="btn btn-filled" style="font-size:12px;padding:5px 12px;" onclick="navigateTo('register')">注册</button>`;
        }
    }
}

function toggleTheme() {
    Store.setTheme(Store.theme === 'light' ? 'dark' : 'light');
    renderNavActions();
    navigateTo(Store.currentPage);
}

// ==================== 头像表情/图片 ====================
function getAvatarEmoji(gender) {
    const maleEmojis = ['👨', '🧑‍💻', '🕺', '🤵', '🧔'];
    const femaleEmojis = ['👩', '👩‍🎨', '💃', '👩‍💼', '👧'];
    const list = gender === 'female' ? femaleEmojis : maleEmojis;
    return list[Math.floor(Math.random() * list.length)];
}

function renderAvatar(avatar, gender) {
    // 如果有真实头像 URL，显示图片；否则显示 emoji
    const imgUrl = fixUploadUrl(avatar);
    const emoji = getAvatarEmoji(gender);
    if (imgUrl) {
        // 图片加载失败时回退到 emoji，而不是留空白
        return `<span class="avatar-emoji" style="display:none;">${emoji}</span><img src="${imgUrl}" alt="头像" class="avatar-img" onerror="this.style.display='none';var s=this.previousElementSibling;if(s)s.style.display='';" />`;
    }
    return `<span class="avatar-emoji">${emoji}</span>`;
}

// ==================== 用户主页相册展示 ====================
function renderUserPhotos(userId, photos) {
    if (!photos || !photos.length) return '';
    const valid = photos.map(p => fixUploadUrl(p)).filter(Boolean);
    if (!valid.length) return '';
    const count = valid.length;

    let html = `<div class="profile-section">
        <div class="profile-section-title">🖼️ 相册 (${count}张)</div>
        <div class="user-photo-gallery">`;

    if (count === 1) {
        html += `<div class="gallery-single" onclick="navigateTo('userphotos',{userId:${userId}})">
            <img src="${valid[0]}" alt="照片" loading="lazy" onerror="this.style.display='none'" />
        </div>`;
    } else if (count === 2) {
        html += `<div class="gallery-double">
            ${valid.map((p, i) => `<div class="gallery-double-item" onclick="navigateTo('userphotos',{userId:${userId}})"><img src="${p}" alt="照片${i+1}" loading="lazy" onerror="this.style.display='none'" /></div>`).join('')}
        </div>`;
    } else {
        html += `<div class="gallery-featured">
            <div class="gallery-main" onclick="navigateTo('userphotos',{userId:${userId}})">
                <img src="${valid[0]}" alt="照片1" loading="lazy" onerror="this.style.display='none'" />
            </div>
            <div class="gallery-side">`;
        valid.slice(1, 3).forEach((p, i) => {
            const isLast = i === 1;
            const hasMore = count > 3 && isLast;
            html += `<div class="gallery-side-item${hasMore ? ' gallery-more' : ''}" onclick="navigateTo('userphotos',{userId:${userId}})">
                <img src="${p}" alt="照片${i+2}" loading="lazy" onerror="this.style.display='none'" />
                ${hasMore ? '<span class="gallery-more-label">+' + (count - 3) + '</span>' : ''}
            </div>`;
        });
        html += `</div></div>`;

        if (count > 3) {
            html += `<div class="photo-grid gallery-rest" id="galleryRest_${userId}" style="display:none;margin-top:8px;">`;
            valid.slice(3).forEach(p => {
                html += `<div class="photo-item" onclick="navigateTo('userphotos',{userId:${userId}})">
                    <img src="${p}" alt="照片" loading="lazy" onerror="this.style.display='none';this.parentElement.style.display='none'" />
                </div>`;
            });
            html += `</div>`;
            html += `<button class="gallery-toggle-btn" onclick="var r=document.getElementById('galleryRest_${userId}');var d=r.style.display==='none'?'grid':'none';r.style.display=d;this.textContent=d==='none'?'查看全部 ${count} 张照片 ▼':'收起 ▲'">查看全部 ${count} 张照片 ▼</button>`;
        }
    }

    html += `</div></div>`;
    return html;
}

// ==================== 时间格式化 ====================
function formatTime(isoStr) {
    if (!isoStr) return '';
    const d = new Date(isoStr);
    const now = new Date();
    const diff = now - d;
    if (diff < 60000) return '刚刚';
    if (diff < 3600000) return Math.floor(diff / 60000) + '分钟前';
    if (diff < 86400000) return Math.floor(diff / 3600000) + '小时前';
    return `${d.getMonth() + 1}/${d.getDate()}`;
}

// ==================== 页面：登录 ====================
registerPage('login', () => {
    const container = document.getElementById('pageContainer');
    const wrapClass = isPC() ? 'auth-centered' : '';
    container.innerHTML = `
    <div class="${wrapClass}">
      <div style="text-align:center;padding:40px 0 20px;">
        <div style="font-size:64px;">💕</div>
        <h1 style="font-size:28px;font-weight:800;margin:8px 0;background:var(--gradient);-webkit-background-clip:text;-webkit-text-fill-color:transparent;background-clip:text;">欢迎回来</h1>
        <p style="color:var(--text-secondary);font-size:14px;">登录心遇，继续遇见心动</p>
      </div>
      <div class="card">
        <form id="loginForm">
          <div class="form-group">
            <label class="form-label">手机号</label>
            <input type="tel" class="form-input" id="loginPhone" placeholder="请输入手机号" maxlength="11" />
            <p class="form-error" id="loginPhoneError"></p>
          </div>
          <div class="form-group">
            <label class="form-label">密码</label>
            <input type="password" class="form-input" id="loginPassword" placeholder="请输入密码" />
            <p class="form-error" id="loginPasswordError"></p>
          </div>
          <button type="submit" class="form-btn" id="loginBtn">登 录</button>
          <p class="form-link">还没有账号？<a href="#" onclick="navigateTo('register');event.preventDefault()">立即注册</a></p>
        </form>
        <div style="margin-top:16px;padding:12px;background:var(--bg);border-radius:var(--radius-sm);text-align:center;font-size:12px;color:var(--text-secondary);">
          演示账号：13800138001 / Pass@123
        </div>
      </div>
    </div>
  `;

    document.getElementById('loginForm').onsubmit = async (e) => {
        e.preventDefault();
        const phone = document.getElementById('loginPhone').value.trim();
        const password = document.getElementById('loginPassword').value;
        let valid = true;

        if (!/^1[3-9]\d{9}$/.test(phone)) {
            document.getElementById('loginPhoneError').textContent = '请输入正确的手机号';
            document.getElementById('loginPhone').classList.add('error');
            valid = false;
        } else {
            document.getElementById('loginPhoneError').textContent = '';
            document.getElementById('loginPhone').classList.remove('error');
        }
        if (password.length < 6) {
            document.getElementById('loginPasswordError').textContent = '密码至少6位';
            document.getElementById('loginPassword').classList.add('error');
            valid = false;
        } else {
            document.getElementById('loginPasswordError').textContent = '';
            document.getElementById('loginPassword').classList.remove('error');
        }
        if (!valid) return;

        const btn = document.getElementById('loginBtn');
        btn.disabled = true; btn.textContent = '登录中...';
        try {
            const res = await api('/login', { method: 'POST', body: JSON.stringify({ phone, password }) });
            Store.setToken(res.access_token);
            Store.setUser(res.user);
            showToast('登录成功！', 'success');
            navigateTo('home');
        } catch (err) {
            showToast(err.message, 'error');
        } finally {
            btn.disabled = false; btn.textContent = '登 录';
        }
    };
});

// ==================== 页面：注册 ====================
registerPage('register', () => {
    const container = document.getElementById('pageContainer');
    const wrapClass = isPC() ? 'auth-centered' : '';
    container.innerHTML = `
    <div class="${wrapClass}">
      <div style="text-align:center;padding:30px 0 20px;">
        <div style="font-size:64px;">💝</div>
        <h1 style="font-size:28px;font-weight:800;margin:8px 0;background:var(--gradient);-webkit-background-clip:text;-webkit-text-fill-color:transparent;background-clip:text;">创建账号</h1>
        <p style="color:var(--text-secondary);font-size:14px;">开启你的缘分之旅</p>
      </div>
      <div class="card">
        <form id="registerForm">
          <div class="form-group">
            <label class="form-label">昵称</label>
            <input type="text" class="form-input" id="regNickname" placeholder="给自己取个好听的名字" />
            <p class="form-error" id="regNicknameError"></p>
          </div>
          <div class="form-group">
            <label class="form-label">手机号</label>
            <input type="tel" class="form-input" id="regPhone" placeholder="请输入手机号" maxlength="11" />
            <p class="form-error" id="regPhoneError"></p>
          </div>
          <div class="form-row">
            <div class="form-group">
              <label class="form-label">性别</label>
              <select class="form-select" id="regGender">
                <option value="other">保密</option><option value="male">男</option><option value="female">女</option>
              </select>
            </div>
            <div class="form-group">
              <label class="form-label">年龄</label>
              <input type="number" class="form-input" id="regAge" value="25" min="18" max="60" />
            </div>
          </div>
          <div class="form-row">
            <div class="form-group">
              <label class="form-label">城市</label>
              <select class="form-select" id="regCity">
                <option value="">请选择</option>
                <option>北京</option><option>上海</option><option>广州</option><option>深圳</option>
                <option>杭州</option><option>成都</option><option>重庆</option><option>西安</option>
                <option>武汉</option><option>南京</option><option>苏州</option><option>天津</option>
              </select>
            </div>
            <div class="form-group">
              <label class="form-label">职业</label>
              <input type="text" class="form-input" id="regOccupation" placeholder="你的职业" />
            </div>
          </div>
          <div class="form-group">
            <label class="form-label">密码 <span style="color:var(--text-light);font-weight:400;">(至少6位，含字母)</span></label>
            <input type="password" class="form-input" id="regPassword" placeholder="请设置密码" />
            <div id="passwordStrength" style="height:4px;border-radius:2px;margin-top:6px;background:var(--border);overflow:hidden;">
              <div id="strengthBar" style="height:100%;width:0;transition:all 0.3s;border-radius:2px;"></div>
            </div>
            <p class="form-error" id="regPasswordError"></p>
          </div>
          <button type="submit" class="form-btn" id="regBtn">注 册</button>
          <p class="form-link">已有账号？<a href="#" onclick="navigateTo('login');event.preventDefault()">立即登录</a></p>
        </form>
      </div>
    </div>
  `;

    document.getElementById('regPassword').oninput = function () {
        const val = this.value;
        let strength = 0;
        if (val.length >= 6) strength += 25;
        if (val.length >= 10) strength += 25;
        if (/[a-zA-Z]/.test(val) && /[0-9]/.test(val)) strength += 25;
        if (/[^a-zA-Z0-9]/.test(val)) strength += 25;
        const bar = document.getElementById('strengthBar');
        bar.style.width = strength + '%';
        if (strength <= 25) bar.style.background = '#e17055';
        else if (strength <= 50) bar.style.background = '#fdcb6e';
        else bar.style.background = '#00b894';
    };

    document.getElementById('registerForm').onsubmit = async (e) => {
        e.preventDefault();
        const nickname = document.getElementById('regNickname').value.trim();
        const phone = document.getElementById('regPhone').value.trim();
        const password = document.getElementById('regPassword').value;
        const gender = document.getElementById('regGender').value;
        const age = parseInt(document.getElementById('regAge').value) || 25;
        const city = document.getElementById('regCity').value;
        const occupation = document.getElementById('regOccupation').value.trim();
        let valid = true;

        if (!nickname) { document.getElementById('regNicknameError').textContent = '请输入昵称'; valid = false; }
        if (!/^1[3-9]\d{9}$/.test(phone)) { document.getElementById('regPhoneError').textContent = '手机号格式不正确'; valid = false; }
        if (password.length < 6 || !/[a-zA-Z]/.test(password)) { document.getElementById('regPasswordError').textContent = '密码至少6位且包含字母'; valid = false; }
        if (!valid) return;

        const btn = document.getElementById('regBtn');
        btn.disabled = true; btn.textContent = '注册中...';
        try {
            const res = await api('/register', { method: 'POST', body: JSON.stringify({ nickname, phone, password, gender }) });
            Store.setToken(res.access_token);
            Store.setUser(res.user);
            // 注册后补充信息
            await api('/me', { method: 'PUT', body: JSON.stringify({ age, city, occupation }) }).catch(() => { });
            const updated = await api('/me');
            Store.setUser(updated);
            showToast('注册成功！欢迎加入心遇', 'success');
            navigateTo('home');
        } catch (err) {
            showToast(err.message, 'error');
        } finally {
            btn.disabled = false; btn.textContent = '注 册';
        }
    };
});

// ==================== 页面：首页推荐 ====================
registerPage('home', () => {
    if (!Store.isLoggedIn()) { navigateTo('login'); return; }

    const container = document.getElementById('pageContainer');

    if (isPC()) {
        container.innerHTML = `
      <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:20px;">
        <div>
          <h2 style="font-size:24px;font-weight:700;">💕 为你推荐</h2>
          <p style="color:var(--text-secondary);font-size:14px;">根据你的偏好，为你精选合适的TA</p>
        </div>
        <div class="filter-bar" style="padding:0;margin:0;" id="pcQuickFilter">
          <span class="filter-chip active" data-gender="" onclick="quickFilter(this)">全部</span>
          <span class="filter-chip" data-gender="female" onclick="quickFilter(this)">女生</span>
          <span class="filter-chip" data-gender="male" onclick="quickFilter(this)">男生</span>
        </div>
      </div>
      <div class="pc-recommend-grid" id="pcRecommendGrid"><div class="loading-spinner"></div></div>
      <div id="pcRecommendFooter"></div>
    `;
        pcHomePage = 1;
        loadPCRecommendations();
    } else {
        container.innerHTML = `
      <div style="text-align:center;padding:12px 0;">
        <h2 style="font-size:22px;font-weight:700;">为你推荐</h2>
      </div>
      <div class="mobile-recommend-wrap" id="recommendCards"><div class="loading-spinner"></div></div>
      <div style="text-align:center;padding:16px;" id="recommendEnd" hidden>
        <p style="color:var(--text-secondary);">已浏览完所有推荐，换个筛选条件试试~</p>
        <button class="btn btn-filled" onclick="navigateTo('discover')" style="margin-top:8px;">去发现更多</button>
      </div>
    `;
        loadMobileRecommendations();
    }
});

let currentQuickGender = '';

function quickFilter(el) {
    document.querySelectorAll('#pcQuickFilter .filter-chip').forEach(c => c.classList.remove('active'));
    el.classList.add('active');
    currentQuickGender = el.dataset.gender;
    pcHomePage = 1;  // 重置页码
    loadPCRecommendations();
}

// PC首页分页状态
let pcHomePage = 1;
let pcHomeTotal = 0;
const PC_HOME_PAGE_SIZE = 20;

// ========== PC端推荐 ==========
async function loadPCRecommendations(page) {
    if (page !== undefined) pcHomePage = page;
    const grid = document.getElementById('pcRecommendGrid');
    if (!grid) return;
    let url = `/recommend?page=${pcHomePage}&page_size=${PC_HOME_PAGE_SIZE}`;
    if (currentQuickGender) url += `&gender=${currentQuickGender}`;

    try {
        grid.innerHTML = '<div class="loading-spinner"></div>';
        const res = await api(url);
        pcHomeTotal = res.total;

        if (!res.users.length) {
            grid.innerHTML = '<div class="empty-state"><div class="empty-icon">🔍</div><div class="empty-title">暂无推荐用户</div></div>';
            document.getElementById('pcRecommendFooter').innerHTML = '';
            return;
        }

        // 页码式：始终替换全部内容
        grid.innerHTML = res.users.map(u => `
      <div class="pc-user-card" onclick="viewUserDetail(${u.id})">
        <div class="pc-user-card-img">
          ${renderAvatar(u.avatar, u.gender)}
          ${u.common_interests.length ? `<span class="pc-user-card-badge">💡 ${u.common_interests.length}个共同兴趣</span>` : ''}
        </div>
        <div class="pc-user-card-body">
          <div class="pc-user-card-name">${u.nickname}, ${u.age}岁</div>
          <div class="pc-user-card-desc">📍 ${u.city} · ${u.occupation || '保密'}</div>
          <div class="pc-user-card-tags">
            ${[...u.interests, ...u.personality_tags].slice(0, 4).map(t => {
            const isCommon = (u.common_interests || []).includes(t);
            return `<span class="tag${isCommon ? ' highlight' : ''}">${t}</span>`;
        }).join('')}
          </div>
        </div>
        <div class="pc-user-card-actions">
          <button class="btn pc-btn-like" onclick="event.stopPropagation();handleLike(${u.id})">♥ 喜欢</button>
          <button class="btn pc-btn-greet" onclick="event.stopPropagation();handleGreet(${u.id})">👋 打招呼</button>
          <button class="btn pc-btn-chat" onclick="event.stopPropagation();openChatDirect(${u.id},'${u.nickname.replace(/'/g, "\\'")}')">💬 私信</button>
        </div>
      </div>
    `).join('');

        renderPCHomeFooter();
    } catch (err) {
        grid.innerHTML = `<div class="empty-state"><div class="empty-icon">😢</div><div class="empty-title">加载失败</div><div class="empty-desc">${err.message}</div></div>`;
        document.getElementById('pcRecommendFooter').innerHTML = '';
    }
}

function renderPCHomeFooter() {
    const container = document.getElementById('pcRecommendFooter');
    if (!container) return;
    const totalPages = Math.ceil(pcHomeTotal / PC_HOME_PAGE_SIZE);
    if (totalPages <= 1) {
        container.innerHTML = `<div class="pagination-footer"><span class="pagination-info">共 ${pcHomeTotal} 位用户</span></div>`;
        return;
    }

    let pagesHtml = '';
    const maxShow = 5;
    let startPage = Math.max(1, pcHomePage - Math.floor(maxShow / 2));
    let endPage = Math.min(totalPages, startPage + maxShow - 1);
    if (endPage - startPage < maxShow - 1) startPage = Math.max(1, endPage - maxShow + 1);

    for (let i = startPage; i <= endPage; i++) {
        const active = i === pcHomePage ? 'active' : '';
        pagesHtml += `<button class="pagination-btn ${active}" onclick="goPCHomePage(${i})">${i}</button>`;
    }

    container.innerHTML = `
    <div class="pagination-footer">
      <span class="pagination-info">共 ${pcHomeTotal} 位用户</span>
      <div class="pagination-controls">
        <button class="pagination-btn" ${pcHomePage <= 1 ? 'disabled' : ''} onclick="goPCHomePage(${pcHomePage - 1})">◀ 上一页</button>
        ${pagesHtml}
        <button class="pagination-btn" ${pcHomePage >= totalPages ? 'disabled' : ''} onclick="goPCHomePage(${pcHomePage + 1})">下一页 ▶</button>
      </div>
      <span class="pagination-info">第 ${pcHomePage}/${totalPages} 页</span>
    </div>`;
}

function goPCHomePage(page) {
    const totalPages = Math.ceil(pcHomeTotal / PC_HOME_PAGE_SIZE);
    if (page < 1 || page > totalPages) return;
    pcHomePage = page;
    document.getElementById('pageContainer').scrollIntoView({ behavior: 'smooth' });
    loadPCRecommendations(page);
}

// ========== 移动端推荐（探探风格） ==========
let mobileRecommendData = [];
let mobileRecommendIndex = 0;
let mobileRecommendPage = 1;

async function loadMobileRecommendations() {
    try {
        const res = await api(`/recommend?page=${mobileRecommendPage}&page_size=15`);
        mobileRecommendData = res.users;
        mobileRecommendIndex = 0;
        mobileRecommendPage++;
        renderMobileCard();
    } catch (err) {
        document.getElementById('recommendCards').innerHTML = `
      <div class="empty-state"><div class="empty-icon">😢</div><div class="empty-title">加载失败</div><div class="empty-desc">${err.message}</div></div>`;
    }
}

function renderMobileCard() {
    const container = document.getElementById('recommendCards');
    if (!mobileRecommendData.length || mobileRecommendIndex >= mobileRecommendData.length) {
        loadMobileRecommendations();
        return;
    }

    const u = mobileRecommendData[mobileRecommendIndex];
    const tagsHTML = [...u.interests, ...u.personality_tags].slice(0, 5)
        .map(t => {
            const isCommon = (u.common_interests || []).includes(t);
            return `<span class="tag${isCommon ? ' highlight' : ''}">${isCommon ? '💡 ' : ''}${t}</span>`;
        }).join('');

    container.innerHTML = `
    <div class="mobile-recommend-card" id="currentCard"
         ontouchstart="handleTouchStart(event)" ontouchend="handleTouchEnd(event)">
      <div class="card-img-wrap" onclick="viewUserDetail(${u.id})">
        <div class="card-img-avatar">${renderAvatar(u.avatar, u.gender)}</div>
        <div class="card-img-gradient"></div>
        <div class="card-img-info">
          <div class="card-img-name">${u.nickname}, ${u.age}</div>
          <div class="card-img-loc">📍 ${u.city} · ${u.occupation}</div>
        </div>
      </div>
      <div class="card-tags-wrap">${tagsHTML}</div>
      ${u.bio ? `<p style="padding:0 16px 8px;font-size:14px;color:var(--text-secondary);line-height:1.5;">${u.bio}</p>` : ''}
      ${u.recommend_reason ? `<div class="card-reason-text">✨ ${u.recommend_reason}</div>` : ''}
      <div class="card-actions-bar">
        <button class="action-btn skip" onclick="handleSkip()" title="跳过">✕</button>
        <button class="action-btn greet" onclick="handleGreet(${u.id})" title="打招呼">👋</button>
        <button class="action-btn like" onclick="handleLike(${u.id})" title="喜欢">♥</button>
        <button class="action-btn chat" onclick="openChatDirect(${u.id},'${u.nickname.replace(/'/g, "\\'")}')" title="私信">💬</button>
      </div>
    </div>
  `;

    api('/behaviors', {
        method: 'POST',
        body: JSON.stringify({ target_user_id: u.id, action: 'view_card', duration_ms: 0 }),
    }).catch(() => { });
}

let touchStartX = 0;
function handleTouchStart(e) { touchStartX = e.touches[0].clientX; }
function handleTouchEnd(e) {
    const diff = e.changedTouches[0].clientX - touchStartX;
    if (Math.abs(diff) > 80) {
        const card = document.getElementById('currentCard');
        if (card) {
            card.classList.add(diff > 0 ? 'swiping-right' : 'swiping-left');
            if (diff > 0) handleLike(mobileRecommendData[mobileRecommendIndex]?.id);
            else handleSkip();
        }
    }
}

async function handleLike(targetId) {
    if (!targetId) return;
    try {
        const res = await api('/actions', {
            method: 'POST',
            body: JSON.stringify({ target_user_id: targetId, action_type: 'like' }),
        });
        if (res.is_matched) {
            if (isPC()) {
                const u = await api(`/users/${targetId}`);
                showMatchDialog(u);
            } else {
                showMatchDialog(mobileRecommendData[mobileRecommendIndex]);
            }
        }
        if (!isPC()) nextMobileCard();
    } catch (err) { showToast(err.message, 'error'); }
}

async function handleSkip() {
    const idx = isPC() ? -1 : mobileRecommendIndex;
    const targetId = mobileRecommendData[idx]?.id;
    if (targetId) {
        api('/actions', {
            method: 'POST',
            body: JSON.stringify({ target_user_id: targetId, action_type: 'skip' }),
        }).catch(() => { });
    }
    if (!isPC()) nextMobileCard();
}

async function handleGreet(targetId) {
    try {
        await api('/actions', {
            method: 'POST',
            body: JSON.stringify({ target_user_id: targetId, action_type: 'greet' }),
        });
        showToast('已发送打招呼 👋', 'success');
    } catch (err) { showToast(err.message, 'error'); }
}

function nextMobileCard() {
    mobileRecommendIndex++;
    setTimeout(() => renderMobileCard(), 300);
}

function showMatchDialog(matchUser) {
    const overlay = document.createElement('div');
    overlay.className = 'match-overlay';
    overlay.innerHTML = `
    <div class="match-dialog">
      <div class="match-heart">💕</div>
      <div class="match-title">配对成功！</div>
      <div class="match-subtitle">你和 <b>${matchUser?.nickname || 'TA'}</b> 互相喜欢</div>
      <div style="display:flex;justify-content:center;gap:12px;margin-top:8px;">
        <button class="match-btn" onclick="this.closest('.match-overlay').remove();openChat(${matchUser?.id},'${matchUser?.nickname || ''}')">去聊天</button>
        <button class="match-btn" style="background:var(--bg);color:var(--text);" onclick="this.closest('.match-overlay').remove()">继续浏览</button>
      </div>
    </div>
  `;
    document.body.appendChild(overlay);
    overlay.onclick = (e) => { if (e.target === overlay) overlay.remove(); };
}

async function viewUserDetail(userId) {
    if (!userId) return;
    const overlay = document.createElement('div');
    overlay.className = 'match-overlay';
    overlay.id = 'userDetailOverlay';
    overlay.innerHTML = `<div class="loading-spinner" style="margin:auto;"></div>`;
    document.body.appendChild(overlay);
    overlay.onclick = (e) => { if (e.target === overlay) overlay.remove(); };

    try {
        const u = await api(`/users/${userId}`);
        const photos = u.photos || [];
        const photosPreview = photos.length ? `
        <div class="photo-grid" style="grid-template-columns:repeat(3,1fr);gap:6px;margin-top:10px;">
          ${photos.slice(0, 3).map(p => {
            const imgUrl = fixUploadUrl(p);
            return `<img src="${imgUrl}" alt="照片" style="width:100%;aspect-ratio:1;object-fit:cover;border-radius:8px;cursor:pointer;" onerror="this.style.display='none'" onclick="event.stopPropagation();previewPhoto('${imgUrl}')" />`;
          }).join('')}
          ${photos.length > 3 ? `<div style="display:flex;align-items:center;justify-content:center;background:var(--bg);border-radius:8px;font-size:13px;color:var(--text-secondary);cursor:pointer;" onclick="event.stopPropagation();closeModal();navigateTo('userpage',{userId:${u.id}})">+${photos.length - 3}</div>` : ''}
        </div>` : '';

        overlay.innerHTML = `
        <div class="match-dialog" style="max-width:400px;width:90vw;padding:20px;text-align:center;position:relative;" onclick="event.stopPropagation()">
          <button style="position:absolute;top:8px;right:12px;background:none;border:none;font-size:20px;cursor:pointer;color:var(--text-secondary);" onclick="this.closest('.match-overlay').remove()">✕</button>
          <div style="font-size:80px;cursor:pointer;margin-bottom:8px;" onclick="closeModal();navigateTo('userpage',{userId:${u.id}})" title="点击查看完整主页">
            ${renderAvatar(u.avatar, u.gender)}
          </div>
          <h2 style="font-size:20px;margin:4px 0;cursor:pointer;" onclick="closeModal();navigateTo('userpage',{userId:${u.id}})" title="点击查看完整主页">${u.nickname}, ${u.age}岁</h2>
          <p style="color:var(--text-secondary);font-size:13px;">📍 ${u.city || '保密'} · ${u.occupation || '保密'}</p>
          <p style="color:var(--text-light);font-size:11px;margin-top:4px;">👆 点击头像或名字查看完整主页</p>
          ${photosPreview}
          <div style="display:flex;flex-wrap:wrap;gap:6px;justify-content:center;margin-top:10px;">
            ${[...(u.interests || []), ...(u.personality_tags || [])].slice(0, 6).map(t => `<span class="tag">${t}</span>`).join('')}
          </div>
          ${u.bio ? `<p style="font-size:13px;color:var(--text-secondary);line-height:1.5;margin-top:8px;">${u.bio}</p>` : ''}
          <div style="display:flex;gap:8px;margin-top:14px;justify-content:center;">
            <button class="btn btn-filled" style="flex:1;background:var(--gradient);" onclick="closeModal();handleLike(${u.id});showToast('已喜欢 ♥','success')">♥ 喜欢</button>
            <button class="btn btn-filled" style="flex:1;background:linear-gradient(135deg,#a29bfe,#6c5ce7);" onclick="closeModal();handleGreet(${u.id})">👋 打招呼</button>
            <button class="btn btn-filled" style="flex:1;background:linear-gradient(135deg,#00b894,#00cec9);" onclick="closeModal();openChatDirect(${u.id},'${u.nickname.replace(/'/g, "\\'")}')">💬 私信</button>
          </div>
          <button style="background:none;border:none;color:var(--primary);font-size:13px;margin-top:10px;cursor:pointer;width:100%;" onclick="closeModal();navigateTo('userpage',{userId:${u.id}})">查看完整主页 →</button>
        </div>`;
    } catch (err) {
        overlay.innerHTML = `<div class="match-dialog" style="max-width:400px;padding:30px;text-align:center;"><p style="color:var(--text-secondary);">${err.message}</p><button class="btn btn-outline" style="margin-top:12px;" onclick="this.closest('.match-overlay').remove()">关闭</button></div>`;
    }
}

function closeModal() {
    const overlay = document.getElementById('userDetailOverlay');
    if (overlay) overlay.remove();
}

// 预览照片大图
function previewPhoto(url) {
    const fullUrl = fixUploadUrl(url) || url;
    const overlay = document.createElement('div');
    overlay.className = 'match-overlay';
    overlay.style.background = 'rgba(0,0,0,0.85)';
    overlay.innerHTML = `
    <div style="max-width:90vw;max-height:90vh;position:relative;">
      <img src="${fullUrl}" style="max-width:90vw;max-height:90vh;border-radius:12px;object-fit:contain;" onerror="this.style.display='none'" />
      <button style="position:absolute;top:-12px;right:-12px;width:36px;height:36px;border-radius:50%;background:rgba(255,255,255,0.9);border:none;font-size:18px;cursor:pointer;display:flex;align-items:center;justify-content:center;" onclick="this.closest('.match-overlay').remove()">✕</button>
    </div>
  `;
    document.body.appendChild(overlay);
    overlay.onclick = (e) => { if (e.target === overlay) overlay.remove(); };
}

// ==================== 页面：发现/筛选 ====================
registerPage('discover', () => {
    if (!Store.isLoggedIn()) { navigateTo('login'); return; }

    const container = document.getElementById('pageContainer');
    container.innerHTML = `
    <h2 style="font-size:22px;font-weight:700;margin-bottom:12px;">🔍 发现更多</h2>
    <div class="filter-bar" id="genderFilter">
      <span class="filter-chip active" data-value="" onclick="applyGenderFilter(this)">全部</span>
      <span class="filter-chip" data-value="male" onclick="applyGenderFilter(this)">男生</span>
      <span class="filter-chip" data-value="female" onclick="applyGenderFilter(this)">女生</span>
    </div>
    <div style="display:flex;gap:8px;margin-bottom:12px;flex-wrap:wrap;">
      <select class="form-select" id="filterCity" onchange="discoverPage=1;applyFilters()" style="flex:1;min-width:100px;">
        <option value="">全部城市</option>
        <option>北京</option><option>上海</option><option>广州</option><option>深圳</option>
        <option>杭州</option><option>成都</option><option>重庆</option><option>西安</option>
        <option>武汉</option><option>南京</option>
      </select>
      <input type="number" class="form-input" id="filterMinAge" placeholder="最小年龄" min="18" max="60" style="flex:1;min-width:80px;" onchange="discoverPage=1;applyFilters()" />
      <input type="number" class="form-input" id="filterMaxAge" placeholder="最大年龄" min="18" max="60" style="flex:1;min-width:80px;" onchange="discoverPage=1;applyFilters()" />
    </div>
    <div class="filter-bar" id="tagFilter"></div>
    <div id="discoverPaginationTop"></div>
    <div class="pc-discover-grid" id="pcDiscoverGrid"><div class="loading-spinner"></div></div>
    <div class="user-grid" id="mobileDiscoverGrid"><div class="loading-spinner"></div></div>
    <div id="discoverPagination"></div>
  `;

    // 重置分页
    discoverPage = 1;
    discoverTotal = 0;

    api('/tags').then(data => {
        const tagBar = document.getElementById('tagFilter');
        const allTags = [...data.interests, ...data.personality].slice(0, 20);
        tagBar.innerHTML = allTags.map(t =>
            `<span class="filter-chip" data-value="${t}" onclick="toggleTagFilter(this)">${t}</span>`
        ).join('');
    }).catch(() => { });

    applyFilters();
});

let currentGender = '';
let selectedTags = [];

// 发现页分页状态
let discoverPage = 1;
let discoverTotal = 0;
let discoverPageSize = 24;

function applyGenderFilter(el) {
    document.querySelectorAll('#genderFilter .filter-chip').forEach(c => c.classList.remove('active'));
    el.classList.add('active');
    currentGender = el.dataset.value;
    discoverPage = 1;  // 重置页码
    applyFilters();
}

function toggleTagFilter(el) {
    el.classList.toggle('active');
    selectedTags = Array.from(document.querySelectorAll('#tagFilter .filter-chip.active')).map(c => c.dataset.value);
    discoverPage = 1;  // 重置页码
    applyFilters();
}

async function applyFilters(page) {
    page = page || discoverPage;
    const city = document.getElementById('filterCity')?.value || '';
    const minAge = document.getElementById('filterMinAge')?.value || '';
    const maxAge = document.getElementById('filterMaxAge')?.value || '';
    const params = new URLSearchParams();
    if (currentGender) params.set('gender', currentGender);
    if (city) params.set('city', city);
    if (minAge) params.set('min_age', minAge);
    if (maxAge) params.set('max_age', maxAge);
    if (selectedTags.length) params.set('tags', selectedTags.join(','));
    params.set('page', page);
    params.set('page_size', discoverPageSize);

    try {
        const res = await api(`/recommend?${params.toString()}`);
        discoverPage = res.page;
        discoverTotal = res.total;
        discoverPageSize = res.page_size;

        if (isPC()) {
            renderPCDiscoverGrid(res.users);
        } else {
            renderMobileDiscoverGrid(res.users);
        }
        renderDiscoverPagination();
    } catch (err) {
        const errHtml = `<div class="empty-state"><div class="empty-desc">${err.message}</div></div>`;
        const pcEl = document.getElementById('pcDiscoverGrid');
        const mobileEl = document.getElementById('mobileDiscoverGrid');
        if (pcEl) pcEl.innerHTML = errHtml;
        if (mobileEl) mobileEl.innerHTML = errHtml;
        document.getElementById('discoverPagination').innerHTML = '';
    }
}

function renderPCDiscoverGrid(users) {
    const container = document.getElementById('pcDiscoverGrid');
    if (!users.length) {
        container.innerHTML = '<div class="empty-state"><div class="empty-icon">🔍</div><div class="empty-title">没有找到匹配的用户</div></div>';
        return;
    }
    container.innerHTML = users.map(u => `
    <div class="pc-user-card" onclick="viewUserDetail(${u.id})">
      <div class="pc-user-card-img">${renderAvatar(u.avatar, u.gender)}</div>
      <div class="pc-user-card-body">
        <div class="pc-user-card-name">${u.nickname}, ${u.age}岁</div>
        <div class="pc-user-card-desc">📍 ${u.city} · ${u.occupation || '保密'}</div>
        <div class="pc-user-card-tags">
          ${[...u.interests, ...u.personality_tags].slice(0, 3).map(t => `<span class="tag">${t}</span>`).join('')}
        </div>
      </div>
      <div class="pc-user-card-actions">
        <button class="btn pc-btn-like" onclick="event.stopPropagation();handleLike(${u.id})">♥ 喜欢</button>
        <button class="btn pc-btn-greet" onclick="event.stopPropagation();handleGreet(${u.id})">👋 打招呼</button>
        <button class="btn pc-btn-chat" onclick="event.stopPropagation();openChatDirect(${u.id},'${u.nickname.replace(/'/g, "\\'")}')">💬 私信</button>
      </div>
    </div>
  `).join('');
}

function renderMobileDiscoverGrid(users) {
    const container = document.getElementById('mobileDiscoverGrid');
    if (!users.length) {
        container.innerHTML = '<div class="empty-state"><div class="empty-icon">🔍</div><div class="empty-title">没有找到匹配的用户</div></div>';
        return;
    }
    container.innerHTML = `<div class="user-grid">${users.map(u => `
    <div class="user-grid-item" onclick="viewUserDetail(${u.id})">
      <div class="user-grid-img">${renderAvatar(u.avatar, u.gender)}</div>
      <div class="user-grid-info">
        <div class="user-grid-name">${u.nickname}, ${u.age}</div>
        <div class="user-grid-desc">📍 ${u.city}</div>
      </div>
    </div>
  `).join('')}</div>`;
}

// ==================== 发现页分页 ====================
function renderDiscoverPagination() {
    const el = document.getElementById('discoverPagination');
    if (!el) return;
    const totalPages = Math.ceil(discoverTotal / discoverPageSize);
    if (totalPages <= 1) {
        el.innerHTML = discoverTotal > 0
            ? `<div class="pagination-footer"><span class="pagination-info">共 ${discoverTotal} 位用户</span></div>`
            : '';
        return;
    }

    let pagesHtml = '';
    const maxShow = 5;
    let startPage = Math.max(1, discoverPage - Math.floor(maxShow / 2));
    let endPage = Math.min(totalPages, startPage + maxShow - 1);
    if (endPage - startPage < maxShow - 1) startPage = Math.max(1, endPage - maxShow + 1);

    for (let i = startPage; i <= endPage; i++) {
        const active = i === discoverPage ? 'active' : '';
        pagesHtml += `<button class="pagination-btn ${active}" onclick="goDiscoverPage(${i})">${i}</button>`;
    }

    el.innerHTML = `
    <div class="pagination-footer">
      <span class="pagination-info">共 ${discoverTotal} 位用户</span>
      <div class="pagination-controls">
        <button class="pagination-btn" ${discoverPage <= 1 ? 'disabled' : ''} onclick="goDiscoverPage(${discoverPage - 1})">◀ 上一页</button>
        ${pagesHtml}
        <button class="pagination-btn" ${discoverPage >= totalPages ? 'disabled' : ''} onclick="goDiscoverPage(${discoverPage + 1})">下一页 ▶</button>
      </div>
      <span class="pagination-info">第 ${discoverPage}/${totalPages} 页</span>
    </div>`;
}

function goDiscoverPage(page) {
    if (page < 1 || page > Math.ceil(discoverTotal / discoverPageSize)) return;
    discoverPage = page;
    // 滚动到顶部
    document.getElementById('pageContainer').scrollIntoView({ behavior: 'smooth' });
    applyFilters(page);
}

// ==================== 页面：消息列表 ====================
registerPage('chatlist', () => {
    if (!Store.isLoggedIn()) { navigateTo('login'); return; }

    const container = document.getElementById('pageContainer');
    container.innerHTML = `
    <h2 style="font-size:22px;font-weight:700;margin-bottom:16px;">💬 我的消息</h2>
    <div id="chatListContainer"><div class="loading-spinner"></div></div>
  `;

    api('/chat-list').then(data => {
        const el = document.getElementById('chatListContainer');
        if (!data.chat_list.length) {
            el.innerHTML = '<div class="empty-state"><div class="empty-icon">💬</div><div class="empty-title">暂无消息</div><div class="empty-desc">去发现页看看，说不定有人给你打招呼了~</div></div>';
            return;
        }
        el.innerHTML = data.chat_list.map(c => `
      <div class="chat-list-item">
        <div class="chat-avatar-circle" style="cursor:pointer;" onclick="viewUserDetail(${c.user_id})">${renderAvatar(c.avatar, c.gender || 'other')}</div>
        <div class="chat-content-wrap" onclick="openChat(${c.user_id}, '${c.nickname}')">
          <div class="chat-name-line">${c.nickname}</div>
          <div class="chat-msg-line">${c.last_action === 'greet' ? '👋 ' : '💕 '}${c.last_message}</div>
        </div>
        <div class="chat-time-line" onclick="openChat(${c.user_id}, '${c.nickname}')">${formatTime(c.time)}</div>
      </div>
    `).join('');

        api('/matches').then(matchData => {
            if (matchData.matches.length) {
                document.getElementById('chatBadge').style.display = 'block';
            }
        }).catch(() => { });
    }).catch(err => {
        document.getElementById('chatListContainer').innerHTML = `<div class="empty-state"><div class="empty-desc">${err.message}</div></div>`;
    });
});

// ==================== 聊天对话页 ====================
let chatPollingTimer = null;

function openChatDirect(targetUserId, targetNickname) {
    Store.chatTarget = { id: targetUserId, nickname: targetNickname };
    if (chatPollingTimer) { clearInterval(chatPollingTimer); chatPollingTimer = null; }
    renderChatPage();
}

function openChat(targetUserId, targetNickname) {
    Store.chatTarget = { id: targetUserId, nickname: targetNickname };
    renderChatPage();
}

function renderChatPage() {
    const targetNickname = Store.chatTarget.nickname;
    const container = document.getElementById('pageContainer');

    container.innerHTML = `
    <div class="chat-dialog-wrap">
      <div class="chat-dialog-header">
        <button class="back-btn" onclick="closeChat()">←</button>
        <div class="chat-avatar-circle" style="width:40px;height:40px;font-size:20px;cursor:pointer;" onclick="viewUserDetail(${Store.chatTarget.id})">👤</div>
        <div style="flex:1;cursor:pointer;" onclick="viewUserDetail(${Store.chatTarget.id})">
          <div style="font-weight:600;font-size:16px;">${targetNickname}</div>
          <div style="font-size:12px;color:var(--success);">在线</div>
        </div>
        <button class="btn btn-outline" style="font-size:12px;padding:5px 12px;" onclick="viewUserDetail(${Store.chatTarget.id})">查看主页</button>
      </div>
      <div class="chat-msgs" id="chatMessages">
        <div class="loading-spinner"></div>
      </div>
      <div class="chat-input-bar">
        <input type="text" class="form-input" id="chatInput" placeholder="输入消息..." onkeydown="if(event.key==='Enter')sendChatMessage()" />
        <button class="chat-send-btn" onclick="sendChatMessage()">➤</button>
      </div>
    </div>
  `;

    loadChatMessages();
    // 轮询新消息
    if (chatPollingTimer) clearInterval(chatPollingTimer);
    chatPollingTimer = setInterval(loadChatMessagesSilent, 2000);
}

function closeChat() {
    if (chatPollingTimer) { clearInterval(chatPollingTimer); chatPollingTimer = null; }
    Store.chatTarget = null;
    navigateTo('chatlist');
}

async function loadChatMessages() {
    if (!Store.chatTarget) return;
    try {
        const data = await api(`/chat-messages/${Store.chatTarget.id}?page=1&page_size=100`);
        renderChatMessages(data.messages);
    } catch (err) {
        document.getElementById('chatMessages').innerHTML = `<div class="empty-state"><div class="empty-desc">${err.message}</div></div>`;
    }
}

async function loadChatMessagesSilent() {
    if (!Store.chatTarget) return;
    try {
        const data = await api(`/chat-messages/${Store.chatTarget.id}?page=1&page_size=100`);
        renderChatMessages(data.messages);
    } catch (err) { /* silent */ }
}

function renderChatMessages(messages) {
    const el = document.getElementById('chatMessages');
    if (!el) return;
    if (!messages.length) {
        el.innerHTML = '<div style="text-align:center;padding:40px;color:var(--text-secondary);">开始你们的第一次对话吧~</div>';
        return;
    }
    el.innerHTML = messages.map(m => {
        const isMe = m.from_user_id === Store.user.id;
        return `
      <div class="chat-msg-bubble ${isMe ? 'me' : 'other'}">
        ${m.content}
        <div class="chat-msg-time" style="${isMe ? 'text-align:right;' : ''}">${formatTime(m.created_at)}</div>
      </div>
    `;
    }).join('');
    el.scrollTop = el.scrollHeight;
}

async function sendChatMessage() {
    if (!Store.chatTarget) return;
    const input = document.getElementById('chatInput');
    if (!input) return;
    const content = input.value.trim();
    if (!content) return;

    input.value = '';
    try {
        await api(`/chat-messages/${Store.chatTarget.id}`, {
            method: 'POST',
            body: JSON.stringify({ content }),
        });
        await loadChatMessages();
    } catch (err) {
        showToast(err.message, 'error');
    }
}

// ==================== 页面：查看他人主页 ====================
registerPage('userpage', (data) => {
    if (!Store.isLoggedIn()) { navigateTo('login'); return; }
    const userId = data?.userId;
    if (!userId) { navigateTo('home'); return; }

    const container = document.getElementById('pageContainer');
    container.innerHTML = `<div class="loading-spinner"></div>`;

    api(`/users/${userId}`).then(u => {
        const photosHtml = renderUserPhotos(u.id, u.photos || []);

        container.innerHTML = `
      <div style="display:flex;align-items:center;gap:8px;margin-bottom:16px;">
        <button onclick="navigateTo('home')" style="background:none;border:none;font-size:20px;cursor:pointer;color:var(--text);">←</button>
        <h2 style="font-size:20px;font-weight:700;">${u.nickname} 的主页</h2>
      </div>
      <div class="card">
        <div style="text-align:center;padding:20px 0;">
          <div class="userpage-avatar">${renderAvatar(u.avatar, u.gender)}</div>
          <h2 style="font-size:22px;margin:8px 0;">${u.nickname}, ${u.age}岁</h2>
          <p style="color:var(--text-secondary);">📍 ${u.city || '保密'} · ${u.occupation || '保密'}</p>
        </div>
        ${photosHtml}
        <div class="profile-section">
          <div class="profile-section-title">📋 个人介绍</div>
          <p style="color:var(--text-secondary);line-height:1.6;">${u.bio || '这个人很懒，什么都没写~'}</p>
        </div>
        <div class="profile-section">
          <div class="profile-section-title">🏷️ 兴趣标签</div>
          <div style="display:flex;flex-wrap:wrap;gap:6px;">
            ${(u.interests || []).length ? (u.interests || []).map(t => `<span class="tag">${t}</span>`).join('') : '<span style="color:var(--text-secondary);font-size:14px;">未设置</span>'}
          </div>
        </div>
        <div class="profile-section">
          <div class="profile-section-title">🎭 性格标签</div>
          <div style="display:flex;flex-wrap:wrap;gap:6px;">
            ${(u.personality_tags || []).length ? (u.personality_tags || []).map(t => `<span class="tag">${t}</span>`).join('') : '<span style="color:var(--text-secondary);font-size:14px;">未设置</span>'}
          </div>
        </div>
        <div style="display:flex;gap:10px;margin-top:16px;">
          <button class="form-btn" style="flex:1;background:var(--gradient);" onclick="handleLike(${u.id});showToast('已喜欢 ♥','success')">♥ 喜欢</button>
          <button class="form-btn" style="flex:1;background:linear-gradient(135deg,#a29bfe,#6c5ce7);" onclick="handleGreet(${u.id})">👋 打招呼</button>
          <button class="form-btn" style="flex:1;background:linear-gradient(135deg,#00b894,#00cec9);" onclick="openChatDirect(${u.id},'${u.nickname.replace(/'/g, "\\'")}')">💬 私信</button>
        </div>
      </div>
    `;
    }).catch(err => {
        container.innerHTML = `<div class="empty-state"><div class="empty-icon">😢</div><div class="empty-title">加载失败</div><div class="empty-desc">${err.message}</div></div>`;
    });
});

// ==================== 页面：查看某用户全部照片 ====================
registerPage('userphotos', (data) => {
    if (!Store.isLoggedIn()) { navigateTo('login'); return; }
    const userId = data?.userId;
    if (!userId) { navigateTo('home'); return; }

    const container = document.getElementById('pageContainer');
    container.innerHTML = `<div class="loading-spinner"></div>`;

    api(`/users/${userId}`).then(u => {
        const valid = (u.photos || []).map(p => fixUploadUrl(p)).filter(Boolean);
        const grid = valid.length ? valid.map(p => `<div class="photo-item" onclick="previewPhoto('${p}')">
            <img src="${p}" alt="照片" loading="lazy" onerror="this.style.display='none';this.parentElement.style.display='none'" />
        </div>`).join('') : '<div class="empty-state"><div class="empty-icon">📷</div><div class="empty-title">暂无照片</div></div>';

        container.innerHTML = `
        <div style="display:flex;align-items:center;gap:8px;margin-bottom:16px;">
            <button onclick="navigateTo('userpage',{userId:${userId}})" style="background:none;border:none;font-size:20px;cursor:pointer;color:var(--text);">←</button>
            <h2 style="font-size:20px;font-weight:700;">${u.nickname} 的全部照片 (${valid.length})</h2>
        </div>
        <div class="photo-grid">
            ${grid}
        </div>`;
    }).catch(err => {
        container.innerHTML = `<div class="empty-state"><div class="empty-icon">😢</div><div class="empty-title">加载失败</div><div class="empty-desc">${err.message}</div></div>`;
    });
});

// ==================== 页面：个人中心 ====================
registerPage('profile', () => {
    if (!Store.isLoggedIn()) { navigateTo('login'); return; }

    const container = document.getElementById('pageContainer');
    const profileHtml = `
    <div class="profile-header">
      <div class="profile-avatar-wrap" onclick="document.getElementById('avatarInput').click()">
        ${renderAvatar(Store.user.avatar, Store.user.gender)}
        <span class="profile-avatar-edit">📷</span>
      </div>
      <input type="file" id="avatarInput" accept="image/*" hidden onchange="previewAvatar(event)" />
      <div class="profile-name">${Store.user.nickname}</div>
      <div class="profile-id">ID: ${Store.user.id}</div>
    </div>
    <div id="photoAlbumSection"></div>
    <div id="profileContent"><div class="loading-spinner"></div></div>
    <div style="padding:20px 0;text-align:center;">
      <button class="btn btn-outline" onclick="navigateTo('analysis')" style="margin-right:8px;">📊 行为分析</button>
      <button class="btn btn-outline" style="color:var(--danger);border-color:var(--danger);" onclick="Store.logout();navigateTo('login')">退出登录</button>
    </div>
  `;
    container.innerHTML = profileHtml;
    loadProfile();
});

let profileEditMode = false;

async function loadProfile() {
    try {
        const u = await api('/me');
        Store.setUser(u);
        renderProfile(u);
    } catch (err) {
        document.getElementById('profileContent').innerHTML = `<div class="empty-state"><div class="empty-desc">${err.message}</div></div>`;
    }
}

function renderProfile(u) {
    const container = document.getElementById('profileContent');
    container.innerHTML = `
    <div class="profile-section">
      <div class="profile-section-title">📋 基本信息
        <button class="edit-toggle" onclick="toggleProfileEdit()">${profileEditMode ? '完成' : '编辑'}</button>
      </div>
      <div id="profileInfo"></div>
    </div>
    <div class="profile-section">
      <div class="profile-section-title">💝 择偶偏好</div>
      <div id="preferenceInfo"></div>
    </div>
    <div class="profile-section">
      <div class="profile-section-title">🏷️ 兴趣标签</div>
      <div id="interestInfo"></div>
    </div>
  `;

    renderPhotoAlbum(u);
    renderProfileInfo(u);
    renderPreferenceInfo(u);
    renderInterestInfo(u);
}

function renderProfileInfo(u) {
    const el = document.getElementById('profileInfo');
    if (profileEditMode) {
        el.innerHTML = `
      <div class="form-group"><label class="form-label">昵称</label><input class="form-input" id="editNickname" value="${u.nickname}" /></div>
      <div class="form-row">
        <div class="form-group"><label class="form-label">年龄</label><input type="number" class="form-input" id="editAge" value="${u.age}" min="18" max="60" /></div>
        <div class="form-group"><label class="form-label">性别</label><select class="form-select" id="editGender"><option ${u.gender === 'male' ? 'selected' : ''}>male</option><option ${u.gender === 'female' ? 'selected' : ''}>female</option><option ${u.gender === 'other' ? 'selected' : ''}>other</option></select></div>
      </div>
      <div class="form-row">
        <div class="form-group"><label class="form-label">城市</label><input class="form-input" id="editCity" value="${u.city || ''}" /></div>
        <div class="form-group"><label class="form-label">职业</label><input class="form-input" id="editOccupation" value="${u.occupation || ''}" /></div>
      </div>
      <div class="form-group"><label class="form-label">个人介绍</label><textarea class="form-textarea" id="editBio">${u.bio || ''}</textarea></div>
      <button class="form-btn" onclick="saveProfile()">保存</button>
    `;
    } else {
        el.innerHTML = `
      <div class="info-row"><span class="info-label">昵称</span><span class="info-value">${u.nickname}</span></div>
      <div class="info-row"><span class="info-label">年龄</span><span class="info-value">${u.age}</span></div>
      <div class="info-row"><span class="info-label">性别</span><span class="info-value">${u.gender === 'male' ? '男' : u.gender === 'female' ? '女' : '保密'}</span></div>
      <div class="info-row"><span class="info-label">城市</span><span class="info-value">${u.city || '未设置'}</span></div>
      <div class="info-row"><span class="info-label">职业</span><span class="info-value">${u.occupation || '未设置'}</span></div>
      <div style="padding:12px 0;"><span class="info-label">个人介绍</span><p style="color:var(--text);margin-top:4px;line-height:1.6;">${u.bio || '这个人很懒，什么都没写~'}</p></div>
    `;
    }
}

function renderPreferenceInfo(u) {
    const pref = u.preference || {};
    const el = document.getElementById('preferenceInfo');
    el.innerHTML = `
    <div class="form-group"><label class="form-label">期望性别</label><select class="form-select" id="prefGender" onchange="savePreference()"><option value="">不限</option><option value="male" ${pref.gender === 'male' ? 'selected' : ''}>男</option><option value="female" ${pref.gender === 'female' ? 'selected' : ''}>女</option></select></div>
    <div class="form-row">
      <div class="form-group"><label class="form-label">最小年龄</label><input type="number" class="form-input" id="prefMinAge" value="${pref.min_age || 20}" min="18" max="60" onchange="savePreference()" /></div>
      <div class="form-group"><label class="form-label">最大年龄</label><input type="number" class="form-input" id="prefMaxAge" value="${pref.max_age || 35}" min="18" max="60" onchange="savePreference()" /></div>
    </div>
  `;
}

function renderInterestInfo(u) {
    const el = document.getElementById('interestInfo');
    el.innerHTML = `
    <div style="display:flex;flex-wrap:wrap;gap:8px;margin-bottom:12px;">
      ${(u.interests || []).map(t => `<span class="tag highlight">${t}</span>`).join('') || '<span style="color:var(--text-secondary);font-size:14px;">还未设置兴趣标签</span>'}
    </div>
    <div class="form-group"><label class="form-label">添加兴趣</label><input class="form-input" id="newInterest" placeholder="输入兴趣后回车添加" onkeydown="if(event.key==='Enter'){addInterest();event.preventDefault()}" /></div>
  `;
}

function toggleProfileEdit() {
    profileEditMode = !profileEditMode;
    renderProfile(Store.user);
}

async function saveProfile() {
    const data = {
        nickname: document.getElementById('editNickname')?.value,
        age: parseInt(document.getElementById('editAge')?.value) || 18,
        gender: document.getElementById('editGender')?.value,
        city: document.getElementById('editCity')?.value,
        occupation: document.getElementById('editOccupation')?.value,
        bio: document.getElementById('editBio')?.value,
    };
    try {
        const u = await api('/me', { method: 'PUT', body: JSON.stringify(data) });
        Store.setUser(u);
        profileEditMode = false;
        renderProfile(u);
        showToast('保存成功！', 'success');
    } catch (err) { showToast(err.message, 'error'); }
}

async function savePreference() {
    const data = {
        gender: document.getElementById('prefGender')?.value || '',
        min_age: parseInt(document.getElementById('prefMinAge')?.value) || 20,
        max_age: parseInt(document.getElementById('prefMaxAge')?.value) || 35,
    };
    try { await api('/me/preference', { method: 'PUT', body: JSON.stringify(data) }); } catch (err) { }
}

async function addInterest() {
    const input = document.getElementById('newInterest');
    const tag = input.value.trim();
    if (!tag) return;
    const interests = [...(Store.user.interests || []), tag];
    try {
        const u = await api('/me', { method: 'PUT', body: JSON.stringify({ interests }) });
        Store.setUser(u);
        renderProfile(u);
        input.value = '';
    } catch (err) { showToast(err.message, 'error'); }
}

async function previewAvatar(event) {
    const file = event.target.files[0];
    if (!file) return;

    // 本地预览
    const reader = new FileReader();
    reader.onload = function (e) {
        const avatarWrap = document.querySelector('.profile-avatar-wrap');
        if (avatarWrap) {
            avatarWrap.innerHTML = `<img src="${e.target.result}" alt="头像" class="avatar-img" style="width:100%;height:100%;object-fit:cover;border-radius:50%;" /><span class="profile-avatar-edit">📷</span>`;
        }
    };
    reader.readAsDataURL(file);

    // 上传到服务器
    const formData = new FormData();
    formData.append('file', file);
    try {
        const res = await api('/upload-avatar', {
            method: 'POST',
            body: formData,
            isFormData: true,
        });
        Store.user.avatar = res.avatar_url;
        showToast('头像上传成功！', 'success');
    } catch (err) {
        showToast('头像上传失败: ' + err.message, 'error');
        navigateTo('profile');
    }
    event.target.value = '';
}

async function uploadPhoto(event) {
    const file = event.target.files[0];
    if (!file) return;

    const formData = new FormData();
    formData.append('file', file);
    try {
        const res = await api('/upload-photo', {
            method: 'POST',
            body: formData,
            isFormData: true,
        });
        Store.user.photos = res.photos;
        // 刷新相册区域
        renderPhotoAlbum(Store.user);
        showToast('照片上传成功！', 'success');
    } catch (err) {
        showToast('照片上传失败: ' + err.message, 'error');
    }
    event.target.value = '';
}

async function deleteUserPhoto(filename) {
    if (!confirm('确定删除这张照片吗？')) return;
    try {
        const res = await api(`/photos/${filename}`, { method: 'DELETE' });
        Store.user.photos = res.photos;
        renderPhotoAlbum(Store.user);
        showToast('照片已删除', 'info');
    } catch (err) {
        showToast(err.message, 'error');
    }
}

function renderPhotoAlbum(u) {
    const el = document.getElementById('photoAlbumSection');
    if (!el) return;
    const photos = u.photos || [];
    el.innerHTML = `
    <div class="profile-section">
      <div class="profile-section-title">🖼️ 我的相册
        <span style="font-size:12px;color:var(--text-secondary);">(${photos.length}/9)</span>
      </div>
      <div class="photo-grid">
        ${photos.map(p => {
        const fname = p.split('/').pop();
        const imgUrl = fixUploadUrl(p);
        return `<div class="photo-item" onclick="event.stopPropagation()">
            <img src="${imgUrl}" alt="照片" onerror="this.style.display='none';this.parentElement.style.display='none'" />
            <button class="photo-delete-btn" onclick="deleteUserPhoto('${fname}')">✕</button>
          </div>`;
    }).join('')}
        ${photos.length < 9 ? `
          <div class="photo-item photo-add" onclick="document.getElementById('photoInput').click()">
            <span style="font-size:32px;color:var(--text-light);">+</span>
            <span style="font-size:12px;color:var(--text-light);">添加照片</span>
          </div>
        ` : ''}
      </div>
      <input type="file" id="photoInput" accept="image/*" hidden onchange="uploadPhoto(event)" />
    </div>
  `;
}

// ==================== 页面：行为分析 ====================
registerPage('analysis', () => {
    if (!Store.isLoggedIn()) { navigateTo('login'); return; }

    const container = document.getElementById('pageContainer');
    container.innerHTML = `
    <div style="display:flex;align-items:center;gap:8px;margin-bottom:16px;">
      <button onclick="navigateTo('profile')" style="background:none;border:none;font-size:20px;cursor:pointer;color:var(--text);">←</button>
      <h2 style="font-size:22px;font-weight:700;">📊 行为分析</h2>
    </div>
    <div id="analysisContent"><div class="loading-spinner"></div></div>
  `;

    api('/analysis').then(data => { renderAnalysis(data); })
        .catch(err => { document.getElementById('analysisContent').innerHTML = `<div class="empty-state"><div class="empty-desc">${err.message}</div></div>`; });
});

function renderAnalysis(data) {
    const el = document.getElementById('analysisContent');
    const totalTags = Object.values(data.preferred_tags).reduce((a, b) => a + b, 0) || 1;

    el.innerHTML = `
    <div class="card">
      <h3 style="font-size:16px;font-weight:700;margin-bottom:12px;">📈 行为总览</h3>
      <div class="analysis-grid">
        <div style="text-align:center;padding:12px;background:var(--bg);border-radius:var(--radius-sm);">
          <div style="font-size:28px;font-weight:800;color:var(--primary);">${data.total_views}</div>
          <div style="font-size:12px;color:var(--text-secondary);">总浏览数</div>
        </div>
        <div style="text-align:center;padding:12px;background:var(--bg);border-radius:var(--radius-sm);">
          <div style="font-size:28px;font-weight:800;color:#00b894;">${data.total_likes}</div>
          <div style="font-size:12px;color:var(--text-secondary);">总喜欢数</div>
        </div>
        <div style="text-align:center;padding:12px;background:var(--bg);border-radius:var(--radius-sm);">
          <div style="font-size:28px;font-weight:800;color:#e17055;">${data.total_skips}</div>
          <div style="font-size:12px;color:var(--text-secondary);">总跳过数</div>
        </div>
        <div style="text-align:center;padding:12px;background:var(--bg);border-radius:var(--radius-sm);">
          <div style="font-size:28px;font-weight:800;color:#fdcb6e;">${data.like_rate}%</div>
          <div style="font-size:12px;color:var(--text-secondary);">喜欢率</div>
        </div>
      </div>
    </div>
    <div class="card">
      <h3 style="font-size:16px;font-weight:700;margin-bottom:12px;">🎯 偏好标签 TOP5</h3>
      ${Object.entries(data.preferred_tags).slice(0, 5).map(([tag, count]) => `
        <div style="margin-bottom:8px;">
          <div style="display:flex;justify-content:space-between;font-size:13px;margin-bottom:2px;">
            <span>${tag}</span><span>${count}次</span>
          </div>
          <div style="height:6px;background:var(--border);border-radius:3px;overflow:hidden;">
            <div style="height:100%;background:var(--gradient);border-radius:3px;width:${(count / totalTags * 100).toFixed(0)}%;"></div>
          </div>
        </div>
      `).join('') || '<p style="color:var(--text-secondary);font-size:14px;">数据收集中~</p>'}
    </div>
    <div class="card">
      <h3 style="font-size:16px;font-weight:700;margin-bottom:12px;">📍 偏好性别</h3>
      <div style="display:flex;justify-content:center;gap:24px;">
        ${Object.entries(data.preferred_genders).map(([g, c]) => `
          <div style="text-align:center;">
            <div style="font-size:36px;">${g === 'male' ? '👨' : g === 'female' ? '👩' : '🤷'}</div>
            <div style="font-size:20px;font-weight:700;">${c}</div>
            <div style="font-size:12px;color:var(--text-secondary);">${g === 'male' ? '男生' : g === 'female' ? '女生' : '其他'}</div>
          </div>
        `).join('')}
      </div>
    </div>
    <div class="card">
      <h3 style="font-size:16px;font-weight:700;margin-bottom:12px;">📊 年龄段偏好</h3>
      ${Object.entries(data.preferred_ages).map(([age, count]) => {
        const maxCount = Math.max(...Object.values(data.preferred_ages), 1);
        return `
          <div style="margin-bottom:6px;">
            <div style="display:flex;justify-content:space-between;font-size:13px;">
              <span>${age}岁</span><span>${count}</span>
            </div>
            <div style="height:20px;background:var(--border);border-radius:4px;overflow:hidden;">
              <div style="height:100%;background:linear-gradient(90deg,#a18cd1,#fbc2eb);border-radius:4px;width:${(count / maxCount * 100).toFixed(0)}%;display:flex;align-items:center;padding-left:8px;font-size:11px;color:#fff;font-weight:600;">${count > 0 ? count : ''}</div>
            </div>
          </div>
        `;
    }).join('')}
    </div>
  `;
}

// ==================== 页面：AI 聊天助手 ====================
let aiChatMessages = [];
let aiChatGender = 'female';
let aiChatLoading = false;

const AI_SUGGESTIONS = [
    '你好呀，很高兴认识你~',
    '周末喜欢做什么呀？',
    '你觉得两个人在一起最重要的是什么？',
    '你喜欢什么类型的另一半？',
    '最近有看过什么好看的电影吗？',
    '你觉得什么样的聊天方式最让人舒服？',
    '如果遇到喜欢的人，你会怎么表达？',
];

registerPage('aichat', () => {
    if (!Store.isLoggedIn()) { navigateTo('login'); return; }

    const container = document.getElementById('pageContainer');
    container.innerHTML = `
    <div class="ai-chat-wrap" id="aiChatWrap">
      <div class="ai-chat-header">
        <h2 style="font-size:20px;font-weight:700;">🤖 AI聊天助手</h2>
        <p style="font-size:12px;color:var(--text-secondary);">模拟真实对话，提升你的沟通情商</p>
        <div class="ai-gender-toggle">
          <button class="ai-gender-btn ${aiChatGender === 'female' ? 'active' : ''}" 
                  data-gender="female" onclick="switchAIGender('female')">
            👩 女生
          </button>
          <button class="ai-gender-btn ${aiChatGender === 'male' ? 'active' : ''}" 
                  data-gender="male" onclick="switchAIGender('male')">
            👨 男生
          </button>
        </div>
        <div class="ai-chat-actions">
          <button class="ai-action-btn" onclick="clearAIChat()" title="清空对话">🗑️ 清空对话</button>
          <button class="ai-action-btn" onclick="rollAISuggestion()" title="换一个话题">🎲 聊天话题</button>
        </div>
      </div>
      <div class="ai-msgs" id="aiChatMessages">
        ${renderAIWelcome()}
      </div>
      <div class="ai-input-bar">
        <input type="text" class="form-input" id="aiChatInput" 
               placeholder="输入你想说的话..." 
               onkeydown="if(event.key==='Enter')sendAIMessage()" />
        <button class="chat-send-btn" id="aiSendBtn" onclick="sendAIMessage()">➤</button>
      </div>
    </div>
  `;

    // 滚动到底部
    setTimeout(() => {
        const el = document.getElementById('aiChatMessages');
        if (el) el.scrollTop = el.scrollHeight;
    }, 100);
});

function renderAIWelcome() {
    return `
    <div class="ai-welcome">
      <div class="ai-welcome-avatar">${aiChatGender === 'female' ? '👩' : '👨'}</div>
      <div class="ai-welcome-name">${aiChatGender === 'female' ? '小暖' : '子辰'}</div>
      <div class="ai-welcome-desc">
        ${aiChatGender === 'female'
            ? '嗨~ 我是小暖，一个活泼开朗的女生。来和我聊聊天吧，看看你的聊天水平怎么样！💕'
            : '你好~ 我是子辰，很高兴认识你。放轻松，就当是和朋友聊天一样~ 😊'}
      </div>
      <div class="ai-suggestion-bar">
        ${AI_SUGGESTIONS.slice(0, 4).map(s =>
                `<span class="ai-suggestion-chip" onclick="quickAISend('${s.replace(/'/g, "\\'")}')">${s}</span>`
            ).join('')}
      </div>
    </div>
  `;
}

function renderAIMessages() {
    const el = document.getElementById('aiChatMessages');
    if (!el) return;

    if (!aiChatMessages.length) {
        el.innerHTML = renderAIWelcome();
        el.scrollTop = el.scrollHeight;
        return;
    }

    el.innerHTML = aiChatMessages.map(m => {
        const isMe = m.role === 'user';
        return `
      <div class="ai-msg-row ${isMe ? 'me' : 'ai'}">
        ${!isMe ? `<div class="ai-msg-avatar">${aiChatGender === 'female' ? '👩' : '👨'}</div>` : ''}
        <div class="chat-msg-bubble ${isMe ? 'me' : 'other'}">${m.content}</div>
        ${isMe ? `<div class="ai-msg-avatar" style="font-size:20px;">👤</div>` : ''}
      </div>
    `;
    }).join('');

    if (aiChatLoading) {
        el.innerHTML += `
      <div class="ai-msg-row ai">
        <div class="ai-msg-avatar">${aiChatGender === 'female' ? '👩' : '👨'}</div>
        <div class="ai-typing">
          <span></span><span></span><span></span>
        </div>
      </div>
    `;
    }

    el.scrollTop = el.scrollHeight;
}

function switchAIGender(gender) {
    aiChatGender = gender;
    aiChatMessages = [];
    navigateTo('aichat');
}

function clearAIChat() {
    aiChatMessages = [];
    navigateTo('aichat');
    showToast('对话已清空', 'info');
}

function rollAISuggestion() {
    const list = AI_SUGGESTIONS;
    const suggestion = list[Math.floor(Math.random() * list.length)];
    const input = document.getElementById('aiChatInput');
    if (input) {
        input.value = suggestion;
        input.focus();
    }
    showToast('话题已填入输入框', 'info');
}

function quickAISend(text) {
    const input = document.getElementById('aiChatInput');
    if (input) {
        input.value = text;
        sendAIMessage();
    }
}

async function sendAIMessage() {
    if (aiChatLoading) return;
    const input = document.getElementById('aiChatInput');
    const btn = document.getElementById('aiSendBtn');
    if (!input) return;
    const content = input.value.trim();
    if (!content) return;

    input.value = '';
    input.disabled = true;
    if (btn) btn.disabled = true;
    aiChatLoading = true;

    // 添加用户消息
    aiChatMessages.push({ role: 'user', content });
    renderAIMessages();

    try {
        const res = await api('/ai-chat', {
            method: 'POST',
            body: JSON.stringify({
                messages: aiChatMessages,
                gender: aiChatGender,
            }),
        });
        aiChatMessages.push({ role: 'assistant', content: res.reply });
    } catch (err) {
        showToast(err.message, 'error');
    } finally {
        aiChatLoading = false;
        input.disabled = false;
        if (btn) btn.disabled = false;
        renderAIMessages();
        setTimeout(() => {
            const inp = document.getElementById('aiChatInput');
            if (inp) inp.focus();
        }, 200);
    }
}
// ==================== 启动应用 ====================
(function init() {
    if (Store.isLoggedIn()) {
        navigateTo('home');
    } else {
        navigateTo('login');
    }
})();
