const BASE = "/api/admin";
let token = localStorage.getItem("admin_token") || "";

export function setToken(newToken) {
  token = newToken;
  localStorage.setItem("admin_token", newToken);
}

export function getToken() {
  return token;
}

export function clearToken() {
  localStorage.removeItem("admin_token");
  token = "";
}

export async function api(path, opts) {
  opts = opts || {};
  opts.headers = opts.headers || {};
  if (token) opts.headers["Authorization"] = "Bearer " + token;
  if (opts.body && typeof opts.body === "object" && !(opts.body instanceof FormData)) {
    opts.headers["Content-Type"] = "application/json";
    opts.body = JSON.stringify(opts.body);
  }
  const r = await fetch(BASE + path, opts);
  const data = await r.json().catch(() => ({}));
  if (!r.ok) {
    if (r.status === 401 || r.status === 403) {
      clearToken();
      throw new Error("登录已过期");
    }
    throw new Error(data.detail || "请求失败");
  }
  return data;
}