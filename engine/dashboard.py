"""Minimal static dashboard (one self-contained HTML file): projects, status, stages, costs, QC, outputs, jobs."""
from __future__ import annotations

import html
import json
import time
from pathlib import Path

from .state import State
from .util import REPO_DIR


def collect() -> dict:
    rows = []
    for pj in sorted((REPO_DIR / "productions").glob("*/project.json")):
        d = pj.parent
        info = {"id": d.name, "title": json.loads(pj.read_text()).get("title", ""), "status": "DRAFT", "stages": [], "qc": None,
                "paid_eur": 0.0, "failures": 0, "delivery": (d / "delivery" / "final_video.mp4").exists(), "render_s": 0}
        st_path = d / "work" / "state.sqlite"
        if st_path.exists():
            st = State(st_path)
            info.update(status=st.status, stages=[(s["name"], s["status"]) for s in st.stages()], paid_eur=st.paid_total(),
                        failures=len(st.failures()), render_s=round(sum(st.get("render_seconds", {}).values())))
            st.close()
        q = d / "work" / "qc" / "qc_report.json"
        if q.exists():
            qq = json.loads(q.read_text()); info["qc"] = (sum(c["pass"] for c in qq["checks"]), len(qq["checks"]))
        rows.append(info)
    jobs = []
    try:
        from .queue import jobs as list_jobs
        jobs = list_jobs()
    except Exception:  # noqa: BLE001 - dashboard must render even without a queue DB
        pass
    return {"projects": rows, "jobs": jobs}


def write_dashboard(out: Path) -> Path:
    data = collect()
    e = html.escape
    def badge(s: str) -> str:
        col = {"DELIVERY_READY": "#2f7d4f", "DELIVERED": "#2f7d4f", "QC_PASSED": "#2f6f7d", "FAILED": "#9c3b2e"}.get(s, "#6b6255")
        return f'<span class="b" style="background:{col}">{e(s)}</span>'
    prow = "".join(
        f"<tr><td><b>{e(p['id'])}</b><br><small>{e(p['title'])}</small></td><td>{badge(p['status'])}</td>"
        f"<td>{' '.join(f'<span class=st title={e(n)}>{e(n[:4])}:{e(s)}</span>' for n, s in p['stages'])}</td>"
        f"<td>{'%d/%d' % p['qc'] if p['qc'] else '—'}</td><td>{p['render_s']} s</td><td>€{p['paid_eur']:.2f}</td>"
        f"<td>{p['failures']}</td><td>{'yes' if p['delivery'] else '—'}</td></tr>" for p in data["projects"])
    jrow = "".join(f"<tr><td>{j['id']}</td><td>{e(Path(j['project']).name)}</td><td>{badge(j['status'].upper())}</td><td>{j['attempts']}/{j['max_attempts']}</td><td>{e((j['error'] or '')[:90])}</td></tr>" for j in data["jobs"]) or "<tr><td colspan=5>no jobs</td></tr>"
    doc = f"""<!doctype html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>ODDLIGHT Production</title><style>
:root{{--bg:#05141a;--fg:#ede6d6;--mut:#9aa6a6;--acc:#ff8a1f;--line:#173039}}
body{{margin:0;background:var(--bg);color:var(--fg);font:15px/1.5 system-ui,sans-serif;padding:24px 16px}}
h1{{font-weight:500;letter-spacing:.02em}} h1 i{{color:var(--acc);font-style:normal}} h2{{color:var(--mut);font-weight:500;margin-top:32px}}
.wrap{{overflow-x:auto}} table{{border-collapse:collapse;width:100%;min-width:720px}} td,th{{border-bottom:1px solid var(--line);padding:8px;text-align:left;vertical-align:top}}
th{{color:var(--mut);font-weight:500}} small{{color:var(--mut)}} .b{{padding:2px 8px;border-radius:10px;font-size:12px;color:#fff}}
.st{{display:inline-block;font-size:11px;color:var(--mut);margin:0 6px 2px 0}}</style></head><body>
<h1>odd<i>l</i>ight · production</h1><small>generated {time.strftime('%Y-%m-%d %H:%M')} · local only · publishing disabled</small>
<h2>Projects</h2><div class=wrap><table><tr><th>Project</th><th>Status</th><th>Stages</th><th>QC</th><th>Render</th><th>Paid</th><th>Failures</th><th>Delivery</th></tr>{prow}</table></div>
<h2>Jobs</h2><div class=wrap><table><tr><th>#</th><th>Project</th><th>Status</th><th>Attempts</th><th>Last error</th></tr>{jrow}</table></div>
</body></html>"""
    out.parent.mkdir(parents=True, exist_ok=True)
    out.write_text(doc, encoding="utf-8")
    return out
