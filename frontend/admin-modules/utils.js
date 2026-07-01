export function toast(msg, type) {
  type = type || "success";
  const div = document.createElement("div");
  div.className = "admin-toast toast-" + type;
  div.textContent = msg;
  document.getElementById("adminToast").appendChild(div);
  setTimeout(() => { div.remove(); }, 3000);
}

export function show(el) { document.getElementById(el).style.display = ""; }
export function hide(el) { document.getElementById(el).style.display = "none"; }
export function $(el) { return document.getElementById(el); }

export function setContent(html) { document.getElementById("contentArea").innerHTML = html; }

export function getRoleBadge(role) {
  const roleMap = {
    "user": { text: "普通用户", cls: "" },
    "moderator": { text: "审核员", cls: "badge-admin" },
    "admin": { text: "管理员", cls: "badge-admin" },
    "superadmin": { text: "超级管理员", cls: "badge-success" }
  };
  const r = roleMap[role] || roleMap["user"];
  return r.cls ? `<span class="badge ${r.cls}">${r.text}</span>` : r.text;
}