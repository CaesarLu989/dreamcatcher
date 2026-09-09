import json, sys
def parse(rows, n_tail=4):
    out=[]
    for r in rows:
        if not r.strip(): continue
        p=r.split("|"); lab=p[0]; sid=p[1]; tail=p[-n_tail:]; title="|".join(p[2:-n_tail]).strip()
        out.append((lab,sid,title,tail))
    return out
