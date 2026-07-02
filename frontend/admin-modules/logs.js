import { api } from "./api.js";
import { setContent } from "./utils.js";

const LIST_HEADERS = {
  "logs": {
    "id": "ID", "user_id": "用户ID", "target_user_id": "目标用户ID",
    "action": "行为类型", "duration_ms": "时长(毫秒)", "extra": "扩展数据",
    "created_at": "时间"
  },
  "actions": {
    "id": "ID", "user_id": "用户ID", "target_user_id": "目标用户ID",
    "action_type": "交互类型", "created_at": "时间"
  },
  "chats": {
    "id": "ID", "from_user_id": "发送者", "to_user_id": "接收者",
    "content": "消息内容", "is_read": "已读", "created_at": "时间"
  },
  "admin-logs": {
    "id": "ID", "admin_id": "管理员ID", "action": "操作类型",
    "target_id": "目标ID", "detail": "详情", "created_at": "时间"
  }
};

let listPage = 1;
let listApi = "";

export async function loadLogs() { await loadList("logs", "📝 行为日志", ["user_id", "action"], ["用户ID", "行为类型"]); }
export async function loadActions() { await loadList("actions", "💝 交互记录", ["user_id", "action_type"], ["用户ID", "交互类型"]); }
export async function loadChats() { await loadList("chats", "💬 聊天监控", ["from_user_id", "to_user_id"], ["发送者", "接收者"]); }
export async function loadAdminLogs() { await loadList("admin-logs", "🔒 管理员操作日志", [], []); }

async function loadList(apiPath, title, filters, filterLabels) {
  listPage = 1; listApi = apiPath;
  const filterHtml = filters.length > 0 ? filters.map((f, i) => `<input type="text" id="filter_${f}" placeholder="${filterLabels[i]}" />`).join("") : "";
  setContent(`
    <h2 style="margin-bottom:20px">${title}</h2>
    <div class="card">
      <div class="toolbar">${filterHtml}<button class="btn btn-filled" onclick="window.admin.fetchList()">🔍 筛选</button></div>
      <div id="listContent">加载中...</div>
      <div class="pagination" id="listPagination"></div>
    </div>
  `);
  await fetchList();
}

export async function fetchList() {
  const params = new URLSearchParams({ page: listPage, page_size: 50 });
  if (listApi === "logs") {
    const uid = document.getElementById("filter_user_id")?.value;
    const act = document.getElementById("filter_action")?.value;
    if (uid) params.set("user_id", uid);
    if (act) params.set("action", act);
  } else if (listApi === "actions") {
    const uid = document.getElementById("filter_user_id")?.value;
    const at = document.getElementById("filter_action_type")?.value;
    if (uid) params.set("user_id", uid);
    if (at) params.set("action_type", at);
  } else if (listApi === "chats") {
    const fuid = document.getElementById("filter_from_user_id")?.value;
    const tuid = document.getElementById("filter_to_user_id")?.value;
    if (fuid) params.set("from_user_id", fuid);
    if (tuid) params.set("to_user_id", tuid);
  }
  try {
    const d = await api("/" + listApi + "?" + params.toString());
    const headers = LIST_HEADERS[listApi] || {};
    const headerHtml = Object.keys(headers).length > 0
      ? Object.values(headers).map(h => `<th>${h}</th>`).join("")
      : Object.keys(d.items[0] || {}).map(k => `<th>${k}</th>`).join("");
    const fieldOrder = Object.keys(headers).length > 0
      ? Object.keys(headers)
      : Object.keys(d.items[0] || {});
    const actionMap = {
      "like": "喜欢", "skip": "跳过", "super_like": "超级喜欢",
      "view_profile": "查看主页", "send_message": "发消息"
    };
    const boolMap = { "true": "是", "false": "否" };
    document.getElementById("listContent").innerHTML = `
      <div class="table-wrap"><table>
        <thead><tr>${headerHtml}</tr></thead>
        <tbody>
          ${(d.items || []).map(item => `
            <tr>${fieldOrder.map(k => {
      let v = item[k];
      if (k === "action" || k === "action_type") v = actionMap[v] || v;
      if (k === "is_read") v = boolMap[String(v)] ?? v;
      const s = typeof v === "object" && v !== null ? JSON.stringify(v) : (v ?? "");
      const str = String(s);
      return `<td>${str.length > 100 ? str.slice(0, 100) + "..." : str}</td>`;
    }).join("")}</tr>
          `).join("")}
        </tbody>
      </table></div>
      ${(d.items || []).length === 0 ? '<p style="color:var(--text-secondary);padding:10px">暂无数据</p>' : ''}
    `;
    const totalPages = Math.max(1, Math.ceil(d.total / d.page_size));
    document.getElementById("listPagination").innerHTML = `
      <span>共 ${d.total} 条，第 ${d.page}/${totalPages} 页</span>
      <button onclick="listPage=1;window.admin.fetchList()" ${listPage <= 1 ? 'disabled' : ''}>首页</button>
      <button onclick="listPage--;window.admin.fetchList()" ${listPage <= 1 ? 'disabled' : ''}>上一页</button>
      <button onclick="listPage++;window.admin.fetchList()" ${listPage >= totalPages ? 'disabled' : ''}>下一页</button>
      <button onclick="listPage=totalPages;window.admin.fetchList()" ${listPage >= totalPages ? 'disabled' : ''}>末页</button>
    `;
  } catch (e) { document.getElementById("listContent").innerHTML = `<p style="color:var(--danger)">加载失败：${e.message}</p>`; }
}