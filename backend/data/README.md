# SPIKE data

UNC Chapel Hill women's volleyball for the 2026 season.

The 15 players are fictional. Their counting stats add up to the team totals published by [UNC Athletics](https://goheels.com/sports/womens-volleyball/stats/2026): 13 matches, 50 sets, a 10–3 record, 654 kills, 229 attack errors, 1,597 attack attempts, 609 assists, 52 aces, 88 service errors, 65 reception errors, 622 digs, 19 solo blocks, and 238 block assists (138.0 total blocks).

There is no separate AI dataset. A training plan can be built from player stats, skill ratings, coach feedback, and completed exercises.

Video URLs are optional and left blank. Pose tracking, injury history, and wearable data are not included.

## Files

| File | What it holds |
| --- | --- |
| `unc_chapel_hill/team.csv` | One team |
| `unc_chapel_hill/players.csv` | Roster, position, height, class year, setter flag |
| `unc_chapel_hill/player_stats.csv` | Counting stats for the season |
| `unc_chapel_hill/skill_ratings.csv` | Six ratings, 1–10, derived from the counting stats |
| `unc_chapel_hill/coach_feedback.csv` | Strengths, weaknesses, comments, and goals |
| `exercises.csv` | Shared drill library |
| `unc_chapel_hill/training_progress.csv` | Assigned drills, completion, and a progress score |
| `unc_chapel_hill/rotations.csv` | All six rotations of a 4–2 lineup |
| `unc_chapel_hill/live_rotation.csv` | One current lineup for a live session |

Players belong to a team through `team_id`. Drills belong to a player through `player_id` and `exercise_id`.

## team.csv

`team_id`, `team_name`, `school`, `gender`, `season`, `matches`, `sets`, `wins`, `losses`.

`sets` is how many sets the team played. A player's `sets_played` can be lower, and the same set counts for more than one player.

## players.csv

`player_id`, `team_id`, `name`, `position`, `eligible_positions`, `height_cm`, `class_year`, `is_setter`.

`position` is the primary role: `OH` outside hitter, `OPP` opposite, `MB` middle blocker, `S` setter, `L` libero, `DS` defensive specialist.

`eligible_positions` lists every role that player can fill, separated by `|`. `is_setter` is `true` only for players who can run the offense. `class_year` is the age field for this roster.

## player_stats.csv

`player_id`, `matches_played`, `sets_played`, `kills`, `attack_attempts`, `attack_errors`, `assists`, `service_aces`, `service_errors`, `digs`, `block_solos`, `block_assists`, `reception_errors`.

`reception_errors` is kept because the passing rating uses it. Total blocks are not stored.

How the counting stats are spread:

- Outside hitters and opposites take most of the attack attempts. Their hitting percentage is between .200 and .320.
- Middle blockers have the most blocks and the highest hitting percentage, between .280 and .380.
- The primary setter (`unc-w-10`) has 548 of 609 assists, about 90 percent.
- Liberos and defensive specialists have the most digs and no attack attempts.

## skill_ratings.csv

`player_id`, `serving`, `passing`, `setting`, `hitting`, `blocking`, `defense`.

Each value is an integer from 1 to 10. It is the formula below, rounded to the nearest integer with halves rounded up, then clamped to that range. If `sets_played` is 0, every rating is 1. If `attack_attempts` is 0, `hitting` is 1.

- `serving` = `4 + (service_aces / sets_played) * 18 - (service_errors / sets_played) * 5`
- `passing` = `4 + min(digs / sets_played, 5) * 1.3 - (reception_errors / sets_played) * 4`
- `setting` = `2 + ((assists / sets_played) / 11) * 8`
- `hitting` = `2 + hitting_percentage * 16 + (kills / sets_played) * 1.1`
- `blocking` = `2 + (total_blocks / sets_played) * 8`
- `defense` = `1.5 + (digs / sets_played) * 2.2`

## coach_feedback.csv

`player_id`, `strengths`, `weaknesses`, `coach_comments`, `improvement_goals`.

One row per player. The comments match that player's ratings. Maya Ellison (`unc-w-01`) is the outside whose goal is serve receive. Quinn Adler (`unc-w-10`) is the setter whose goal is digging after the set.

## exercises.csv

`exercise_id`, `name`, `target_skill`, `difficulty`, `instructions`, `duration_minutes`, `reps`, `equipment`, `video_url`.

`target_skill` is one of `serving`, `passing`, `setting`, `hitting`, `blocking`, or `defense`. `difficulty` is `Beginner`, `Intermediate`, or `Advanced`. `video_url` is empty.

## training_progress.csv

`player_id`, `exercise_id`, `assigned_date`, `completed`, `completion_date`, `progress_score`.

`completed` is `true` or `false`. `completion_date` is empty when the drill is not finished. `progress_score` is 0–100. Each player has at least two assigned drills, some finished and some still open.

## rotations.csv

A 4–2 lineup for `unc-chapel-hill-wvb`. Six rotations, six court positions each.

`team_id`, `rotation_number`, `court_position`, `player_id`, `player_position`, `eligible_positions`, `setter_player_id`, `rotation_order`, `on_court_player_id`.

Court positions, from the team's side of the net:

| Position | Where |
| --- | --- |
| 1 | Right back, the server |
| 2 | Right front |
| 3 | Middle front |
| 4 | Left front |
| 5 | Left back |
| 6 | Middle back |

The two setters, Quinn Adler (`unc-w-10`) and Naomi Park (`unc-w-11`), stay opposite each other. `setter_player_id` is the setter in the front row (positions 2, 3, or 4) for that rotation. `rotation_order` is that player's court position in rotation 1 and does not change.

After a sideout everyone moves: 2 goes to 1, 1 to 6, 6 to 5, 5 to 4, 4 to 3, and 3 to 2. Rotation 6 leads back to rotation 1.

`player_id` is the player in the rotation. `on_court_player_id` is who is actually standing there. The libero, Tess Morgan (`unc-w-12`), replaces the back-row middle blocker.

Rotation 1:

| Court position | In the rotation | On the court |
| --- | --- | --- |
| 1 | Maya Ellison, OH | Maya Ellison |
| 2 | Quinn Adler, S, setting | Quinn Adler |
| 3 | Amina Diallo, MB | Amina Diallo |
| 4 | Jordan Hale, OPP | Jordan Hale |
| 5 | Naomi Park, S | Naomi Park |
| 6 | Brooke Keller, MB | Tess Morgan, L |

## live_rotation.csv

One synced snapshot of rotation 1, with the libero already on the court.

`session_id`, `team_id`, `rotation_number`, `player_id`, `court_position`, `updated_at`, `update_status`.

`player_id` here is the player on the court. `update_status` is `synced`. The timestamp is `2026-10-10T19:12:00-04:00`.

## Derived metrics

These are not stored. Compute them in the app.

- Hitting percentage = `(kills - attack_errors) / attack_attempts`
- Kills per set = `kills / sets_played`
- Aces per set = `service_aces / sets_played`
- Digs per set = `digs / sets_played`
- Blocks per set = `total_blocks / sets_played`
- Total blocks = `block_solos + 0.5 * block_assists`
