import { api } from "./api.js";
import { setContent } from "./utils.js";

export async function loadDashboard() {
  setContent('<div class="card"><p>加载中...</p></div>');
  try {
    const d = await api("/dashboard");
    setContent(`
      <h2 style="margin-bottom:20px">📊 仪表盘</h2>
      <div class="stats-row">
        <div class="stat-card"><div class="stat-num">${d.total_users}</div><div class="stat-label">总用户数</div></div>
        <div class="stat-card"><div class="stat-num">${d.today_new}</div><div class="stat-label">今日新增</div></div>
        <div class="stat-card"><div class="stat-num">${d.active_7d}</div><div class="stat-label">7天活跃</div></div>
        <div class="stat-card"><div class="stat-num">${d.interactions_7d}</div><div class="stat-label">7天互动</div></div>
      </div>
      <div class="card">
        <h3>👥 用户构成</h3>
        <div style="display:flex;gap:40px;flex-wrap:wrap;padding-top:10px">
          <div>👨 男：<strong>${d.gender_ratio.male}</strong></div>
          <div>👩 女：<strong>${d.gender_ratio.female}</strong></div>
          <div>🔒 封禁：<strong style="color:var(--danger)">${d.banned_count}</strong></div>
        </div>
      </div>
      <div class="card">
        <h3>🏙️ 城市分布 Top10</h3>
        <table><thead><tr><th>排名</th><th>城市</th><th>人数</th></tr></thead>
        <tbody>${d.top_cities.map((c, i) => `<tr><td>${i + 1}</td><td>${c.city}</td><td>${c.count}</td></tr>`).join("")}</tbody></table>
        ${d.top_cities.length === 0 ? '<p style="color:var(--text-secondary);padding:10px">暂无数据</p>' : ''}
      </div>
    `);
  } catch (e) {
    setContent('<div class="card"><p style="color:var(--danger)">加载失败：' + e.message + '</p></div>');
  }
}