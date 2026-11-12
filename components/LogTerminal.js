"use client";

import { useEffect, useRef } from "react";

function stamp(d) {
  const p = (n) => String(n).padStart(2, "0");
  return `${p(d.getHours())}:${p(d.getMinutes())}:${p(d.getSeconds())}`;
}

export default function LogTerminal({ lines }) {
  const bodyRef = useRef(null);

  useEffect(() => {
    const el = bodyRef.current;
    if (el) el.scrollTo({ top: el.scrollHeight, behavior: "smooth" });
  }, [lines]);

  return (
    <div className="terminal">
      <div className="terminal__bar">
        <span className="terminal__dots">
          <i />
          <i />
          <i />
        </span>
        magxdxtr://deploy-log
      </div>
      <div className="terminal__body" ref={bodyRef}>
        {lines.length === 0 ? (
          <div
            className="log-line log-line--info"
            style={{ "--ld": "0.4s" }}
          >
            <span className="log-t" suppressHydrationWarning>
              {stamp(new Date())}
            </span>
            <span className="log-msg">
              system idle — connect a token, drop a Client.dll, push.
            </span>
          </div>
        ) : (
          lines.map((l, i) => (
            <div
              key={i}
              className={`log-line log-line--${l.level}`}
              style={{ "--ld": `${Math.min(i, 6) * 0.07}s` }}
            >
              <span className="log-t" suppressHydrationWarning>
                {stamp(l.t)}
              </span>
              <span className="log-msg">{l.text}</span>
            </div>
          ))
        )}
      </div>
    </div>
  );
}