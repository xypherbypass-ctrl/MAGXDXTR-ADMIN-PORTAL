"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import LogTerminal from "./LogTerminal";
import * as gh from "../lib/github";

const DEFAULT_OWNER = "xypherbypass-ctrl";
const DEFAULT_REPO = "SilentAim-Auto-Update-Loader-New";
const DEFAULT_BRANCH = "main";
const DEFAULT_MSG = "Update Client.dll v{version}";

function UploadIcon() {
  return (
    <svg className="drop__icon" viewBox="0 0 48 48" fill="none" aria-hidden="true">
      <path
        d="M24 32 L24 10 M24 10 L16 18 M24 10 L32 18"
        stroke="currentColor"
        strokeWidth="2.4"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <path
        d="M8 30 L8 40 L40 40 L40 30"
        stroke="currentColor"
        strokeWidth="2.4"
        strokeLinecap="round"
        strokeLinejoin="round"
        opacity="0.55"
      />
    </svg>
  );
}

function CheckIcon() {
  return (
    <svg className="success__icon" viewBox="0 0 60 60" aria-hidden="true">
      <circle cx="30" cy="30" r="27" />
      <path d="M18 31 L26 39 L43 21" />
    </svg>
  );
}

function ExtIcon() {
  return (
    <svg viewBox="0 0 16 16" fill="none" aria-hidden="true">
      <path
        d="M6 3 L11 3 L11 8 M11 3 L4 12"
        stroke="currentColor"
        strokeWidth="1.6"
        strokeLinecap="round"
      />
    </svg>
  );
}

export default function Portal() {
  /* -------- connection -------- */
  const [token, setToken] = useState("");
  const [showToken, setShowToken] = useState(false);
  const [remember, setRemember] = useState(false);
  const [session, setSession] = useState(null);
  const [repoInfo, setRepoInfo] = useState(null);
  const [branches, setBranches] = useState([]);

  /* -------- target -------- */
  const [owner, setOwner] = useState(DEFAULT_OWNER);
  const [repo, setRepo] = useState(DEFAULT_REPO);
  const [branch, setBranch] = useState(DEFAULT_BRANCH);

  /* -------- file -------- */
  const [file, setFile] = useState(null);
  const [fileMeta, setFileMeta] = useState(null);
  const [version, setVersion] = useState("");
  const [dragOver, setDragOver] = useState(false);

  /* -------- options -------- */
  const [commitMsg, setCommitMsg] = useState(DEFAULT_MSG);
  const [notes, setNotes] = useState("");
  const [makeTag, setMakeTag] = useState(true);
  const [verifyAfter, setVerifyAfter] = useState(true);

  /* -------- live -------- */
  const [live, setLive] = useState({ ok: false, error: "loading…" });
  const [liveLoaded, setLiveLoaded] = useState(false);
  const [activity, setActivity] = useState([]);

  /* -------- deploy state -------- */
  const [busy, setBusy] = useState(false);
  const [phase, setPhase] = useState("idle");
  const [progress, setProgress] = useState(0);
  const [statusText, setStatusText] = useState("Standing by");
  const [logs, setLogs] = useState([]);

  const fileInputRef = useRef(null);

  const log = useCallback((level, text) => {
    setLogs((prev) => [...prev.slice(-199), { level, text, t: new Date() }]);
  }, []);

  const rawDll = `https://raw.githubusercontent.com/${owner}/${repo}/${branch}/Client.dll`;
  const rawManifest = `https://raw.githubusercontent.com/${owner}/${repo}/${branch}/version.json`;
  const repoUrl = `https://github.com/${owner}/${repo}`;

  const loadActivity = useCallback(async () => {
    if (!session) return;
    const list = await gh.getCommits(owner, repo, branch, token, "version.json", 5);
    setActivity(list);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [session, owner, repo, branch]);

  const refreshLive = useCallback(
    async (logIt = true) => {
      const info = await gh.fetchLiveVersion(owner, repo, branch);
      setLive(info);
      setLiveLoaded(true);
      if (info.ok) {
        if (logIt) log("ok", `Live on GitHub: v${info.version}`);
        if (!version) setVersion(gh.bumpVersion(info.version));
      } else if (logIt) {
        log("info", `version.json: ${info.error}`);
      }
      loadActivity();
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [owner, repo, branch, session]
  );

  /* -------- boot -------- */
  useEffect(() => {
    const saved = window.localStorage.getItem("mx_token");
    if (saved) {
      setToken(saved);
      setRemember(true);
      log("info", "Restored saved GitHub token from this browser");
    }
    refreshLive(false);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  /* -------- scroll reveal for cards -------- */
  useEffect(() => {
    const els = Array.from(document.querySelectorAll("[data-reveal]"));
    if (!("IntersectionObserver" in window)) {
      els.forEach((el) => el.classList.add("is-visible"));
      return;
    }
    const io = new IntersectionObserver(
      (entries) => {
        entries.forEach((en) => {
          if (en.isIntersecting) {
            en.target.classList.add("is-visible");
            io.unobserve(en.target);
          }
        });
      },
      { threshold: 0.1, rootMargin: "0px 0px -30px 0px" }
    );
    els.forEach((el) => io.observe(el));
    return () => io.disconnect();
  }, []);

  /* ------------------------------------------------------------ */

  const connect = async () => {
    if (busy) return;
    const t = token.trim();
    if (!t) {
      log("err", "Paste a GitHub token first (repo scope)");
      return;
    }
    setBusy(true);
    setStatusText("Authenticating…");
    try {
      log("step", "Validating token against api.github.com…");
      const user = await gh.getUser(t);
      const info = await gh.getRepo(owner.trim(), repo.trim(), t);
      setSession(user);
      setRepoInfo(info);
      const def = info.default_branch || DEFAULT_BRANCH;
      setBranch(def);
      if (remember) window.localStorage.setItem("mx_token", t);
      else window.localStorage.removeItem("mx_token");
      log("ok", `Authenticated as ${user.login}`);
      log("ok", `Target locked: ${info.full_name} [${def}]`);

      const bs = await gh.getBranches(owner.trim(), repo.trim(), t);
      setBranches(bs.length ? bs : [def]);
      if (bs.length) log("info", `Branches available: ${bs.join(", ")}`);

      await refreshLive();
      setStatusText("Connected");
    } catch (e) {
      log("err", e.message);
      setStatusText("Connection failed");
    } finally {
      setBusy(false);
    }
  };

  const disconnect = () => {
    setSession(null);
    setRepoInfo(null);
    setBranches([]);
    setActivity([]);
    window.localStorage.removeItem("mx_token");
    log("info", "Token cleared from this browser");
    setStatusText("Standing by");
  };

  /* -------- file -------- */

  const handleFile = async (f) => {
    if (!f || busy) return;
    if (!/\.dll$/i.test(f.name)) {
      log("err", `"${f.name}" rejected — only .dll files are accepted`);
      return;
    }
    setFile(f);
    setFileMeta(null);
    setPhase("idle");
    setProgress(0);
    setStatusText("Hashing file…");
    log("step", `Reading ${f.name} (${gh.fmtSize(f.size)})…`);
    try {
      const buf = await f.arrayBuffer();
      const hash = await gh.sha256Hex(buf);
      setFileMeta({ name: f.name, size: f.size, hash });
      log("ok", `SHA-256 ${hash}`);
      log("info", "File verified locally — ready to deploy");
      setStatusText("Ready to push");
      if (!version) setVersion(gh.bumpVersion(live.ok ? live.version : null));
    } catch (e) {
      log("err", "Hash failed: " + e.message);
      setStatusText("Hash failed");
    }
  };

  const onDrop = (e) => {
    e.preventDefault();
    setDragOver(false);
    handleFile(e.dataTransfer?.files?.[0]);
  };

  /* -------- dry-run validation -------- */

  const validate = async () => {
    if (busy) return;
    if (!fileMeta) {
      log("err", "Select a Client.dll first");
      return;
    }

    setBusy(true);
    setProgress(4);
    setStatusText("Validating…");
    log("step", "DRY RUN — nothing will be pushed");

    try {
      log("info", `Local  : ${fileMeta.name} — sha256 ${fileMeta.hash}`);
      setProgress(14);

      const info = await gh.fetchLiveVersion(owner, repo, branch);
      setProgress(26);

      if (!info.ok) {
        log("info", `Manifest: ${info.error} → push will initialize it`);
      } else {
        setLive(info);
        log("info", `Manifest: v${info.version} — sha256 ${info.hash || "none"}`);
        if (info.hash === fileMeta.hash) {
          log("ok", "Already deployed — local file matches the live manifest");
        } else {
          log("step", "Update required — hashes differ, push will publish this build");
        }
      }

      log("step", "Deep verify: downloading remote Client.dll…");
      let remoteHash = null;
      try {
        remoteHash = await gh.downloadAndHash(`${rawDll}?_=${Date.now()}`, (p) =>
          setProgress(26 + Math.round(p * 64))
        );
        log("info", `Remote : sha256 ${remoteHash}`);
      } catch (e) {
        log("info", `Remote Client.dll: ${e.message} → first push will create it`);
      }

      setProgress(96);

      if (remoteHash) {
        if (remoteHash === fileMeta.hash) {
          log("ok", "GitHub already stores this exact DLL");
        } else if (info.ok && info.hash && remoteHash === info.hash) {
          log("ok", "GitHub verified IN SYNC — manifest matches the stored DLL");
        } else {
          log(
            "err",
            "GitHub OUT OF SYNC — version.json does not match Client.dll on the server (push will repair it)"
          );
        }
      }

      setProgress(100);
      setStatusText("Validation complete");
      log("ok", "Dry run finished — no changes were made");
    } catch (e) {
      setProgress(0);
      setStatusText("Validation failed");
      log("err", "Validate failed: " + e.message);
    } finally {
      setBusy(false);
    }
  };

  /* -------- the push -------- */

  const push = async () => {
    if (busy) return;
    const t = token.trim();
    const ver = version.trim();

    if (!session) {
      log("err", "Connect your GitHub token first");
      return;
    }
    if (!file || !fileMeta) {
      log("err", "Select a Client.dll first");
      return;
    }
    if (!/^\d+\.\d+\.\d+$/.test(ver)) {
      log("err", "Version must look like 1.0.2 (major.minor.patch)");
      return;
    }

    const o = owner.trim();
    const r = repo.trim();
    const b = branch;

    let message = (commitMsg || DEFAULT_MSG).split("{version}").join(ver);
    if (notes.trim()) message += "\n\n" + notes.trim();

    setBusy(true);
    setPhase("working");
    setProgress(4);
    setStatusText("Preparing payload…");
    log("step", `Deploying v${ver} → ${o}/${r}@${b}`);

    try {
      /* 1 — encode */
      setProgress(10);
      const b64 = await gh.fileToBase64(file);
      setProgress(20);

      /* 2 — DLL first, so version.json never points at a missing file */
      const dllInfo = await gh.getFileInfo(o, r, "Client.dll", b, t);
      setProgress(26);
      log(
        "step",
        `Uploading Client.dll (${gh.fmtSize(file.size)}) — ${
          dllInfo ? "updating existing blob" : "creating new blob"
        }…`
      );
      await gh.putFile({
        owner: o,
        repo: r,
        path: "Client.dll",
        message,
        contentBase64: b64,
        branch: b,
        token: t,
        sha: dllInfo?.sha,
        onProgress: (p) => setProgress(26 + Math.round(p * 44)),
      });
      setProgress(74);
      log("ok", "Client.dll committed");

      /* 3 — version.json */
      const manifest = gh.buildManifest(ver, fileMeta.hash);
      const vInfo = await gh.getFileInfo(o, r, "version.json", b, t);
      setProgress(80);
      log("step", "Publishing version.json…");
      const vResp = await gh.putFile({
        owner: o,
        repo: r,
        path: "version.json",
        message: `Update version.json v${ver}`,
        contentBase64: gh.strToBase64(manifest),
        branch: b,
        token: t,
        sha: vInfo?.sha,
        onProgress: (p) => setProgress(80 + Math.round(p * 12)),
      });

      /* 4 — optional tag */
      if (makeTag) {
        const tagSha = vResp?.commit?.sha;
        if (tagSha) {
          try {
            await gh.createTag(o, r, `v${ver}`, tagSha, t);
            log("ok", `Tag v${ver} created`);
          } catch (e) {
            log("info", `Tag skipped: ${e.message}`);
          }
        }
      }

      setProgress(94);

      /* 5 — optional post-push deep verify */
      if (verifyAfter) {
        log("step", "Post-push verify: downloading the published DLL…");
        try {
          const remote = await gh.downloadAndHash(`${rawDll}?_=${Date.now()}`, (p) =>
            setProgress(94 + Math.round(p * 5))
          );
          if (remote === fileMeta.hash) {
            log("ok", "Post-push verify passed — GitHub serves your exact file");
          } else {
            log("err", "Post-push verify mismatch — CDN may still be stale, retry in a minute");
          }
        } catch (e) {
          log("info", `Post-push verify skipped: ${e.message}`);
        }
      }

      setProgress(100);
      setPhase("done");
      setStatusText(`v${ver} deployed`);
      log("ok", `Deployment complete — v${ver} is live on GitHub`);
      log("info", "Raw CDN refreshes within ~5 minutes");

      await refreshLive();
    } catch (e) {
      setPhase("error");
      setProgress(0);
      setStatusText("Deployment failed");
      log("err", e.message);
    } finally {
      setBusy(false);
    }
  };

  const reset = () => {
    setFile(null);
    setFileMeta(null);
    setPhase("idle");
    setProgress(0);
    setStatusText(session ? "Ready to push" : "Standing by");
  };

  /* ------------------------------------------------------------ */

  const branchOptions = Array.from(new Set([branch, ...branches]));

  return (
    <>
      {/* ---------- background ---------- */}
      <div className="bg-layer" aria-hidden="true">
        <div className="orb orb--violet" />
        <div className="orb orb--blood" />
        <div className="orb orb--deep" />
        <div className="grid-lines" />
        <div className="noise" />
        <div className="vignette" />
      </div>

      <div className="shell">
        {/* ---------- header ---------- */}
        <header className="topbar">
          <div className="brand">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img className="brand__logo" src="/magxdxtr-logo.png" alt="MAGXDXTR" />
            <div className="brand__text">
              <span className="brand__name">
                MAGXDXTR <em>ADMIN PORTAL</em>
              </span>
              <span className="brand__tag">Cursed Energy · DLL Deployment</span>
            </div>
          </div>
          <div className="topbar__right">
            <span className="pill">
              <span
                className={`pill__dot${
                  liveLoaded && live.ok ? "" : " pill__dot--off"
                }`}
              />
              {!liveLoaded
                ? "SYNCING…"
                : live.ok
                ? `LIVE · v${live.version}`
                : "NO LIVE VERSION"}
            </span>
          </div>
        </header>

        {/* ---------- hero ---------- */}
        <section className="hero">
          <span className="hero__kanji" aria-hidden="true">
            呪
          </span>

          <div className="hero__grid">
            <div className="hero__copy">
              <p className="eyebrow">Sorcerer Killer // Deployment System</p>
              <h1 className="hero__title">
                <span className="row">
                  <span style={{ "--d": "0.45s" }}>Push the</span>
                </span>
                <span className="row">
                  <span className="grad-text" style={{ "--d": "0.65s" }}>
                    update through
                  </span>
                </span>
              </h1>
              <p className="hero__sub">
                Drop your rebuilt <b>Client.dll</b>, sign with your GitHub token,
                and the portal hashes it, commits it, and publishes{" "}
                <b>version.json</b> in one motion. The loader picks it up from
                GitHub automatically — no manual uploads, no mismatched files
                ever again.
              </p>

              <div className="hero__chips">
                <span className="chip">
                  <i /> SHA-256 verified
                </span>
                <span className="chip">
                  <i /> Atomic two-commit push
                </span>
                <span className="chip">
                  <i /> Dry-run validation
                </span>
                <span className="chip">
                  <i /> Tag + verify options
                </span>
              </div>
            </div>

            <div className="hero__visual">
              <div className="hero__aura" aria-hidden="true" />
              <div className="hero__toji-wrap">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  className="hero__toji"
                  src="/toji.png"
                  alt="Toji Fushiguro"
                />
              </div>
            </div>
          </div>
        </section>

        {/* ---------- grid ---------- */}
        <main className="grid">
          {/* LIVE STATUS */}
          <section className="card card--wide" data-reveal style={{ "--d": "0s" }}>
            <div className="card__head">
              <div>
                <div className="card__step">// live status</div>
                <h2 className="card__title">Repository Telemetry</h2>
              </div>
              <span className="card__hint">
                {branch} · {live.ok ? "version.json synced" : "checking…"}
              </span>
            </div>

            <div className="stats">
              <div className="stat">
                <div className="stat__key">Live version</div>
                <div
                  className={`stat__val ${
                    live.ok ? "stat__val--violet" : "stat__val--dim"
                  }`}
                >
                  {live.ok ? `v${live.version}` : "—"}
                </div>
                <div className="stat__sub">
                  {live.ok ? "published on GitHub" : live.error}
                </div>
              </div>

              <div className="stat">
                <div className="stat__key">DLL SHA-256</div>
                <div className="stat__val stat__val--dim" style={{ fontSize: 12 }}>
                  {live.ok && live.hash ? live.hash : "—"}
                </div>
                <div className="stat__sub">verified by the loader</div>
              </div>

              <div className="stat">
                <div className="stat__key">Target repo</div>
                <a
                  className="stat__val"
                  href={repoUrl}
                  target="_blank"
                  rel="noreferrer"
                  style={{ fontSize: 16 }}
                >
                  {owner}/{repo}
                </a>
                <div className="stat__sub">
                  {repoInfo ? `connected · ${repoInfo.full_name}` : "public repository"}
                </div>
              </div>

              <div className="stat">
                <div className="stat__key">Last publish</div>
                <div className="stat__val stat__val--dim" style={{ fontSize: 15 }}>
                  {activity[0]
                    ? new Date(activity[0].date).toLocaleString()
                    : session
                    ? "fetching…"
                    : "connect to read"}
                </div>
                <div className="stat__sub">
                  {activity[0] ? activity[0].message : "version.json"}
                </div>
              </div>
            </div>
          </section>

          {/* 01 CONNECT */}
          <section className="card" data-reveal style={{ "--d": "0.12s" }}>
            <div className="card__head">
              <div>
                <div className="card__step">01 // authenticate</div>
                <h2 className="card__title">Connect GitHub</h2>
              </div>
            </div>

            <div className="field">
              <label className="field__label">Personal access token</label>
              <div className="token-wrap">
                <input
                  className="field__input"
                  type={showToken ? "text" : "password"}
                  placeholder="ghp_••••••••••••••••••••••••••••"
                  value={token}
                  onChange={(e) => setToken(e.target.value)}
                  spellCheck={false}
                  autoComplete="off"
                />
                <button
                  type="button"
                  className="token-toggle"
                  onClick={() => setShowToken((v) => !v)}
                >
                  {showToken ? "HIDE" : "SHOW"}
                </button>
              </div>
            </div>

            <div className="field__row">
              <div className="field">
                <label className="field__label">Owner</label>
                <input
                  className="field__input"
                  value={owner}
                  onChange={(e) => setOwner(e.target.value)}
                  spellCheck={false}
                />
              </div>
              <div className="field">
                <label className="field__label">Repository</label>
                <input
                  className="field__input"
                  value={repo}
                  onChange={(e) => setRepo(e.target.value)}
                  spellCheck={false}
                />
              </div>
            </div>

            <label className="check-row">
              <input
                type="checkbox"
                checked={remember}
                onChange={(e) => setRemember(e.target.checked)}
              />
              Remember token in this browser
            </label>

            {session ? (
              <div className="session">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  className="session__avatar"
                  src={session.avatar_url}
                  alt=""
                  referrerPolicy="no-referrer"
                />
                <div className="session__info">
                  <div className="session__login">{session.login}</div>
                  <div className="session__repo">
                    {repoInfo ? repoInfo.full_name : `${owner}/${repo}`}
                  </div>
                </div>
                <button type="button" className="session__out" onClick={disconnect}>
                  Disconnect
                </button>
              </div>
            ) : (
              <button
                type="button"
                className="btn btn--ghost btn--full"
                onClick={connect}
                disabled={busy}
              >
                {busy ? <span className="btn__spinner" /> : null}
                {busy ? "Authenticating" : "Connect"}
              </button>
            )}
          </section>

          {/* 02 UPLOAD */}
          <section className="card" data-reveal style={{ "--d": "0.24s" }}>
            <div className="card__head">
              <div>
                <div className="card__step">02 // payload</div>
                <h2 className="card__title">Upload Client.dll</h2>
              </div>
              <span className="card__hint">max 100 MB</span>
            </div>

            <div
              className={`drop${dragOver ? " drop--over" : ""}`}
              onClick={() => fileInputRef.current?.click()}
              onDragOver={(e) => {
                e.preventDefault();
                setDragOver(true);
              }}
              onDragLeave={() => setDragOver(false)}
              onDrop={onDrop}
            >
              <UploadIcon />
              <div className="drop__title">
                {fileMeta ? "Replace payload" : "Drop your DLL here"}
              </div>
              <div className="drop__hint">
                {fileMeta
                  ? fileMeta.name
                  : "or click to browse · .dll only · hashed instantly"}
              </div>
              <input
                ref={fileInputRef}
                type="file"
                accept=".dll,application/octet-stream"
                onChange={(e) => handleFile(e.target.files?.[0])}
              />
            </div>

            {fileMeta && (
              <div className="filemeta">
                <div className="filemeta__row">
                  <span className="filemeta__key">File</span>
                  <span className="filemeta__val filemeta__name">
                    {fileMeta.name}
                  </span>
                </div>
                <div className="filemeta__row">
                  <span className="filemeta__key">Size</span>
                  <span className="filemeta__val">{gh.fmtSize(fileMeta.size)}</span>
                </div>
                <div className="filemeta__row">
                  <span className="filemeta__key">SHA-256</span>
                  <span className="filemeta__val filemeta__val--hash">
                    {fileMeta.hash}
                  </span>
                </div>
              </div>
            )}

            <div className="field" style={{ marginTop: 18, marginBottom: 0 }}>
              <label className="field__label">
                Release version (auto-bumps from live)
              </label>
              <input
                className="field__input"
                placeholder="1.0.2"
                value={version}
                onChange={(e) => setVersion(e.target.value)}
                spellCheck={false}
              />
            </div>
          </section>

          {/* OPTIONS */}
          <section className="card card--wide" data-reveal style={{ "--d": "0.3s" }}>
            <div className="card__head">
              <div>
                <div className="card__step">// options</div>
                <h2 className="card__title">Deployment Configuration</h2>
              </div>
              <span className="card__hint">
                {session ? "applied on next push" : "connect to load branches"}
              </span>
            </div>

            <div className="field__row">
              <div className="field">
                <label className="field__label">Target branch</label>
                <div className="select-wrap">
                  <select
                    value={branch}
                    onChange={(e) => setBranch(e.target.value)}
                    disabled={!branches.length}
                  >
                    {branchOptions.map((b) => (
                      <option key={b} value={b}>
                        {b}
                      </option>
                    ))}
                  </select>
                </div>
              </div>
              <div className="field">
                <label className="field__label">
                  Commit message · {"{version}"} is replaced
                </label>
                <input
                  className="field__input"
                  value={commitMsg}
                  onChange={(e) => setCommitMsg(e.target.value)}
                  spellCheck={false}
                />
              </div>
            </div>

            <div className="field">
              <label className="field__label">Release notes (optional)</label>
              <textarea
                className="field__input"
                placeholder="What changed in this build? Appended to the commit message…"
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
              />
            </div>

            <div className="toggles">
              <label className="toggle">
                <input
                  type="checkbox"
                  checked={makeTag}
                  onChange={(e) => setMakeTag(e.target.checked)}
                />
                <span className="toggle__txt">
                  <span className="toggle__t">Create git tag</span>
                  <span className="toggle__d">
                    Tags the release commit as v&#123;version&#125; so you can
                    trace every published build.
                  </span>
                </span>
              </label>

              <label className="toggle">
                <input
                  type="checkbox"
                  checked={verifyAfter}
                  onChange={(e) => setVerifyAfter(e.target.checked)}
                />
                <span className="toggle__txt">
                  <span className="toggle__t">Deep verify after push</span>
                  <span className="toggle__d">
                    Re-downloads the published DLL and confirms its hash matches
                    what you just pushed.
                  </span>
                </span>
              </label>
            </div>
          </section>

          {/* DEPLOY */}
          <section
            className="card card--wide card--deploy"
            data-reveal
            style={{ "--d": "0.4s" }}
          >
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img className="wm" src="/toji.png" alt="" aria-hidden="true" />

            <div className="card__head">
              <div>
                <div className="card__step">03 // deploy</div>
                <h2 className="card__title">Push to GitHub</h2>
              </div>
              <span className="card__hint">{statusText}</span>
            </div>

            <div className="deploy-meta">
              <span>
                {phase === "done"
                  ? "payload delivered"
                  : phase === "error"
                  ? "deployment halted — check the log"
                  : phase === "working"
                  ? "channel open…"
                  : busy
                  ? "working…"
                  : "awaiting payload"}
              </span>
              <span className="deploy-meta__pct">{progress}%</span>
            </div>

            <div className="progress">
              <div className="progress__fill" style={{ width: `${progress}%` }} />
            </div>

            <div className="deploy-actions">
              <button
                type="button"
                className="btn btn--ghost"
                onClick={validate}
                disabled={busy || !fileMeta}
              >
                {busy ? <span className="btn__spinner" /> : null}
                Validate only
              </button>
              <button
                type="button"
                className="btn btn--primary btn--big"
                onClick={push}
                disabled={busy || phase === "working"}
              >
                {busy ? <span className="btn__spinner" /> : null}
                {busy
                  ? "Deploying"
                  : phase === "done"
                  ? "Push again"
                  : "Push to GitHub"}
              </button>
              {fileMeta && !busy && (
                <button type="button" className="btn btn--ghost" onClick={reset}>
                  Clear payload
                </button>
              )}
            </div>

            <div className="links">
              <a className="link-chip" href={rawDll} target="_blank" rel="noreferrer">
                <ExtIcon /> Raw Client.dll
              </a>
              <a
                className="link-chip"
                href={rawManifest}
                target="_blank"
                rel="noreferrer"
              >
                <ExtIcon /> Raw version.json
              </a>
              <a
                className="link-chip"
                href={`${repoUrl}/commits/${branch}`}
                target="_blank"
                rel="noreferrer"
              >
                <ExtIcon /> Commit history
              </a>
              <a className="link-chip" href={repoUrl} target="_blank" rel="noreferrer">
                <ExtIcon /> Repository
              </a>
            </div>

            {phase === "done" && (
              <div className="success">
                <CheckIcon />
                <div className="success__body">
                  <div className="success__title">Deployment sealed</div>
                  <div className="success__text">
                    Client.dll + version.json are committed
                    {makeTag ? ` and tagged v${version}` : ""}. The loader will
                    pull this build on its next update check — GitHub&apos;s raw
                    CDN refreshes within about five minutes.
                  </div>
                  <div className="success__links">
                    <a href={repoUrl} target="_blank" rel="noreferrer">
                      view repository ↗
                    </a>
                    <a href={rawManifest} target="_blank" rel="noreferrer">
                      view version.json ↗
                    </a>
                  </div>
                </div>
              </div>
            )}
          </section>

          {/* ACTIVITY */}
          <section className="card card--wide" data-reveal style={{ "--d": "0.5s" }}>
            <div className="card__head">
              <div>
                <div className="card__step">// history</div>
                <h2 className="card__title">Recent Publishes</h2>
              </div>
              <span className="card__hint">version.json commits</span>
            </div>

            {activity.length === 0 ? (
              <div className="empty-note">
                {session
                  ? "no history found for this branch"
                  : "connect your token to load the publish history"}
              </div>
            ) : (
              <div className="activity">
                {activity.map((c, i) => (
                  <div className="act" key={c.url + i}>
                    <span className="act__date">
                      {c.date ? new Date(c.date).toLocaleDateString() : "—"}
                    </span>
                    <span className="act__msg">{c.message || "(no message)"}</span>
                    <span className="act__who">
                      {c.author} ·{" "}
                      <a href={c.url} target="_blank" rel="noreferrer">
                        view ↗
                      </a>
                    </span>
                  </div>
                ))}
              </div>
            )}
          </section>

          {/* TERMINAL */}
          <section
            className="card card--wide terminal-wrap"
            data-reveal
            style={{ "--d": "0.6s" }}
          >
            <div className="card__head">
              <div>
                <div className="card__step">// output</div>
                <h2 className="card__title">Deployment Log</h2>
              </div>
            </div>
            <LogTerminal lines={logs} />
          </section>
        </main>

        {/* ---------- footer ---------- */}
        <footer className="footer">
          <span className="footer__brand">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src="/magxdxtr-logo.png" alt="" />
            <span>
              <b>MAGXDXTR</b> ADMIN PORTAL — cursed energy build pipeline
            </span>
          </span>
          <span>
            loader source ·{" "}
            <a href={repoUrl} target="_blank" rel="noreferrer">
              {owner}/{repo}
            </a>
          </span>
          <span>v1.0.0 · toji unit</span>
        </footer>
      </div>
    </>
  );
}