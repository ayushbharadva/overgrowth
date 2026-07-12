"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { TreeRenderer, CANVAS_W, CANVAS_H } from "@/lib/render";
import { TreeParams, fakeParams } from "@/lib/params";
import { fetchTreeParams, GithubError } from "@/lib/github";
import { languageColor } from "@/lib/langColors";
import { treeReading } from "@/lib/reading";

type Phase = "idle" | "loading" | "growing" | "grown" | "error";

export default function Home() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const rendererRef = useRef<TreeRenderer | null>(null);
  const [input, setInput] = useState("");
  const [phase, setPhase] = useState<Phase>("idle");
  const [error, setError] = useState("");
  const [params, setParams] = useState<TreeParams | null>(null);
  const [demo, setDemo] = useState(false);
  const [poem, setPoem] = useState<string[] | null>(null);
  const [voiceState, setVoiceState] = useState<"off" | "ready" | "loading" | "playing">("off");
  const audioRef = useRef<HTMLAudioElement | null>(null);
  // replaying a poem shouldn't re-bill the TTS API
  const voiceCacheRef = useRef<Map<string, string>>(new Map());

  const growFromParams = useCallback((p: TreeParams) => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    rendererRef.current?.dispose();
    setParams(p);
    setPhase("growing");
    const renderer = new TreeRenderer(canvas, p, {
      onComplete: () => setPhase("grown"),
    });
    rendererRef.current = renderer;
    renderer.begin();
  }, []);

  const grow = useCallback(
    async (username: string) => {
      const u = username.trim().replace(/^@/, "");
      if (!u) return;
      setPhase("loading");
      setError("");
      setDemo(false);
      setPoem(null);
      setVoiceState("off");
      audioRef.current?.pause();
      try {
        const p = await fetchTreeParams(u);
        window.history.replaceState(null, "", `?u=${encodeURIComponent(u)}`);
        growFromParams(p);
        // the tree writes a poem while it grows (503/404 = feature not
        // deployed; the deterministic reading stays)
        fetch("/api/poem", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ stats: p.stats }),
        })
          .then((r) => (r.ok ? r.json() : null))
          .then((d) => {
            if (d?.lines?.length) {
              setPoem(d.lines);
              setVoiceState("ready");
            }
          })
          .catch(() => {});
      } catch (e) {
        setPhase("error");
        setError(
          e instanceof GithubError ? e.message : "Something went wrong. Try again."
        );
      }
    },
    [growFromParams]
  );

  // ?u=username links grow on load
  useEffect(() => {
    const u = new URLSearchParams(window.location.search).get("u");
    if (u) {
      setInput(u);
      grow(u);
    } else {
      // land on a living tree, not an empty canvas
      setDemo(true);
      growFromParams(fakeParams("overgrowth"));
    }
    return () => rendererRef.current?.dispose();
  }, [grow, growFromParams]);

  const savePNG = () => {
    const renderer = rendererRef.current;
    if (!renderer || !params) return;
    // the exported image carries its reading: the poem when we have one,
    // otherwise the deterministic caption split at its em-dashes
    const lines = demo
      ? undefined
      : poem ??
        treeReading(params.stats)
          .split(" — ")
          .map((s, i) => (i ? `— ${s}` : s));
    const a = document.createElement("a");
    a.href = renderer.toPNG(lines);
    a.download = `overgrowth-${params.stats.username}.png`;
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
    const url = `${window.location.origin}?u=${encodeURIComponent(
      params.stats.username
    )}`;
    await navigator.clipboard.writeText(url);
    setError("");
    setPhase("grown");
  };

  const stats = params?.stats;

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
        className="grow-form"
        onSubmit={(e) => {
          e.preventDefault();
          grow(input);
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
        <button type="submit" disabled={phase === "loading"}>
          {phase === "loading" ? "reading…" : "grow"}
        </button>
      </form>

      <div className={`status${phase === "error" ? " error" : ""}`}>
        {phase === "loading" && `reading @${input.trim().replace(/^@/, "")}'s history…`}
        {phase === "growing" && !demo && "growing…"}
        {(phase === "growing" || phase === "grown") && demo &&
          "a sample tree — type a username to grow a real one"}
        {phase === "error" && error}
        {phase === "grown" && !demo && stats && (
          <>
            grown from {stats.years} year{stats.years === 1 ? "" : "s"} of{" "}
            @{stats.username}&apos;s building
          </>
        )}
      </div>

      <div
        className="canvas-card"
        style={{ maxWidth: CANVAS_W, aspectRatio: `${CANVAS_W}/${CANVAS_H}` }}
      >
        <canvas ref={canvasRef} width={CANVAS_W} height={CANVAS_H} />
      </div>

      {stats && !demo && (phase === "grown" || phase === "growing") && (
        <>
          <div className="reading">
            {poem ? (
              <blockquote className="poem">
                {poem.map((line, i) => (
                  <span key={i}>{line}</span>
                ))}
                <cite>— your tree, via Gemini</cite>
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
              <button onClick={savePNG}>save as PNG</button>
              <button onClick={copyLink}>copy share link</button>
              <button onClick={() => params && growFromParams(params)}>
                regrow
              </button>
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
        No login, no tokens — reads only public GitHub data from your browser.
        <br />
        Built for the DEV Weekend Challenge: Passion Edition. Passion, rendered.
      </footer>
    </main>
  );
}
