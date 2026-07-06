import { api } from "./api.js";
import { toast, setContent, getRoleBadge } from "./utils.js";
import { closeModal as _closeModal, openModal } from "./modal.js";

window.closeModal = _closeModal;
window.usersPage = 1;
window.usersTotalPages = 1;
let usersData = {};

export async function loadUsers() {
  setContent(`
    <h2 style="margin-bottom:20px">👥 用户管理</h2>
    <div class="card">
      <div class="toolbar">
        <input type="text" id="userSearch" placeholder="搜索手机号/昵称" />
        <select id="userGender"><option value="">全部性别</option><option value="male">男</option><option value="female">女</option></select>
        <select id="userStatus"><option value="">全部状态</option><option value="active">正常</option><option value="banned">封禁</option></select>
        <button class="btn btn-filled" onclick="window.admin.fetchUsers()">🔍 搜索</button>
      </div>
      <div class="table-wrap">
        <table><thead><tr>
          <th>ID</th><th>手机号</th><th>昵称</th><th>性别</th><th>年龄</th><th>城市</th><th>状态</th><th>角色</th><th>注册时间</th><th>操作</th>
        </tr></thead>
        <tbody id="userTableBody"><tr><td colspan="10">加载中...</td></tr></tbody></table>
      </div>
      <div class="pagination" id="userPagination"></div>
    </div>
  `);
  await fetchUsers();
}

export async function fetchUsers() {
  const q = document.getElementById("userSearch")?.value || "";
  const g = document.getElementById("userGender")?.value || "";
  const s = document.getElementById("userStatus")?.value || "";
  const params = new URLSearchParams({ page: window.usersPage, page_size: 20 });
  if (q) params.set("keyword", q);
  if (g) params.set("gender", g);
  if (s) params.set("status", s);
  try {
    const d = await api("/users?" + params.toString());
    usersData = d;
    document.getElementById("userTableBody").innerHTML = d.users.map(u => `
      <tr>
        <td>${u.id}</td><td>${u.phone}</td><td>${u.nickname}</td>
        <td>${u.gender === "male" ? "男" : u.gender === "female" ? "女" : "其他"}</td>
        <td>${u.age}</td><td>${u.city || "-"}</td>
        <td>${u.status === "banned" ? '<span class="badge badge-banned">封禁</span>' : '<span class="badge badge-active">正常</span>'}</td>
        <td>${getRoleBadge(u.role || 'user')}</td>
        <td>${u.created_at ? u.created_at.slice(0, 10) : "-"}</td>
        <td>
          <button class="btn btn-xs btn-outline" onclick="window.admin.viewUser(${u.id})">查看</button>
          <button class="btn btn-xs btn-outline ml-1" onclick="window.admin.editUser(${u.id})">编辑</button>
          <button class="btn btn-xs ${u.status === 'banned' ? 'btn-success' : 'btn-danger'} ml-1" onclick="window.admin.banUser(${u.id})">${u.status === 'banned' ? '解封' : '封禁'}</button>
          <button class="btn btn-xs btn-danger ml-1" onclick="window.admin.deleteUser(${u.id},'${u.nickname}')">删除</button>
        </td>
      </tr>
    `).join("");

    window.usersTotalPages = Math.ceil(d.total / d.page_size);
    document.getElementById("userPagination").innerHTML = `
      <span>共 ${d.total} 条，第 ${d.page}/${window.usersTotalPages} 页</span>
      <button onclick="window.usersPage=1;window.admin.fetchUsers()" ${window.usersPage <= 1 ? 'disabled' : ''}>首页</button>
      <button onclick="window.usersPage--;window.admin.fetchUsers()" ${window.usersPage <= 1 ? 'disabled' : ''}>上一页</button>
      <button onclick="window.usersPage++;window.admin.fetchUsers()" ${window.usersPage >= window.usersTotalPages ? 'disabled' : ''}>下一页</button>
      <button onclick="window.usersPage=window.usersTotalPages;window.admin.fetchUsers()" ${window.usersPage >= window.usersTotalPages ? 'disabled' : ''}>末页</button>
    `;
  } catch (e) {
    document.getElementById("userTableBody").innerHTML = `<tr><td colspan="10" style="color:var(--danger)">加载失败：${e.message}</td></tr>`;
  }
}

function getVipBadge(level) {
  const badges = {
    "free": '<span class="badge badge-secondary">普通会员</span>',
    "vip": '<span class="badge badge-vip">VIP会员</span>',
    "svip": '<span class="badge badge-svip">SVIP会员</span>'
  };
  return badges[level] || '<span class="badge badge-secondary">未知</span>';
}

export async function viewUser(id) {
  try {
    const u = await api("/users/" + id);
    const vipInfo = u.vip_level ? `
      <p>💎 会员等级：${getVipBadge(u.vip_level)}</p>
      <p>📅 会员过期：${u.vip_expire_at ? u.vip_expire_at.slice(0, 10) : "未设置"}</p>
      <p>🔄 自动续费：${u.vip_auto_renew ? '✅ 开启' : '❌ 关闭'}</p>
    ` : '';
    openModal(`
      <h3>👤 ${u.nickname} (ID: ${u.id})</h3>
      <p>📱 手机号：${u.phone}</p>
      <p>👤 性别：${u.gender === "male" ? "男" : u.gender === "female" ? "女" : "其他"} | 年龄：${u.age}</p>
      <p>🏙️ 城市：${u.city || "-"} | 💼 职业：${u.occupation || "-"}</p>
      <p>📝 介绍：${u.bio || "无"}</p>
      <p>🏷️ 兴趣：${(u.interests || []).join("、") || "无"}</p>
      <p>🎭 性格：${(u.personality_tags || []).join("、") || "无"}</p>
      <p>📸 相册：${(u.photos || []).length} 张</p>
      <p>🛡️ 角色：${getRoleBadge(u.role || 'user')} | 状态：${u.status}</p>
      ${vipInfo}
      <p>📅 注册：${u.created_at ? u.created_at.slice(0, 10) : "-"}</p>
      <div class="modal-actions">
        <button class="btn btn-outline" onclick="closeModal()">关闭</button>
        <button class="btn btn-filled" onclick="closeModal();window.admin.editUser(${u.id})">编辑</button>
      </div>
    `);
  } catch (e) { toast("查看失败：" + e.message, "error"); }
}

export async function editUser(id) {
  try {
    const u = await api("/users/" + id);
    openModal(`
      <h3>✏️ 编辑用户 #${id}</h3>
      <div class="form-group"><label>昵称</label><input type="text" id="editNick" value="${u.nickname}" /></div>
      <div class="form-group"><label>性别</label><select id="editGender"><option value="male" ${u.gender === 'male' ? 'selected' : ''}>男</option><option value="female" ${u.gender === 'female' ? 'selected' : ''}>女</option></select></div>
      <div class="form-group"><label>城市</label><input type="text" id="editCity" value="${u.city || ''}" /></div>
      <div class="form-group"><label>职业</label><input type="text" id="editJob" value="${u.occupation || ''}" /></div>
      <div class="form-group"><label>个人介绍</label><textarea id="editBio">${u.bio || ''}</textarea></div>
      <div class="form-group"><label>兴趣标签（逗号分隔）</label><input type="text" id="editInterests" value="${(u.interests || []).join(',')}" /></div>
      <div class="form-group"><label>性格标签（逗号分隔）</label><input type="text" id="editPersonality" value="${(u.personality_tags || []).join(',')}" /></div>
      <div class="form-group"><label>角色</label><select id="editRole">
        <option value="user" ${(u.role || 'user') === 'user' ? 'selected' : ''}>普通用户</option>
        <option value="moderator" ${u.role === 'moderator' ? 'selected' : ''}>审核员</option>
        <option value="admin" ${u.role === 'admin' ? 'selected' : ''}>管理员</option>
        <option value="superadmin" ${u.role === 'superadmin' ? 'selected' : ''}>超级管理员</option>
      </select></div>
      <div class="modal-actions">
        <button class="btn btn-outline" onclick="closeModal()">取消</button>
        <button class="btn btn-filled" id="saveEditBtn">保存</button>
      </div>
    `);
    document.getElementById("saveEditBtn").addEventListener("click", async function () {
      const data = {
        nickname: document.getElementById("editNick").value.trim(),
        gender: document.getElementById("editGender").value,
        city: document.getElementById("editCity").value.trim(),
        occupation: document.getElementById("editJob").value.trim(),
        bio: document.getElementById("editBio").value.trim(),
        interests: document.getElementById("editInterests").value.split(",").map(s => s.trim()).filter(Boolean),
        personality_tags: document.getElementById("editPersonality").value.split(",").map(s => s.trim()).filter(Boolean),
        role: document.getElementById("editRole").value,
      };
      try {
        await api("/users/" + id, { method: "PUT", body: data });
        toast("保存成功"); closeModal(); fetchUsers();
      } catch (e) { toast("保存失败：" + e.message, "error"); }
    });
  } catch (e) { toast("获取用户失败：" + e.message, "error"); }
}

export async function banUser(id) {
  if (!confirm("确定要切换该用户的封禁状态吗？")) return;
  try {
    const r = await api("/users/" + id + "/ban", { method: "PUT", body: { reason: "管理员操作" } });
    toast(r.message); fetchUsers();
  } catch (e) { toast("操作失败：" + e.message, "error"); }
}

export async function deleteUser(id, name) {
  if (!confirm(`确定要删除用户"${name}"(ID:${id})吗？此操作不可恢复！`)) return;
  try {
    const r = await api("/users/" + id, { method: "DELETE" });
    toast(r.message); fetchUsers();
  } catch (e) { toast("删除失败：" + e.message, "error"); }
}