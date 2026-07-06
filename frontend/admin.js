import { api, setToken, clearToken } from "./admin-modules/api.js";
import { toast, show, hide, $ } from "./admin-modules/utils.js";
import { initModal, closeModal } from "./admin-modules/modal.js";
import { loadDashboard } from "./admin-modules/dashboard.js";
import { loadUsers, fetchUsers, viewUser, editUser, banUser, deleteUser } from "./admin-modules/users.js";
import { loadLogs, loadActions, loadChats, loadAdminLogs, fetchList } from "./admin-modules/logs.js";
import { loadVip, fetchVipUsers, editVip, extendVip } from "./admin-modules/vip.js";

window.closeModal = closeModal;

window.admin = {
  fetchUsers, viewUser, editUser, banUser, deleteUser, fetchList,
  fetchVipUsers, editVip, extendVip
};

function setContent(html) { document.getElementById("contentArea").innerHTML = html; }

function showLogin() {
  hide("mainPanel"); show("loginPage");
  document.getElementById("loginError").style.display = "none";
}

function showMain() {
  hide("loginPage"); show("mainPanel");
  loadDashboard();
}

document.getElementById("loginForm").addEventListener("submit", async function (e) {
  e.preventDefault();
  const phone = document.getElementById("loginPhone").value.trim();
  const pwd = document.getElementById("loginPwd").value.trim();
  const errEl = document.getElementById("loginError");
  errEl.style.display = "none";
  if (!phone || !pwd) { errEl.textContent = "请输入手机号和密码"; errEl.style.display = ""; return; }
  try {
    const data = await api("/login", { method: "POST", body: { phone, password: pwd } });
    setToken(data.access_token);
    document.getElementById("adminInfo").textContent = "👤 " + (data.user.nickname || phone) + (data.user.role ? " [" + data.user.role + "]" : "");
    showMain();
    highlightNav("dashboard");
  } catch (e) {
    errEl.textContent = e.message; errEl.style.display = "";
  }
});

window.alogout = function () {
  clearToken(); showLogin();
};

const pages = {
  "dashboard": loadDashboard,
  "users": loadUsers,
  "vip": loadVip,
  "logs": loadLogs,
  "actions": loadActions,
  "chats": loadChats,
  "adminLogs": loadAdminLogs
};

document.getElementById("sidebarMenu").addEventListener("click", function (e) {
  e.preventDefault();
  const a = e.target.closest("a");
  if (!a) return;
  const page = a.dataset.page;
  if (pages[page]) { pages[page](); highlightNav(page); }
});

function highlightNav(page) {
  document.querySelectorAll("#sidebarMenu a").forEach(a => a.classList.remove("active"));
  const a = document.querySelector('#sidebarMenu a[data-page="' + page + '"]');
  if (a) a.classList.add("active");
}

initModal();

if (localStorage.getItem("admin_token")) {
  api("/me").then(u => {
    document.getElementById("adminInfo").textContent = "👤 " + (u.nickname || u.phone);
    showMain();
    highlightNav("dashboard");
  }).catch(() => { showLogin(); });
} else {
  showLogin();
} 