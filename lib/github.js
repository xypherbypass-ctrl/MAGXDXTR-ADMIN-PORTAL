/* ============================================================
   MAGXDXTR — GitHub API layer (runs entirely in the browser)
   The token is sent ONLY to api.github.com. Vercel hosts static
   files only — no serverless payload limits, so a 100 MB DLL is
   fine.
   ============================================================ */

const API = "https://api.github.com";

function headers(token) {
  const h = {
    Accept: "application/vnd.github+json",
    "X-GitHub-Api-Version": "2022-11-28",
  };
  if (token) h.Authorization = `Bearer ${token}`;
  return h;
}

async function parseError(res, context) {
  let data = {};
  try {
    data = await res.json();
  } catch {
    /* ignore */
  }
  let msg = data.message || `HTTP ${res.status}`;
  if (Array.isArray(data.errors) && data.errors.length) {
    msg += " — " + data.errors.map((e) => e.message || e.code || "").join(", ");
  }
  if (res.status === 401) msg = "Invalid or expired GitHub token";
  if (res.status === 403 && !data.message) msg = "GitHub blocked the request (rate limit or SSO)";
  if (res.status === 404) msg = `${context}: not found (check owner / repo name)`;
  const err = new Error(msg);
  err.status = res.status;
  return err;
}

/* ------------------------------------------------------------
   identity + repo validation
   ------------------------------------------------------------ */

export async function getUser(token) {
  const res = await fetch(`${API}/user`, { headers: headers(token) });
  if (!res.ok) throw await parseError(res, "token");
  return res.json();
}

export async function getRepo(owner, repo, token) {
  const res = await fetch(`${API}/repos/${enc(owner)}/${enc(repo)}`, {
    headers: headers(token),
  });
  if (!res.ok) throw await parseError(res, `${owner}/${repo}`);
  return res.json();
}

/* ------------------------------------------------------------
   contents API
   ------------------------------------------------------------ */

export async function getFileInfo(owner, repo, path, branch, token) {
  const url =
    `${API}/repos/${enc(owner)}/${enc(repo)}/contents/${encPath(path)}` +
    `?ref=${encodeURIComponent(branch)}`;
  const res = await fetch(url, { headers: headers(token) });
  if (res.status === 404) return null;
  if (!res.ok) throw await parseError(res, path);
  const data = await res.json();
  return { sha: data.sha, size: data.size };
}

// PUT with real upload progress (XHR — fetch has no upload events)
export function putFile({
  owner,
  repo,
  path,
  message,
  contentBase64,
  branch,
  token,
  sha,
  onProgress,
}) {
  const url = `${API}/repos/${enc(owner)}/${enc(repo)}/contents/${encPath(path)}`;
  const body = JSON.stringify({
    message,
    content: contentBase64,
    branch,
    ...(sha ? { sha } : {}),
  });

  return new Promise((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    xhr.open("PUT", url);
    xhr.setRequestHeader("Authorization", `Bearer ${token}`);
    xhr.setRequestHeader("Accept", "application/vnd.github+json");
    xhr.setRequestHeader("X-GitHub-Api-Version", "2022-11-28");
    xhr.setRequestHeader("Content-Type", "application/json");

    if (xhr.upload && onProgress) {
      xhr.upload.onprogress = (e) => {
        if (e.lengthComputable) onProgress(e.loaded / e.total);
      };
    }

    xhr.onload = () => {
      let data = {};
      try {
        data = JSON.parse(xhr.responseText);
      } catch {
        /* ignore */
      }
      if (xhr.status >= 200 && xhr.status < 300) {
        resolve(data);
      } else {
        let msg = data.message || `HTTP ${xhr.status}`;
        if (xhr.status === 401) msg = "Invalid or expired GitHub token";
        if (xhr.status === 409) msg = "File changed on GitHub — retry the push";
        if (xhr.status === 422)
          msg =
            "GitHub rejected the file (422) — " +
            (Array.isArray(data.errors)
              ? data.errors.map((e) => e.message || "").join(", ")
              : "check file size / content");
        reject(new Error(`${path}: ${msg}`));
      }
    };

    xhr.onerror = () =>
      reject(new Error("Network error reaching api.github.com — check your connection"));

    xhr.send(body);
  });
}

/* ------------------------------------------------------------
   live version (raw.githubusercontent — no token needed)
   ------------------------------------------------------------ */

export async function fetchLiveVersion(owner, repo, branch) {
  const url = `https://raw.githubusercontent.com/${enc(owner)}/${enc(repo)}/${enc(
    branch
  )}/version.json?_=${Date.now()}`;
  try {
    const res = await fetch(url, { cache: "no-store" });
    if (res.status === 404)
      return { ok: false, error: "version.json not published yet" };
    if (!res.ok) return { ok: false, error: `raw fetch HTTP ${res.status}` };
    const data = await res.json();
    return {
      ok: true,
      version: data.version || "?",
      hash: (data.files && data.files["Client.dll"]) || null,
      files: data.files || {},
      when: new Date(),
    };
  } catch {
    return { ok: false, error: "offline / DNS failure" };
  }
}

/* last commit touching version.json (needs token) */
export async function getLastUpdate(owner, repo, branch, token) {
  const list = await getCommits(owner, repo, branch, token, "version.json", 1);
  return list[0] || null;
}

/* recent commits for a path (needs token) */
export async function getCommits(owner, repo, branch, token, path, perPage = 5) {
  const url =
    `${API}/repos/${enc(owner)}/${enc(repo)}/commits` +
    `?path=${enc(path)}&sha=${encodeURIComponent(branch)}&per_page=${perPage}`;
  const res = await fetch(url, { headers: headers(token) });
  if (!res.ok) return [];
  const list = await res.json();
  if (!Array.isArray(list)) return [];
  return list.map((c) => ({
    message: (c.commit?.message || "").split("\n")[0],
    date: c.commit?.author?.date || null,
    url: c.html_url,
    author: c.commit?.author?.name || c.author?.login || "?",
  }));
}

/* branches of the repo (needs token) */
export async function getBranches(owner, repo, token) {
  const url = `${API}/repos/${enc(owner)}/${enc(repo)}/branches?per_page=50`;
  const res = await fetch(url, { headers: headers(token) });
  if (!res.ok) return [];
  const list = await res.json();
  if (!Array.isArray(list)) return [];
  return list.map((b) => b.name);
}

/* create an annotated-lightweight tag pointing at a commit */
export async function createTag(owner, repo, tag, sha, token) {
  const url = `${API}/repos/${enc(owner)}/${enc(repo)}/git/refs`;
  const res = await fetch(url, {
    method: "POST",
    headers: { ...headers(token), "Content-Type": "application/json" },
    body: JSON.stringify({ ref: `refs/tags/${tag}`, sha }),
  });
  if (!res.ok) throw await parseError(res, `tag ${tag}`);
  return res.json();
}

/* ------------------------------------------------------------
   helpers
   ------------------------------------------------------------ */

export async function sha256Hex(arrayBuffer) {
  const digest = await crypto.subtle.digest("SHA-256", arrayBuffer);
  return Array.from(new Uint8Array(digest))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

/* stream-download a file and hash it (progress = 0..1) */
export async function downloadAndHash(url, onProgress) {
  const res = await fetch(url, { cache: "no-store" });
  if (!res.ok) {
    if (res.status === 404) throw new Error("file not found on GitHub (404)");
    throw new Error(`download HTTP ${res.status}`);
  }

  const total = Number(res.headers.get("content-length")) || 0;
  const reader = res.body && res.body.getReader ? res.body.getReader() : null;

  if (!reader) {
    const buf = await res.arrayBuffer();
    if (onProgress) onProgress(1);
    return sha256Hex(buf);
  }

  const chunks = [];
  let loaded = 0;
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    chunks.push(value);
    loaded += value.length;
    if (onProgress && total) onProgress(Math.min(1, loaded / total));
  }

  const buf = new Uint8Array(loaded);
  let offset = 0;
  for (const c of chunks) {
    buf.set(c, offset);
    offset += c.length;
  }
  if (onProgress) onProgress(1);
  return sha256Hex(buf.buffer);
}

export function fileToBase64(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      const dataUrl = reader.result;
      resolve(String(dataUrl).split(",")[1] || "");
    };
    reader.onerror = () => reject(new Error("Could not read the selected file"));
    reader.readAsDataURL(file);
  });
}

export function strToBase64(str) {
  const bytes = new TextEncoder().encode(str);
  let bin = "";
  const chunk = 0x8000;
  for (let i = 0; i < bytes.length; i += chunk) {
    bin += String.fromCharCode.apply(null, bytes.subarray(i, i + chunk));
  }
  return btoa(bin);
}

// files = { "Client.dll": "<sha256>", "AimOptByDexter.dll": "<sha256>", ... }
export function buildManifest(version, files) {
  return JSON.stringify({ version, files }, null, 4) + "\n";
}

export function bumpVersion(v) {
  if (!v || typeof v !== "string") return "1.0.0";
  const m = v.trim().match(/^(\d+)\.(\d+)\.(\d+)$/);
  if (!m) return "1.0.0";
  return `${m[1]}.${m[2]}.${Number(m[3]) + 1}`;
}

export function fmtSize(bytes) {
  if (bytes >= 1024 * 1024) return (bytes / (1024 * 1024)).toFixed(2) + " MB";
  if (bytes >= 1024) return (bytes / 1024).toFixed(1) + " KB";
  return bytes + " B";
}

function enc(s) {
  return encodeURIComponent(String(s).trim());
}

function encPath(p) {
  return String(p)
    .split("/")
    .map(enc)
    .join("/");
}