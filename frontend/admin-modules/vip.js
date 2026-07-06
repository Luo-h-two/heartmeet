import { api } from "./api.js";
import { toast, setContent } from "./utils.js";
import { closeModal as _closeModal, openModal } from "./modal.js";

window.closeModal = _closeModal;
window.vipPage = 1;
window.vipTotalPages = 1;
let vipData = {};
let vipStats = {};

function getVipBadge(level) {
    const badges = {
        "free": '<span class="badge badge-secondary">普通会员</span>',
        "vip": '<span class="badge badge-vip">VIP会员</span>',
        "svip": '<span class="badge badge-svip">SVIP会员</span>'
    };
    return badges[level] || '<span class="badge badge-secondary">未知</span>';
}

export async function loadVip() {
    await loadVipStats();
    setContent(`
        <h2 style="margin-bottom:20px">💎 会员管理</h2>
        
        <div class="card-grid" style="display:grid;grid-template-columns:repeat(4,1fr);gap:16px;margin-bottom:24px;">
            <div class="stat-card"><div class="stat-value">${vipStats.total_free || 0}</div><div class="stat-label">普通会员</div></div>
            <div class="stat-card"><div class="stat-value" style="color:var(--primary)">${vipStats.total_vip || 0}</div><div class="stat-label">VIP会员</div></div>
            <div class="stat-card"><div class="stat-value" style="color:#ffa502">${vipStats.total_svip || 0}</div><div class="stat-label">SVIP会员</div></div>
            <div class="stat-card"><div class="stat-value" style="color:var(--success)">${vipStats.active_vip || 0}</div><div class="stat-label">活跃会员</div></div>
        </div>

        <div class="card">
            <div class="toolbar">
                <input type="text" id="vipSearch" placeholder="搜索手机号/昵称" />
                <select id="vipLevel"><option value="">全部等级</option><option value="free">普通会员</option><option value="vip">VIP会员</option><option value="svip">SVIP会员</option></select>
                <button class="btn btn-filled" onclick="window.admin.fetchVipUsers()">🔍 搜索</button>
            </div>
            <div class="table-wrap">
                <table><thead><tr>
                    <th>ID</th><th>手机号</th><th>昵称</th><th>会员等级</th><th>过期时间</th><th>自动续费</th><th>注册时间</th><th>操作</th>
                </tr></thead>
                <tbody id="vipTableBody"><tr><td colspan="8">加载中...</td></tr></tbody></table>
            </div>
            <div class="pagination" id="vipPagination"></div>
        </div>
    `);
    await fetchVipUsers();
}

async function loadVipStats() {
    try {
        vipStats = await api("/vip/stats");
    } catch (e) {
        vipStats = {};
        toast("加载会员统计失败：" + e.message, "error");
    }
}

export async function fetchVipUsers() {
    const q = document.getElementById("vipSearch")?.value || "";
    const l = document.getElementById("vipLevel")?.value || "";
    const params = new URLSearchParams({ page: window.vipPage, page_size: 20 });
    if (q) params.set("keyword", q);
    if (l) params.set("vip_level", l);
    
    try {
        const d = await api("/vip/list?" + params.toString());
        vipData = d;
        
        document.getElementById("vipTableBody").innerHTML = d.users.map(u => `
            <tr>
                <td>${u.id}</td><td>${u.phone}</td><td>${u.nickname}</td>
                <td>${getVipBadge(u.vip_level)}</td>
                <td>${u.vip_expire_at ? u.vip_expire_at.slice(0, 10) : "-"}</td>
                <td>${u.vip_auto_renew ? '✅' : '❌'}</td>
                <td>${u.created_at ? u.created_at.slice(0, 10) : "-"}</td>
                <td>
                    <button class="btn btn-xs btn-outline" onclick="window.admin.editVip(${u.id})">编辑会员</button>
                    <button class="btn btn-xs btn-success ml-1" onclick="window.admin.extendVip(${u.id})">延长有效期</button>
                </td>
            </tr>
        `).join("");

        window.vipTotalPages = Math.ceil(d.total / d.page_size);
        document.getElementById("vipPagination").innerHTML = `
            <span>共 ${d.total} 条，第 ${d.page}/${window.vipTotalPages} 页</span>
            <button onclick="window.vipPage=1;window.admin.fetchVipUsers()" ${window.vipPage <= 1 ? 'disabled' : ''}>首页</button>
            <button onclick="window.vipPage--;window.admin.fetchVipUsers()" ${window.vipPage <= 1 ? 'disabled' : ''}>上一页</button>
            <button onclick="window.vipPage++;window.admin.fetchVipUsers()" ${window.vipPage >= window.vipTotalPages ? 'disabled' : ''}>下一页</button>
            <button onclick="window.vipPage=window.vipTotalPages;window.admin.fetchVipUsers()" ${window.vipPage >= window.vipTotalPages ? 'disabled' : ''}>末页</button>
        `;
    } catch (e) {
        document.getElementById("vipTableBody").innerHTML = `<tr><td colspan="8" style="color:var(--danger)">加载失败：${e.message}</td></tr>`;
    }
}

export async function editVip(userId) {
    try {
        const d = await api("/vip/list?page=1&page_size=1&keyword=" + userId);
        const user = d.users.find(u => u.id == userId);
        if (!user) { toast("用户不存在", "error"); return; }
        
        openModal(`
            <h3>✏️ 编辑会员 #${userId}</h3>
            <div class="form-group"><label>用户</label><input type="text" value="${user.nickname} (${user.phone})" disabled /></div>
            <div class="form-group"><label>当前等级</label><input type="text" value="${user.vip_level === 'free' ? '普通会员' : user.vip_level === 'vip' ? 'VIP会员' : 'SVIP会员'}" disabled /></div>
            <div class="form-group"><label>新会员等级</label><select id="vipNewLevel">
                <option value="free" ${user.vip_level === 'free' ? 'selected' : ''}>普通会员</option>
                <option value="vip" ${user.vip_level === 'vip' ? 'selected' : ''}>VIP会员</option>
                <option value="svip" ${user.vip_level === 'svip' ? 'selected' : ''}>SVIP会员</option>
            </select></div>
            <div class="form-group"><label>有效期天数</label><input type="number" id="vipDuration" value="30" min="1" max="365" /></div>
            <div class="form-group"><label><input type="checkbox" id="vipAutoRenew" ${user.vip_auto_renew ? 'checked' : ''} /> 自动续费</label></div>
            <div class="modal-actions">
                <button class="btn btn-outline" onclick="closeModal()">取消</button>
                <button class="btn btn-filled" id="saveVipBtn">保存</button>
            </div>
        `);
        
        document.getElementById("saveVipBtn").addEventListener("click", async function () {
            const data = {
                vip_level: document.getElementById("vipNewLevel").value,
                duration_days: parseInt(document.getElementById("vipDuration").value) || 30,
                vip_auto_renew: document.getElementById("vipAutoRenew").checked
            };
            try {
                await api("/vip/update/" + userId, { method: "PUT", body: data });
                toast("会员信息已更新");
                closeModal();
                loadVip();
            } catch (e) { toast("保存失败：" + e.message, "error"); }
        });
    } catch (e) { toast("获取用户信息失败：" + e.message, "error"); }
}

export async function extendVip(userId) {
    try {
        const d = await api("/vip/list?page=1&page_size=1&keyword=" + userId);
        const user = d.users.find(u => u.id == userId);
        if (!user) { toast("用户不存在", "error"); return; }
        
        openModal(`
            <h3>⏰ 延长会员有效期 #${userId}</h3>
            <div class="form-group"><label>用户</label><input type="text" value="${user.nickname} (${user.phone})" disabled /></div>
            <div class="form-group"><label>当前等级</label><input type="text" value="${user.vip_level === 'free' ? '普通会员' : user.vip_level === 'vip' ? 'VIP会员' : 'SVIP会员'}" disabled /></div>
            <div class="form-group"><label>当前过期时间</label><input type="text" value="${user.vip_expire_at || '未设置'}" disabled /></div>
            <div class="form-group"><label>延长天数</label><input type="number" id="extendDays" value="30" min="1" max="365" /></div>
            <div class="modal-actions">
                <button class="btn btn-outline" onclick="closeModal()">取消</button>
                <button class="btn btn-filled" id="extendVipBtn">确认延长</button>
            </div>
        `);
        
        document.getElementById("extendVipBtn").addEventListener("click", async function () {
            const data = { duration_days: parseInt(document.getElementById("extendDays").value) || 30 };
            try {
                await api("/vip/extend/" + userId, { method: "PUT", body: data });
                toast("有效期已延长");
                closeModal();
                loadVip();
            } catch (e) { toast("操作失败：" + e.message, "error"); }
        });
    } catch (e) { toast("获取用户信息失败：" + e.message, "error"); }
}

