"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { TreeRenderer, CANVAS_W, CANVAS_H } from "@/lib/render";
import { TreeParams, TreeStats, fakeParams } from "@/lib/params";
import { fetchTreeParams, GithubError } from "@/lib/github";
import { languageColor } from "@/lib/langColors";
import { treeReading } from "@/lib/reading";

type Phase = "idle" | "loading" | "growing" | "grown" | "error";

// GitHub usernames: alphanumeric + inner hyphens, max 39 chars
const USERNAME_RE = /^[a-zA-Z0-9](?:[a-zA-Z0-9]|-(?=[a-zA-Z0-9])){0,38}$/;

function cleanName(raw: string): string {
  return raw.trim().replace(/^@/, "");
}

export default function Home() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const canvasBRef = useRef<HTMLCanvasElement>(null);
  const rendererRef = useRef<TreeRenderer | null>(null);
  const rendererBRef = useRef<TreeRenderer | null>(null);
  const [input, setInput] = useState("");
  const [inputB, setInputB] = useState("");
  const [compareOn, setCompareOn] = useState(false); // second input visible
  const [comparing, setComparing] = useState(false); // two trees on screen
  const [phase, setPhase] = useState<Phase>("idle");
  const [error, setError] = useState("");
  const [params, setParams] = useState<TreeParams | null>(null);
  const [paramsB, setParamsB] = useState<TreeParams | null>(null);
  const [demo, setDemo] = useState(false);
  const [poem, setPoem] = useState<string[] | null>(null);
  const [voiceState, setVoiceState] = useState<"off" | "ready" | "loading" | "playing">("off");
  const [copied, setCopied] = useState(false);
  const audioRef = useRef<HTMLAudioElement | null>(null);
  // replaying a poem shouldn't re-bill the TTS API
  const voiceCacheRef = useRef<Map<string, string>>(new Map());
  // guards against a slow poem response attaching to a newer tree
  const growIdRef = useRef(0);

  const resetExtras = useCallback(() => {
    growIdRef.current++;
    setError("");
    setDemo(false);
    setPoem(null);
    setVoiceState("off");
    setCopied(false);
    audioRef.current?.pause();
  }, []);

  const growFromParams = useCallback((p: TreeParams) => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    rendererRef.current?.dispose();
    rendererBRef.current?.dispose();
    setComparing(false);
    setParams(p);
    setParamsB(null);
    setPhase("growing");
    const renderer = new TreeRenderer(canvas, p, {
      onComplete: () => setPhase("grown"),
    });
    rendererRef.current = renderer;
    renderer.begin();
    return renderer;
  }, []);

  const requestPoem = useCallback((stats: TreeStats) => {
    const id = ++growIdRef.current;
    // the tree writes a poem while it grows (503/404 = feature not
    // deployed; the deterministic reading stays)
    fetch("/api/poem", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ stats }),
    })
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => {
        if (id !== growIdRef.current) return; // a newer tree grew — stale
        if (d?.lines?.length) {
          setPoem(d.lines);
          setVoiceState("ready");
          // the wanderer walks in and delivers it
          rendererRef.current?.setSpeech(d.lines);
        }
      })
      .catch(() => {});
  }, []);

  const grow = useCallback(
    async (username: string) => {
      const u = cleanName(username);
      if (!u) return;
      resetExtras();
      if (!USERNAME_RE.test(u)) {
        setPhase("error");
        setError(`"${u}" isn't a valid GitHub username.`);
        return;
      }
      setPhase("loading");
      try {
        const p = await fetchTreeParams(u);
        window.history.replaceState(null, "", `?u=${encodeURIComponent(u)}`);
        growFromParams(p);
        requestPoem(p.stats);
      } catch (e) {
        setPhase("error");
        setError(
          e instanceof GithubError ? e.message : "Something went wrong. Try again."
        );
      }
    },
    [growFromParams, requestPoem, resetExtras]
  );

  const growCompare = useCallback(
    async (nameA: string, nameB: string) => {
      const a = cleanName(nameA);
      const b = cleanName(nameB);
      if (!a || !b) return;
      resetExtras();
      for (const u of [a, b]) {
        if (!USERNAME_RE.test(u)) {
          setPhase("error");
          setError(`"${u}" isn't a valid GitHub username.`);
          return;
        }
      }
      if (a.toLowerCase() === b.toLowerCase()) {
        setPhase("error");
        setError("Two different usernames — that's the point of a face-off.");
        return;
      }
      setPhase("loading");
      try {
        const tag = (u: string) => (e: unknown) => {
          if (e instanceof GithubError && e.kind === "notfound") {
            throw new GithubError("notfound", `@${u} doesn't exist on GitHub.`);
          }
          throw e;
        };
        const [pa, pb] = await Promise.all([
          fetchTreeParams(a).catch(tag(a)),
          fetchTreeParams(b).catch(tag(b)),
        ]);
        window.history.replaceState(
          null,
          "",
          `?u=${encodeURIComponent(a)}&vs=${encodeURIComponent(b)}`
        );
        const cA = canvasRef.current;
        const cB = canvasBRef.current;
        if (!cA || !cB) return;
        rendererRef.current?.dispose();
        rendererBRef.current?.dispose();
        setParams(pa);
        setParamsB(pb);
        setComparing(true);
        setPhase("growing");
        let done = 0;
        const onComplete = () => {
          if (++done === 2) setPhase("grown");
        };
        rendererRef.current = new TreeRenderer(cA, pa, { onComplete });
        rendererBRef.current = new TreeRenderer(cB, pb, { onComplete });
        rendererRef.current.begin();
        rendererBRef.current.begin();
      } catch (e) {
        setPhase("error");
        setError(
          e instanceof GithubError ? e.message : "Something went wrong. Try again."
        );
      }
    },
    [resetExtras]
  );

  // ?u=username (&vs=other) links grow on load
  useEffect(() => {
    const sp = new URLSearchParams(window.location.search);
    const u = sp.get("u");
    const vs = sp.get("vs");
    if (u && vs) {
      setInput(u);
      setInputB(vs);
      setCompareOn(true);
      growCompare(u, vs);
    } else if (u) {
      setInput(u);
      grow(u);
    } else {
      // land on a living tree, not an empty canvas
      setDemo(true);
      growFromParams(fakeParams("overgrowth"));
    }
    return () => {
      rendererRef.current?.dispose();
      rendererBRef.current?.dispose();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const readingLines = (stats: TreeStats) =>
    treeReading(stats)
      .split(" — ")
      .map((s, i) => (i ? `— ${s}` : s));

  const savePNG = (renderer: TreeRenderer | null, p: TreeParams | null, withPoem: boolean) => {
    if (!renderer || !p) return;
    // the exported image carries its reading: the poem when we have one,
    // otherwise the deterministic caption split at its em-dashes
    const lines = demo ? undefined : withPoem ? poem ?? readingLines(p.stats) : readingLines(p.stats);
    const a = document.createElement("a");
    a.href = renderer.toPNG(lines);
    a.download = `overgrowth-${p.stats.username}.png`;
    a.click();
  };

  const hearTree = async () => {
    if (!poem || voiceState === "loading") return;
    if (voiceState === "playing") {
      audioRef.current?.pause();
      setVoiceState("ready");
      return;
    }
    setVoiceState("loading");
    try {
      const text = poem.join("\n");
      let url = voiceCacheRef.current.get(text);
      if (!url) {
        const r = await fetch("/api/voice", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ text }),
        });
        if (!r.ok) throw new Error();
        url = URL.createObjectURL(await r.blob());
        voiceCacheRef.current.set(text, url);
      }
      const audio = new Audio(url);
      audioRef.current = audio;
      audio.onended = () => setVoiceState("ready");
      await audio.play();
      setVoiceState("playing");
    } catch {
      setVoiceState("ready");
    }
  };

  const copyLink = async () => {
    if (!params) return;
    const base = `${window.location.origin}?u=${encodeURIComponent(params.stats.username)}`;
    const url =
      comparing && paramsB
        ? `${base}&vs=${encodeURIComponent(paramsB.stats.username)}`
        : base;
    try {
      await navigator.clipboard.writeText(url);
      setCopied(true);
      setTimeout(() => setCopied(false), 1600);
    } catch {
      // clipboard blocked — nothing to do
    }
  };

  const regrow = () => {
    if (comparing && params && paramsB) {
      growCompare(params.stats.username, paramsB.stats.username);
    } else if (params) {
      const renderer = growFromParams(params);
      if (poem) renderer?.setSpeech(poem);
    }
  };

  const growSample = () => {
    resetExtras();
    setDemo(true);
    setInput("");
    setInputB("");
    window.history.replaceState(null, "", window.location.pathname);
    growFromParams(fakeParams("overgrowth"));
  };

  const stats = params?.stats;
  const statsB = paramsB?.stats;
  const canGrow =
    phase !== "loading" &&
    cleanName(input).length > 0 &&
    (!compareOn || cleanName(inputB).length > 0);

  const faceoffRows: {
    label: string;
    a: number;
    b: number;
    fmt: (v: number) => string;
    lowerWins?: boolean;
  }[] =
    stats && statsB
      ? [
          { label: "years", a: stats.years, b: statsB.years, fmt: (v: number) => `${v}` },
          { label: "repos", a: stats.repoCount, b: statsB.repoCount, fmt: (v: number) => `${v}` },
          { label: "stars ⭐", a: stats.stars, b: statsB.stars, fmt: (v: number) => v.toLocaleString() },
          { label: "languages", a: stats.languages.length, b: statsB.languages.length, fmt: (v: number) => `${v}` },
          { label: "followers", a: stats.followers, b: statsB.followers, fmt: (v: number) => v.toLocaleString() },
          { label: "dormant 🥀", a: stats.dormantRepos, b: statsB.dormantRepos, fmt: (v: number) => `${v}`, lowerWins: true },
        ]
      : [];

  return (
    <main>
      <div className="hero">
        <h1>Overgrowth</h1>
        <p>
          Every commit feeds it. Type a GitHub username and grow the tree that
          years of late nights, languages and abandoned side projects deserve.
        </p>
      </div>

      <form
        className={`grow-form${compareOn ? " compare" : ""}`}
        onSubmit={(e) => {
          e.preventDefault();
          if (compareOn) growCompare(input, inputB);
          else grow(input);
        }}
      >
        <input
          value={input}
          onChange={(e) => setInput(e.target.value)}
          placeholder="github username — try your own"
          spellCheck={false}
          autoCapitalize="none"
          autoCorrect="off"
        />
        <button
          type="button"
          className="vs-toggle"
          title={compareOn ? "back to a single tree" : "compare two trees"}
          onClick={() => setCompareOn((v) => !v)}
        >
          {compareOn ? "✕" : "⚔ vs"}
        </button>
        {compareOn && (
          <input
            value={inputB}
            onChange={(e) => setInputB(e.target.value)}
            placeholder="a friend's username"
            spellCheck={false}
            autoCapitalize="none"
            autoCorrect="off"
          />
        )}
        <button type="submit" disabled={!canGrow}>
          {phase === "loading" ? "reading…" : compareOn ? "grow both" : "grow"}
        </button>
      </form>

      <div className={`status${phase === "error" ? " error" : ""}`}>
        {phase === "loading" &&
          (compareOn
            ? `reading two histories…`
            : `reading @${cleanName(input)}'s history…`)}
        {phase === "growing" && !demo && "growing…"}
        {(phase === "growing" || phase === "grown") && demo &&
          "a sample tree — type a username to grow a real one"}
        {phase === "error" && (
          <>
            {error}{" "}
            <button className="sample-btn" onClick={growSample}>
              grow a sample tree instead
            </button>
          </>
        )}
        {phase === "grown" && !demo && stats && !comparing && (
          <>
            grown from {stats.years} year{stats.years === 1 ? "" : "s"} of{" "}
            @{stats.username}&apos;s building
          </>
        )}
        {phase === "grown" && comparing && stats && statsB && (
          <>
            @{stats.username} and @{statsB.username} — two trees, same forest
          </>
        )}
      </div>

      <div className={`canvas-row${comparing ? " compare" : ""}`}>
        <div
          className="canvas-card"
          style={{ maxWidth: CANVAS_W, aspectRatio: `${CANVAS_W}/${CANVAS_H}` }}
        >
          <canvas ref={canvasRef} width={CANVAS_W} height={CANVAS_H} />
        </div>
        <div
          className={`canvas-card${comparing ? "" : " hidden"}`}
          style={{ maxWidth: CANVAS_W, aspectRatio: `${CANVAS_W}/${CANVAS_H}` }}
        >
          <canvas ref={canvasBRef} width={CANVAS_W} height={CANVAS_H} />
        </div>
      </div>

      {comparing && stats && statsB && (phase === "grown" || phase === "growing") && (
        <>
          <div className="faceoff">
            <div className="faceoff-row head">
              <span className="a">@{stats.username}</span>
              <span className="label" />
              <span className="b">@{statsB.username}</span>
            </div>
            {faceoffRows.map((r) => {
              const aWins = r.lowerWins ? r.a < r.b : r.a > r.b;
              const bWins = r.lowerWins ? r.b < r.a : r.b > r.a;
              return (
                <div className="faceoff-row" key={r.label}>
                  <span className={`a${aWins ? " win" : ""}`}>{r.fmt(r.a)}</span>
                  <span className="label">{r.label}</span>
                  <span className={`b${bWins ? " win" : ""}`}>{r.fmt(r.b)}</span>
                </div>
              );
            })}
            <div className="faceoff-row">
              <span className="a">{stats.nightOwl ? "🌙 night owl" : "☀️ daylight"}</span>
              <span className="label">rhythm</span>
              <span className="b">{statsB.nightOwl ? "🌙 night owl" : "☀️ daylight"}</span>
            </div>
          </div>
          {phase === "grown" && (
            <div className="actions">
              <button onClick={() => savePNG(rendererRef.current, params, false)}>
                save @{stats.username}.png
              </button>
              <button onClick={() => savePNG(rendererBRef.current, paramsB, false)}>
                save @{statsB.username}.png
              </button>
              <button onClick={copyLink}>
                {copied ? "copied ✓" : "copy face-off link"}
              </button>
              <button onClick={regrow}>regrow</button>
            </div>
          )}
        </>
      )}

      {stats && !demo && !comparing && (phase === "grown" || phase === "growing") && (
        <>
          <div className="reading">
            {poem ? (
              <blockquote className="poem">
                {poem.map((line, i) => (
                  <span key={i}>{line}</span>
                ))}
                <cite>— your tree, via Gemini · voiced by ElevenLabs</cite>
              </blockquote>
            ) : (
              <p className="caption">{treeReading(stats)}</p>
            )}
            {voiceState !== "off" && (
              <button className="voice" onClick={hearTree}>
                {voiceState === "loading"
                  ? "the tree clears its throat…"
                  : voiceState === "playing"
                  ? "◼ hush"
                  : "🔊 hear your tree"}
              </button>
            )}
          </div>
          <div className="stats">
            {stats.languages.slice(0, 5).map((lang) => (
              <span className="chip" key={lang}>
                <span
                  className="dot"
                  style={{ background: languageColor(lang) }}
                />
                {lang}
              </span>
            ))}
            <span className="chip">
              ⭐ {stats.stars} <span className="muted">→ blossoms</span>
            </span>
            {stats.dormantRepos > 0 && (
              <span className="chip">
                🥀 {stats.dormantRepos} dormant{" "}
                <span className="muted">→ bare branches</span>
              </span>
            )}
            {stats.nightOwl && (
              <span className="chip">
                🌙 night owl <span className="muted">→ it leans</span>
              </span>
            )}
            <span className="chip">
              📦 {stats.repoCount} repos · {stats.years}y
            </span>
          </div>

          {phase === "grown" && (
            <div className="actions">
              <button onClick={() => savePNG(rendererRef.current, params, true)}>
                save as PNG
              </button>
              <button onClick={copyLink}>
                {copied ? "copied ✓" : "copy share link"}
              </button>
              <button onClick={regrow}>regrow</button>
            </div>
          )}
        </>
      )}

      <div className="legend">
        <h2>How to read a tree</h2>
        <ul>
          <li>
            <strong>Height &amp; depth</strong> — years on GitHub, repos built
          </li>
          <li>
            <strong>Trunk</strong> — how actively they push
          </li>
          <li>
            <strong>Branching &amp; colors</strong> — language diversity
          </li>
          <li>
            <strong>Glowing blossoms</strong> — stars earned
          </li>
          <li>
            <strong>Bare grey branches</strong> — abandoned repos, the honest scars
          </li>
          <li>
            <strong>The lean</strong> — late-night pushes bend it toward the dark
          </li>
          <li>
            <strong>Leaf color</strong> — green when fresh, brown when dormant
          </li>
          <li>
            <strong>Same name, same tree</strong> — it&apos;s deterministic; it&apos;s
            yours
          </li>
        </ul>
      </div>

      <footer>
        No login — the tree grows from public GitHub data, read right in your
        browser. Poem &amp; voice run behind two tiny serverless routes.
        <br />
        Built for the DEV Weekend Challenge: Passion Edition. Passion, rendered.
      </footer>
    </main>
  );
}
