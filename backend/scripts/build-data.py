#!/usr/bin/env python3
"""Build SPIKE's CSVs from the raw sources in backend/data/sources and backend/data/research.

Real (copied from goheels.com): players, player_stats, team, team_matches.
Real (published study, CC BY 4.0): research_studies, research_matches.
Derived from the real stats with the formulas below: skill_ratings, coach_feedback.
Sample only (no public source exists): training_progress.

rotations.csv and live_rotation.csv come from the lineup optimizer: run
`npm run data:rotations` after this script.

Usage: python3 backend/scripts/build-data.py
"""
import csv
import json
import re
from datetime import datetime
from pathlib import Path

DATA = Path(__file__).resolve().parent.parent / "data"
UNC = DATA / "unc_chapel_hill"
TEAM_ID = "unc-chapel-hill-wvb"

POSITIONS = {"MB": ("MB", ["MB"]), "S": ("S", ["S"]), "OH": ("OH", ["OH"]), "OH/OPP": ("OH", ["OH", "OPP"]), "RS": ("OPP", ["OPP"])}
CLASS_YEARS = {"Fr.": "Freshman", "So.": "Sophomore", "Jr.": "Junior", "Sr.": "Senior", "Gr.": "Graduate"}
# Must match weakestSkills() in lib/volleyball.ts.
IGNORED = {
    "OH": {"setting"}, "OPP": {"setting"}, "MB": {"setting", "passing", "defense"},
    "S": {"hitting"}, "L": {"setting", "hitting", "blocking"}, "DS": {"setting", "hitting", "blocking"},
}
SKILLS = ["serving", "passing", "setting", "hitting", "blocking", "defense"]
DRILLS_BY_SKILL = {
    "passing": ["ex-001", "ex-002", "ex-003"], "serving": ["ex-006", "ex-005", "ex-004"],
    "setting": ["ex-008", "ex-007", "ex-009"], "hitting": ["ex-012", "ex-010", "ex-011"],
    "blocking": ["ex-015", "ex-013", "ex-014"], "defense": ["ex-018", "ex-016", "ex-017"],
}


def write(path, rows):
    path.parent.mkdir(parents=True, exist_ok=True)
    with path.open("w", newline="") as f:
        writer = csv.DictWriter(f, fieldnames=list(rows[0].keys()))
        writer.writeheader()
        writer.writerows(rows)
    print(f"{path.relative_to(DATA.parent.parent)}: {len(rows)} rows")


def num(value):
    if value in (None, "", "-"):
        return 0
    return float(value) if "." in str(value) else int(value)


def slug(name):
    return re.sub(r"[^a-z0-9]+", "-", name.lower()).strip("-")


def cm(height):
    feet, inches = re.findall(r"\d+", height)
    return round((int(feet) * 12 + int(inches)) * 2.54)


def scale(value, low, high, low_rating, high_rating):
    """Linear map from [low, high] to [low_rating, high_rating], clamped to 1-10."""
    rating = low_rating + (value - low) / (high - low) * (high_rating - low_rating)
    return max(1, min(10, round(rating)))


def shrink(rate, n, prior, prior_n):
    """Pull small samples toward a prior so 3-for-3 doesn't outrank 300 attempts."""
    return (rate * n + prior * prior_n) / (n + prior_n)


roster = json.loads((DATA / "sources/goheels_roster_2026.json").read_text())["players"]
stats_src = json.loads((DATA / "sources/goheels_stats_2026.json").read_text())
by_name = {" ".join(reversed([p.strip() for p in k.split(",")])): v for k, v in stats_src["players"].items() if "," in k}
total = stats_src["total"]

# Of the two L/DS players, the one who took more serve receive is the libero.
dual = [p for p in roster if p["position"] == "L/DS"]
libero = max(dual, key=lambda p: num(by_name[p["name"]]["defenseStatsTotalReceptionAttempts"]))["name"]

players, player_stats = [], []
for p in sorted(roster, key=lambda p: int(p["jersey"])):
    if p["position"] == "L/DS":
        position, eligible = ("L", ["L", "DS"]) if p["name"] == libero else ("DS", ["DS", "L"])
    else:
        position, eligible = POSITIONS[p["position"]]
    pid = f"unc-{slug(p['name'])}"
    s = by_name[p["name"]]
    players.append({
        "player_id": pid, "team_id": TEAM_ID, "name": p["name"], "jersey_number": p["jersey"],
        "position": position, "eligible_positions": "|".join(eligible), "height_cm": cm(p["height"]),
        "class_year": CLASS_YEARS[p["class"]], "is_setter": str(position == "S").lower(),
        "hometown": p["hometown"], "previous_school": p["previous_school"],
    })
    player_stats.append({
        "player_id": pid,
        "matches_played": num(s["gamesPlayed"]), "matches_started": num(s["gamesStarted"]), "sets_played": num(s["setsPlayed"]),
        "kills": num(s["attackStatsKills"]), "attack_errors": num(s["attackStatsErrors"]), "attack_attempts": num(s["attackStatsTotalAttempts"]),
        "assists": num(s["setStatsAssists"]), "set_errors": num(s["setStatsSetErrors"]),
        "service_aces": num(s["serveStatsServiceAces"]), "service_errors": num(s["serveStatsServiceErrors"]),
        "serve_attempts": num(s["serveStatsTotalServeAttempts"]),
        "digs": num(s["defenseStatsDigs"]), "reception_errors": num(s["defenseStatsReceptionErrors"]),
        "reception_attempts": num(s["defenseStatsTotalReceptionAttempts"]),
        "block_solos": num(s["blockStatsSolos"]), "block_assists": num(s["blockStatsAssists"]), "block_errors": num(s["blockStatsErrors"]),
        "ball_handling_errors": num(s["miscStatsBallHandlingErrors"]), "points": num(s["miscStatsPoints"]),
    })

for key, col in [("kills", "attackStatsKills"), ("assists", "setStatsAssists"), ("digs", "defenseStatsDigs"), ("service_errors", "serveStatsServiceErrors")]:
    assert sum(r[key] for r in player_stats) == num(total[col]), f"{key} does not add up to the team total"

team_serve_net = (num(total["serveStatsServiceAces"]) - num(total["serveStatsServiceErrors"])) / num(total["serveStatsTotalServeAttempts"])
team_reception = 1 - num(total["defenseStatsReceptionErrors"]) / num(total["defenseStatsTotalReceptionAttempts"])


# Per-set rate that earns a 10, by role: a middle and an outside hitter aren't held to the same blocking bar.
BLOCKS_FOR_TEN = {"MB": 1.2, "OH": 0.7, "OPP": 0.7, "S": 0.5, "L": 0.5, "DS": 0.5}
DIGS_FOR_TEN = {"L": 3.5, "DS": 3.5, "S": 3.0, "OH": 2.5, "OPP": 2.5, "MB": 1.5}


def ratings_for(s, position):
    sets = s["sets_played"]
    per_set = lambda v: v / sets if sets else 0
    r = {}
    if s["attack_attempts"] >= 30:
        pct = (s["kills"] - s["attack_errors"]) / s["attack_attempts"]
        r["hitting"] = scale(shrink(pct, s["attack_attempts"], 0.200, 40), 0.100, 0.350, 3, 10)
    if s["serve_attempts"] >= 30:
        net = (s["service_aces"] - s["service_errors"]) / s["serve_attempts"]
        r["serving"] = scale(shrink(net, s["serve_attempts"], team_serve_net, 40), -0.15, 0.05, 2, 10)
    if s["reception_attempts"] >= 30:
        eff = 1 - s["reception_errors"] / s["reception_attempts"]
        r["passing"] = scale(shrink(eff, s["reception_attempts"], team_reception, 40), 0.85, 0.98, 2, 10)
    if sets >= 10:
        r["setting"] = scale(per_set(s["assists"]), 0, 6.0, 1, 9)
        r["blocking"] = scale(per_set(s["block_solos"] + 0.5 * s["block_assists"]), 0, BLOCKS_FOR_TEN[position], 1, 10)
        r["defense"] = scale(per_set(s["digs"]), 0, DIGS_FOR_TEN[position], 1, 10)
    # Blank means not enough attempts to rate; the app treats it as unknown, not as weak.
    return {skill: r.get(skill, "") for skill in SKILLS}, set(r)


def evidence(skill, s):
    sets = s["sets_played"] or 1
    if skill == "hitting":
        pct = (s["kills"] - s["attack_errors"]) / s["attack_attempts"]
        return f"{s['kills']} kills on {s['attack_attempts']} attempts, hitting {pct:.3f}".replace("0.", ".")
    if skill == "serving":
        return f"{s['service_aces']} aces and {s['service_errors']} errors on {s['serve_attempts']} serves"
    if skill == "passing":
        return f"{1 - s['reception_errors'] / s['reception_attempts']:.1%} clean serve receive on {s['reception_attempts']} attempts"
    if skill == "setting":
        return f"{s['assists'] / sets:.2f} assists per set"
    if skill == "blocking":
        blocks = s["block_solos"] + 0.5 * s["block_assists"]
        return f"{blocks:g} total blocks ({blocks / sets:.2f} per set)"
    return f"{s['digs']} digs ({s['digs'] / sets:.2f} per set)"


def goal(skill, s):
    sets = s["sets_played"] or 1
    if skill == "hitting":
        pct = (s["kills"] - s["attack_errors"]) / s["attack_attempts"]
        return f"Raise hitting percentage from {pct:.3f} to {pct + 0.030:.3f} by cutting attack errors".replace("0.", ".")
    if skill == "serving":
        return f"Get to at least one ace per service error (now {s['service_aces']}:{s['service_errors']})"
    if skill == "passing":
        per100 = 100 * s["reception_errors"] / s["reception_attempts"]
        return f"Cut reception errors from {per100:.1f} to under {max(per100 - 2, 1):.1f} per 100 serves received"
    if skill == "setting":
        return f"Hold {s['assists'] / sets:.1f}+ assists per set while keeping set errors under {max(s['set_errors'], 1)} for the season"
    if skill == "blocking":
        return f"Add 0.2 blocks per set (now {(s['block_solos'] + 0.5 * s['block_assists']) / sets:.2f})"
    return f"Add 0.3 digs per set (now {s['digs'] / sets:.2f})"


skill_ratings, feedback, progress = [], [], []
for p, s in zip(players, player_stats):
    ratings, measured = ratings_for(s, p["position"])
    skill_ratings.append({"player_id": p["player_id"], **ratings})
    relevant = [k for k in SKILLS if k not in IGNORED[p["position"]] and k in measured]
    if len(relevant) < 2:
        feedback.append({
            "player_id": p["player_id"],
            "strengths": f"Limited court time so far ({s['sets_played']} sets in {s['matches_played']} matches)",
            "weaknesses": "Not enough 2026 data for a stats-based assessment",
            "coach_comments": "Generated from 2026 season stats. Replace with the coaching staff's notes.",
            "improvement_goals": "Earn more sets so there's enough data to target a skill",
        })
        continue
    # min() keeps the first skill on ties, like the stable sort in weakestSkills().
    weakest = min(relevant, key=lambda k: ratings[k])
    best = sorted((k for k in relevant if k != weakest), key=lambda k: ratings[k], reverse=True)[:2]
    feedback.append({
        "player_id": p["player_id"],
        "strengths": "; ".join(f"{k.capitalize()}: {evidence(k, s)}" for k in best),
        "weaknesses": f"{weakest.capitalize()}: {evidence(weakest, s)}",
        "coach_comments": "Generated from 2026 season stats. Replace with the coaching staff's notes.",
        "improvement_goals": goal(weakest, s),
    })
    beginner, intermediate, _ = DRILLS_BY_SKILL[weakest]
    progress.append({"player_id": p["player_id"], "exercise_id": beginner, "assigned_date": "2026-09-15", "completed": "true",
                     "completion_date": "2026-09-24", "progress_score": 60 + ratings[weakest] * 3})
    progress.append({"player_id": p["player_id"], "exercise_id": intermediate, "assigned_date": "2026-09-29", "completed": "false",
                     "completion_date": "", "progress_score": 45 + ratings[weakest] * 3})

matches = []
for g in sorted(stats_src["games"], key=lambda g: datetime.strptime(g["date"], "%m/%d/%Y")):
    sets = num(g["setsPlayed"])
    scores = " ".join(f"{g[f'periodScores{i}']}-{g[f'periodScoresOpponent{i}']}" for i in range(sets))
    matches.append({
        "team_id": TEAM_ID, "match_date": datetime.strptime(g["date"], "%m/%d/%Y").date().isoformat(),
        "opponent": g["opponent"], "venue": "home" if g["isAtHome"] else "neutral" if g["isNeutral"] else "away",
        "is_conference": str(bool(g["isALeagueGame"])).lower(), "result": "win" if g["winOrLoss"] == "W" else "loss",
        "sets_won": num(g["ourScore"]), "sets_lost": num(g["opponentScore"]), "set_scores": scores,
        "kills": num(g["attackStatsKills"]), "attack_errors": num(g["attackStatsErrors"]), "attack_attempts": num(g["attackStatsTotalAttempts"]),
        "assists": num(g["setStatsAssists"]), "service_aces": num(g["serveStatsServiceAces"]), "service_errors": num(g["serveStatsServiceErrors"]),
        "serve_attempts": num(g["serveStatsTotalServeAttempts"]), "reception_errors": num(g["defenseStatsReceptionErrors"]),
        "reception_attempts": num(g["defenseStatsTotalReceptionAttempts"]), "digs": num(g["defenseStatsDigs"]),
        "block_solos": num(g["blockStatsSolos"]), "block_assists": num(g["blockStatsAssists"]), "points": num(g["miscStatsPoints"]),
    })

wins = sum(m["result"] == "win" for m in matches)
team = [{
    "team_id": TEAM_ID, "team_name": "Women's Volleyball", "school": "UNC Chapel Hill", "gender": "women", "season": 2026,
    "matches": len(matches), "sets": sum(m["sets_won"] + m["sets_lost"] for m in matches), "wins": wins, "losses": len(matches) - wins,
}]

study_id = "sanhueza-tapia-2026-u16"
studies = [{
    "study_id": study_id,
    "title": "Technical-Tactical Indicators Across National and International Competition in Women's Under-16 Volleyball: A Longitudinal Single-Team Study",
    "authors": "Sanhueza-Tapia, H. G., et al.", "year": 2026, "doi": "10.5281/zenodo.21166667", "license": "CC BY 4.0",
    "population": "One Chilean women's under-16 club team: 50 national tournament matches and 8 South American Club Championship matches",
}]
with (DATA / "research/u16_womens_match_level.csv").open() as f:
    research = [{"study_id": study_id, **row} for row in csv.DictReader(f)]

write(UNC / "players.csv", players)
write(UNC / "player_stats.csv", player_stats)
write(UNC / "skill_ratings.csv", skill_ratings)
write(UNC / "coach_feedback.csv", feedback)
write(UNC / "training_progress.csv", progress)
write(UNC / "team.csv", team)
write(UNC / "team_matches.csv", matches)
write(DATA / "research/research_studies.csv", studies)
write(DATA / "research/research_matches.csv", research)
