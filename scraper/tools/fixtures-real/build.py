#!/usr/bin/env python3
"""Turn compact pipe rows captured from the live sites into fixture JSON (raw posting objects)."""
import json, sys, pathlib, importlib
here = pathlib.Path(__file__).parent
sys.path.insert(0, str(here.parent.parent))  # for nothing yet

def rows(name):
    p = here / f"{name}_rows.txt"
    return [r for r in p.read_text(encoding="utf-8").split("\n") if r.strip()] if p.exists() else []

def split_tail(r, n_tail):
    p = r.split("|"); return p[0], p[1], "|".join(p[2:-n_tail]).strip(), p[-n_tail:]

out = {}

# Goldman: lab|id|title|locs|posted|level|division
gs = []
for r in rows("gs"):
    lab, sid, title, (locs, posted, level, div) = split_tail(r, 4)
    gs.append({"companyKey": "goldman", "company": "Goldman Sachs", "id": sid, "title": title, "url": f"https://higher.gs.com/roles/{sid}",
               "locations": locs.split("/"), "postedAt": posted or None, "snippet": f"{div} · {level}", "level": level, "division": div, "hint": "campus" if lab == "C" else ""})
out["goldman"] = gs

# JPM: id|title|locs|posted|closes|family
jpm = []
for r in rows("jpm"):
    _, sid, title, (locs, posted, closes, fam) = split_tail(r, 4)
    jpm.append({"companyKey": "jpmorgan", "company": "J.P. Morgan", "id": sid, "title": title, "url": f"https://jpmc.fa.oraclecloud.com/hcmUI/CandidateExperience/en/sites/CX_1001/job/{sid}",
                "locations": locs.split("/"), "postedAt": posted or None, "closesAt": closes or None, "snippet": "", "level": fam, "division": None})
out["jpmorgan"] = jpm

# MS eightfold: id|title|locs|posted|dept
ms = []
for r in rows("ms"):
    _, sid, title, (locs, posted, dept) = split_tail(r, 3)
    ms.append({"companyKey": "morganstanley", "company": "Morgan Stanley", "id": sid, "title": title, "url": f"https://morganstanley.eightfold.ai/careers/job/{sid}",
               "locations": locs.split("/"), "postedAt": posted or None, "snippet": dept, "division": dept or None})
out["morganstanley"] = ms

# McKinsey: id|title|cities|posted|level|friendly
mck = []
for r in rows("mck"):
    _, sid, title, (cities, posted, level, friendly) = split_tail(r, 4)
    mck.append({"companyKey": "mckinsey", "company": "McKinsey & Company", "id": sid, "title": title, "url": f"https://www.mckinsey.com/careers/search-jobs/jobs/{friendly}",
                "locations": cities.split("/"), "postedAt": posted or None, "snippet": "", "level": level or None, "division": None})
out["mckinsey"] = mck

# Barclays: id|title|loc|posted|href
bar = []
for r in rows("bar"):
    _, sid, title, (loc, posted, href) = split_tail(r, 3)
    bar.append({"companyKey": "barclays", "company": "Barclays", "id": sid, "title": title, "url": "https://search.jobs.barclays" + href, "locations": [loc], "postedAt": posted or None, "snippet": ""})
out["barclays"] = bar

# BNP: slug|title|loc|type|entity
bnp = []
for r in rows("bnp"):
    _, slug, title, (loc, typ, entity) = split_tail(r, 3)
    bnp.append({"companyKey": "bnp", "company": "BNP Paribas", "id": slug, "title": title, "url": f"https://group.bnpparibas/en/careers/job-offer/{slug}", "locations": [loc], "snippet": f"{typ} · {entity}", "division": entity, "contract": typ, "_type": "graduate" if "Graduate" in typ else None})
out["bnp"] = bnp

# Beisen tenants: key|id|title|locs|posted|closes|org
for key, name, tenant in [("guosen", "国信证券 Guosen Securities", "guosen"), ("csc108", "中信建投 CSC Financial", "csc108"), ("cicc", "中金公司 CICC", "cicc"), ("iflytek", "科大讯飞 iFlytek", "iflytek")]:
    lst = []
    for r in rows(key):
        _, sid, title, (locs, posted, closes, org) = split_tail(r, 4)
        lst.append({"companyKey": key, "company": name, "id": sid, "title": title, "url": f"https://{tenant}.zhiye.com/campus/detail?jobAdId={sid}",
                    "locations": [l.split("·")[-1] for l in locs.split("/")], "postedAt": posted or None, "closesAt": closes or None, "snippet": f"{org} · 校园招聘", "division": org, "hint": "校招"})
    out[key] = lst

# NVIDIA: id|title|loc|posted|path
nv = []
for r in rows("nvidia"):
    _, sid, title, (loc, posted, path) = split_tail(r, 3)
    nv.append({"companyKey": "nvidia", "company": "NVIDIA", "id": sid, "title": title, "url": "https://nvidia.wd5.myworkdayjobs.com/en-US/NVIDIAExternalCareerSite" + path, "locations": [loc], "postedAt": posted or None, "snippet": sid})
out["nvidia"] = nv

for k, v in out.items():
    (here / f"{k}.json").write_text(json.dumps(v, ensure_ascii=False, indent=1), encoding="utf-8")
    print(k, len(v))
