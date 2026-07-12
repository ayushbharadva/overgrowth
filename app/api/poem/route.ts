// Gemini writes the tree's poem from the GitHub signals.
// Requires GEMINI_API_KEY; without it the client keeps its deterministic
// caption, so the static deploy never breaks.

import { NextRequest, NextResponse } from "next/server";

const MODEL = process.env.GEMINI_MODEL ?? "gemini-flash-latest";

export async function POST(req: NextRequest) {
  const key = process.env.GEMINI_API_KEY;
  if (!key) {
    return NextResponse.json({ error: "not configured" }, { status: 503 });
  }

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "bad request" }, { status: 400 });
  }
  const s = (body as { stats?: Record<string, unknown> })?.stats;
  if (!s || typeof s !== "object") {
    return NextResponse.json({ error: "bad request" }, { status: 400 });
  }

  // distill only the fields we trust, coerced
  const username = String(s.username ?? "").slice(0, 40);
  const years = Number(s.years) || 0;
  const repoCount = Math.min(Number(s.repoCount) || 0, 100000);
  const stars = Math.min(Number(s.stars) || 0, 10_000_000);
  const languages = Array.isArray(s.languages)
    ? s.languages.slice(0, 5).map((l) => String(l).slice(0, 30))
    : [];
  const nightOwl = Boolean(s.nightOwl);
  const dormant = Math.min(Number(s.dormantRepos) || 0, 100000);

  const prompt = `You are the voice of a tree that grew from a software developer's GitHub history. Write a poem of exactly 3 short lines (each under 60 characters) about the developer whose history fed you. Be tender and specific, never generic. No rhyming for its own sake, no emojis, no hashtags, no title, no quotation marks. Facts about them:
- ${years.toFixed(1)} years on GitHub, ${repoCount} public repos
- languages, most-loved first: ${languages.join(", ") || "unknown"}
- ${stars} stars earned (these are your blossoms)
- ${dormant} repos abandoned 18+ months (these are your bare branches — treat them kindly, as honest scars)
- ${nightOwl ? "they push code late at night; you grew crooked, leaning toward the dark" : "they build in daylight hours; you grew steady"}
Speak as the tree, to them (their username is ${username}). Return only the 3 lines.`;

  try {
    const r = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/${MODEL}:generateContent?key=${key}`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          contents: [{ parts: [{ text: prompt }] }],
          generationConfig: {
            temperature: 0.9,
            maxOutputTokens: 4000,
            // schema-enforced JSON + no thinking: keeps draft scratch-work
            // out of the poem
            responseMimeType: "application/json",
            responseSchema: {
              type: "OBJECT",
              properties: {
                lines: {
                  type: "ARRAY",
                  items: { type: "STRING" },
                  minItems: 3,
                  maxItems: 3,
                },
              },
              required: ["lines"],
            },
            thinkingConfig: { thinkingBudget: 0 },
          },
        }),
      }
    );
    if (!r.ok) {
      return NextResponse.json({ error: "upstream" }, { status: 502 });
    }
    const data = await r.json();
    const text: string = (data?.candidates?.[0]?.content?.parts ?? [])
      .filter((p: { thought?: boolean; text?: string }) => !p.thought && p.text)
      .map((p: { text: string }) => p.text)
      .join("");
    let lines: string[] = [];
    try {
      const parsed = JSON.parse(text);
      if (Array.isArray(parsed?.lines)) {
        lines = parsed.lines.map((l: unknown) => String(l).trim()).filter(Boolean).slice(0, 3);
      }
    } catch {
      // fall through to the length check
    }
    if (lines.length < 3) {
      return NextResponse.json({ error: "empty" }, { status: 502 });
    }
    return NextResponse.json(
      { lines },
      { headers: { "Cache-Control": "public, s-maxage=3600" } }
    );
  } catch {
    return NextResponse.json({ error: "upstream" }, { status: 502 });
  }
}
