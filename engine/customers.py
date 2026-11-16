"""Customers (or internal brands) and their isolation rules.

customers/<id>/customer.json  - name, contact, brand settings, preferences, delivery preferences
customers/<id>/assets/        - logos, fonts, brand assets (only usable by that customer's projects)

Credentials are never stored in customer.json or project.json; validate() refuses anything that looks like one."""
from __future__ import annotations

import json
import re
from pathlib import Path

from .util import EngineError, REPO_DIR

CUSTOMERS_DIR = REPO_DIR / "customers"
SECRET_KEY_RE = re.compile(r"(api[_-]?key|secret|password|passwd|token|bearer|private[_-]?key)", re.I)
SECRET_VAL_RE = re.compile(r"(sk-[A-Za-z0-9]{16,}|ghp_[A-Za-z0-9]{20,}|AKIA[0-9A-Z]{16}|-----BEGIN [A-Z ]*PRIVATE KEY-----)")


def find_secrets(obj, path: str = "") -> list[str]:
    hits = []
    if isinstance(obj, dict):
        for k, v in obj.items():
            if SECRET_KEY_RE.search(str(k)) and v not in (None, "", False):
                hits.append(f"{path}.{k}")
            hits += find_secrets(v, f"{path}.{k}")
    elif isinstance(obj, list):
        for i, v in enumerate(obj):
            hits += find_secrets(v, f"{path}[{i}]")
    elif isinstance(obj, str) and SECRET_VAL_RE.search(obj):
        hits.append(path)
    return hits


def customer_dir(cid: str) -> Path:
    if not re.match(r"^[a-z0-9][a-z0-9_-]{1,63}$", cid or ""):
        raise EngineError(f"invalid customer id '{cid}'")
    return CUSTOMERS_DIR / cid


def load(cid: str) -> dict:
    f = customer_dir(cid) / "customer.json"
    if not f.is_file():
        raise EngineError(f"unknown customer '{cid}' (expected {f})")
    data = json.loads(f.read_text(encoding="utf-8"))
    problems = []
    for k in ("id", "name", "brand"):
        if k not in data:
            problems.append(f"missing '{k}'")
    if data.get("id") != cid:
        problems.append(f"id '{data.get('id')}' does not match folder '{cid}'")
    secrets = find_secrets(data)
    if secrets:
        problems.append("credential-like fields must not be stored here: " + ", ".join(secrets))
    if problems:
        raise EngineError(f"customers/{cid}/customer.json: " + "; ".join(problems))
    return data


def list_customers() -> list[dict]:
    out = []
    for d in sorted(CUSTOMERS_DIR.glob("*/customer.json")):
        try:
            out.append(load(d.parent.name))
        except EngineError as e:
            out.append({"id": d.parent.name, "error": str(e)})
    return out


def effective_brand(project_data: dict) -> dict:
    """Customer brand, overridden key-by-key by the project's own 'brand' block."""
    cust = load(project_data["customer_id"])
    brand = dict(cust.get("brand", {}))
    for k, v in (project_data.get("brand") or {}).items():
        brand[k] = {**brand.get(k, {}), **v} if isinstance(v, dict) and isinstance(brand.get(k), dict) else v
    brand["customer_id"] = cust["id"]
    return brand
