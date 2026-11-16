"""Editorial stages: research, fact-check, script, storyboard.

The engine does not invent facts. With the default 'manual' LLM provider these stages validate and render the
human/agent-authored research in project.json (sources, claims, scene text); a configured local LLM could draft
missing text, but unreviewed claims are always reported as needing review and block commercial delivery."""
from __future__ import annotations

from ..pipeline import Context
from ..util import EngineError, atomic_write_json, atomic_write_text


def research(ctx: Context) -> dict:
    d = ctx.project.data
    if not d["sources"]:
        llm = ctx.provider("llm", "manual")
        llm.generate(f"Collect reliable sources about: {d['topic']}")  # manual provider raises a clear error
    out = ctx.work("editorial", "sources.json")
    atomic_write_json(out, [{**s, "used_by_claims": [c["id"] for c in d["claims"] if s["id"] in c.get("sources", [])]} for s in d["sources"]])
    return {"sources": out}


def factcheck(ctx: Context) -> dict:
    d = ctx.project.data
    claims = {c["id"]: c for c in d["claims"]}
    rows, problems = [], []
    for s in d["scenes"]:
        if not s["text"].strip():
            continue
        if not s.get("claims") and not s.get("non_factual"):
            problems.append(f"scene {s['id']} has narration but no claim references (mark 'non_factual': true if it states no facts)")
        for cid in s.get("claims", []):
            c = claims[cid]
            rows.append({"scene": s["id"], "claim": cid, "text": c["text"], "status": c.get("status", "needs_review"),
                         "sources": c.get("sources", []), "note": c.get("note", "")})
    if problems:
        raise EngineError("fact-check structure problems:\n  - " + "\n  - ".join(problems))
    unresolved = sorted({r["claim"] for r in rows if r["status"] != "verified"})
    rep = {"claims_checked": len({r['claim'] for r in rows}), "unresolved": unresolved, "rows": rows,
           "method": "Each narrated statement is linked to a claim; each claim cites sources listed in sources.json. "
                     "Status 'verified' means a reviewer confirmed the claim against the cited source. "
                     "This is an editorial record, not an automated proof of accuracy."}
    out = ctx.work("editorial", "factcheck.json")
    atomic_write_json(out, rep)
    if unresolved:
        ctx.log.warn("claims_unresolved", claims=",".join(unresolved))
    return {"factcheck": out}


def script(ctx: Context) -> dict:
    d = ctx.project.data
    if any(not s["text"].strip() and not s["module"].startswith("builtin:") for s in d["scenes"]):
        ctx.provider("llm", "manual").generate("Write narration for empty scenes")
    lines = [f"# {d['title']}", "", f"Topic: {d['topic']}  ", f"Audience: {d['target_audience']}  ",
             f"Voice: {d['narration']['provider']} / {d['narration']['voice']}", ""]
    for s in d["scenes"]:
        if s["text"].strip():
            refs = ", ".join(s.get("claims", [])) or ("non-factual" if s.get("non_factual") else "")
            lines.append(f"**{s['id'].upper()} · {s.get('beat', '')}** — {s['text']}" + (f"  _[{refs}]_" if refs else ""))
            lines.append("")
    lines += ["## Sources", ""] + [f"- [{x['id']}] {x['citation']} — {x.get('url') or 'doi:' + x.get('doi', '')}" for x in d["sources"]]
    out = ctx.work("editorial", "script.md")
    atomic_write_text(out, "\n".join(lines) + "\n")
    return {"script": out}


def storyboard(ctx: Context) -> dict:
    d = ctx.project.data
    lines = [f"# Storyboard — {d['title']}", "", f"Format: {d['format']['width']}x{d['format']['height']} @ {d['format']['fps']} fps · Style: {d['visual'].get('style', '')}", ""]
    for i, s in enumerate(d["scenes"], 1):
        tr = s.get("transition_out") or {}
        lines += [f"## {i}. {s['id']} — {s.get('beat', '')}", f"- Narration: {s['text'] or '(none)'}",
                  f"- Visual goal: {s.get('visual_goal', '')}", f"- Module: `{s['module']}`",
                  f"- Transition out: {tr.get('type', 'none')} {tr.get('d', '')}", ""]
    out = ctx.work("editorial", "storyboard.md")
    atomic_write_text(out, "\n".join(lines))
    return {"storyboard": out}
