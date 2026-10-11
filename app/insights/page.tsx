import { SetupNotice } from "@/components/SetupNotice";
import { coachPage } from "@/backend/lib/auth";
import { getResearch, getTeamMatches, getTeams } from "@/backend/lib/data";
import { isSupabaseConfigured, publicClient } from "@/backend/lib/supabase";
import { hittingPercentage, matchLine, researchSummary } from "@/lib/insights";
import { formatHitting, formatPercent } from "@/lib/volleyball";

export const dynamic = "force-dynamic";

export default async function InsightsPage() {
  if (!isSupabaseConfigured()) return <SetupNotice />;
  await coachPage();

  const db = publicClient();
  const [team] = await getTeams(db);
  if (!team) return <p className="muted">No teams yet. Run npm run db:seed to load the UNC Chapel Hill data.</p>;
  const [matches, research] = await Promise.all([getTeamMatches(db, team.team_id), getResearch(db)]);

  const wins = matches.filter((m) => m.result === "win");
  const losses = matches.filter((m) => m.result === "loss");
  const inWins = matchLine(wins);
  const inLosses = matchLine(losses);
  const study = research.studies[0];
  const summary = research.matches.length ? researchSummary(research.matches) : null;

  const unc = [
    { label: "Hitting %", won: formatHitting(inWins.hittingPercentage), lost: formatHitting(inLosses.hittingPercentage) },
    { label: "Kill %", won: formatPercent(inWins.killPercentage), lost: formatPercent(inLosses.killPercentage) },
    { label: "Serve receive %", won: formatPercent(inWins.receptionPercentage), lost: formatPercent(inLosses.receptionPercentage) },
    { label: "Serves in %", won: formatPercent(inWins.serveInPercentage), lost: formatPercent(inLosses.serveInPercentage) },
    { label: "Aces / set", won: inWins.acesPerSet.toFixed(2), lost: inLosses.acesPerSet.toFixed(2) },
    { label: "Digs / set", won: inWins.digsPerSet.toFixed(2), lost: inLosses.digsPerSet.toFixed(2) },
    { label: "Blocks / set", won: inWins.blocksPerSet.toFixed(2), lost: inLosses.blocksPerSet.toFixed(2) },
  ];

  return (
    <>
      <h1>Insights</h1>
      <p className="muted">
        What wins matches, from UNC&apos;s {team.season} results and a published study of {research.matches.length} matches.
      </p>

      <h2>
        UNC in wins vs losses ({wins.length}–{losses.length})
      </h2>
      <div className="panel" style={{ padding: 0, overflowX: "auto" }}>
        <table>
          <thead>
            <tr>
              <th>Team stat</th>
              <th className="num">Wins ({wins.length})</th>
              <th className="num">Losses ({losses.length})</th>
            </tr>
          </thead>
          <tbody>
            {unc.map((row) => (
              <tr key={row.label}>
                <td>{row.label}</td>
                <td className="num">{row.won}</td>
                <td className="num">{row.lost}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {summary && study ? (
        <>
          <h2>What the research says</h2>
          <div className="panel">
            <p style={{ marginTop: 0 }}>
              Across {summary.wins + summary.losses} national-tournament matches, <strong>attack effectiveness</strong> was the only
              indicator that separated wins from losses. The team won {formatPercent(summary.winRateAboveMedian, 0)} of matches when
              its attack effectiveness was at or above its median of {summary.attackMedian.toFixed(0)}%, and{" "}
              {formatPercent(summary.winRateBelowMedian, 0)} when it was below. SPIKE&apos;s lineup optimizer gives hitters an extra
              weight for hitting efficiency because of this.
            </p>
            <table>
              <thead>
                <tr>
                  <th>Indicator</th>
                  <th className="num">Won ({summary.wins})</th>
                  <th className="num">Lost ({summary.losses})</th>
                </tr>
              </thead>
              <tbody>
                {summary.kpis.map((k) => (
                  <tr key={k.key}>
                    <td>{k.label}</td>
                    <td className="num">{k.won.toFixed(k.key.endsWith("per_set") ? 2 : 1)}</td>
                    <td className="num">{k.lost.toFixed(k.key.endsWith("per_set") ? 2 : 1)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
            <p className="muted" style={{ marginBottom: 0 }}>
              {study.authors} ({study.year}). {study.title}. <a href={`https://doi.org/${study.doi}`}>doi:{study.doi}</a>, {study.license}.{" "}
              {study.population}. Youth club data, so treat it as a direction rather than a college benchmark.
            </p>
          </div>
        </>
      ) : null}

      <h2>Match log</h2>
      <div className="panel" style={{ padding: 0, overflowX: "auto" }}>
        <table>
          <thead>
            <tr>
              <th>Date</th>
              <th>Opponent</th>
              <th>Result</th>
              <th>Sets</th>
              <th className="num">Hit %</th>
              <th className="num">K</th>
              <th className="num">SA</th>
              <th className="num">SE</th>
              <th className="num">Recv %</th>
              <th className="num">Digs</th>
              <th className="num">Blocks</th>
            </tr>
          </thead>
          <tbody>
            {matches.map((m) => (
              <tr key={`${m.match_date}-${m.opponent}`}>
                <td>{m.match_date}</td>
                <td>
                  {m.venue === "away" ? "at " : m.venue === "neutral" ? "vs " : ""}
                  {m.opponent}
                  {m.is_conference ? <span className="pill" style={{ marginLeft: 6 }}>ACC</span> : null}
                </td>
                <td>
                  {m.result === "win" ? "W" : "L"} {m.sets_won}–{m.sets_lost}
                </td>
                <td className="muted">{m.set_scores}</td>
                <td className="num">{formatHitting(hittingPercentage(m))}</td>
                <td className="num">{m.kills}</td>
                <td className="num">{m.service_aces}</td>
                <td className="num">{m.service_errors}</td>
                <td className="num">{formatPercent(m.reception_attempts ? 1 - m.reception_errors / m.reception_attempts : null)}</td>
                <td className="num">{m.digs}</td>
                <td className="num">{(m.block_solos + 0.5 * m.block_assists).toFixed(1)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <p className="muted">Source: goheels.com 2026 box scores.</p>
    </>
  );
}
