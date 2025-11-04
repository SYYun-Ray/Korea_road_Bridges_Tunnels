#!/usr/bin/env python3
import os, json, sys
from typing import Any, Dict, List
from datetime import datetime

try:
    import pandas as pd
    import yaml
except Exception:
    print("This script needs: pip install pandas pyyaml")
    raise

ROOT = os.path.dirname(os.path.dirname(__file__))
RAW_DIR = os.path.join(ROOT, "data", "raw")
OUT_DIR = os.path.join(ROOT, "docs", "data")
TOOLS_DIR = os.path.join(ROOT, "tools")

CONFIGS = [
    ("schema_v2.bridges.yaml", "Bridges.csv"),
    ("schema_v2.tunnels.yaml", "Tunnels.csv"),
    ("schema_v2.underpasses.yaml", "Underpasses.csv"),
]

def try_read_csv(path: str):
    encodings = ["utf-8-sig", "cp949", "euc-kr", "utf-8"]
    last_err = None
    for enc in encodings:
        try:
            return pd.read_csv(path, dtype=str, encoding=enc)
        except Exception as e:
            last_err = e
    raise last_err

def ensure_unique_id(seen, prefix, idx):
    while True:
        cand = f"{prefix}-{idx:06d}"
        if cand not in seen:
            seen.add(cand)
            return cand, idx+1
        idx += 1

def process_one(schema_name, csv_name):
    schema_path = os.path.join(TOOLS_DIR, schema_name)
    with open(schema_path, "r", encoding="utf-8") as f:
        cfg = yaml.safe_load(f)
    if cfg.get("version") != 2:
        print(f"[WARN] {schema_name}: unsupported schema version")
        return

    out_base = cfg["output_basename"]
    prefix = cfg["id_prefix"]
    cols = cfg["columns"]  # list of {source, as}

    csv_path = os.path.join(RAW_DIR, csv_name)
    if not os.path.exists(csv_path):
        print(f"[WARN] missing CSV: {csv_path}")
        return

    df = try_read_csv(csv_path)

    # Validate that all 'source' columns exist
    missing = [c["source"] for c in cols if c["source"] not in df.columns]
    if missing:
        print(f"[WARN] {csv_name}: columns not found in CSV and will be skipped: {missing}")

    out = []
    seen = set()
    idx = 1
    for _, row in df.iterrows():
        rec = {}
        # ID generation
        rec["id"], idx = ensure_unique_id(seen, prefix, idx)
        # Map columns 1:1
        for c in cols:
            s = c["source"]
            t = c["as"]
            if s in row:
                val = row[s]
                if pd.isna(val):
                    val = None
                else:
                    val = str(val).strip()
                    if val == "":
                        val = None
                rec[t] = val
        out.append(rec)

    os.makedirs(OUT_DIR, exist_ok=True)
    out_path = os.path.join(OUT_DIR, f"{out_base}.min.json")
    with open(out_path, "w", encoding="utf-8") as f:
        json.dump(out, f, ensure_ascii=False, separators=(",", ":"))
    print(f"[OK] {out_path}  records={len(out)}  fields={len(cols)}(+id)")

def main():
    for schema, csvname in CONFIGS:
        process_one(schema, csvname)

if __name__ == "__main__":
    main()
