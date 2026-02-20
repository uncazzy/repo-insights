/**
 * repo-insights — Report Generator
 *
 * Export: generateReport(data) → HTML string
 */

function e(s) { return String(s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;'); }
function num(n) { return Number(n).toLocaleString(); }

export function generateReport(data) {
  const o = data.overview || {};
  const projectAge = Math.max(1, Math.ceil((new Date(o.latestCommit || Date.now()) - new Date(o.firstCommit || Date.now())) / (1000*60*60*24)));
  const commitsPerDay = (o.totalCommits / projectAge).toFixed(1);
  const avgFileSize = o.totalSourceFiles > 0 ? Math.round(o.totalLinesOfCode / o.totalSourceFiles) : 0;
  const totalPRs = (data.milestones || []).length;
  const projectMonths = Math.max(1, Math.ceil(projectAge / 30));
  const prsPerMonth = (totalPRs / projectMonths).toFixed(1);
  const cbm = data.commitsByMonth || [];
  const momDelta = cbm.length >= 2
    ? Math.round(((cbm[cbm.length - 1].count - cbm[cbm.length - 2].count) / cbm[cbm.length - 2].count) * 100)
    : 0;
  const momLabel = momDelta > 0 ? `+${momDelta}%` : `${momDelta}%`;
  const f = data.funFacts || {};
  const wp = data.workPatterns || {};
  const dowColors = (data.commitsByDayOfWeek || []).map((_, i) => i >= 5 ? '#a78bfa' : '#22d3ee');

  // AI contributions — dynamic labels and data
  const ai = data.aiContributions || { total: 0, human: 0, aiBreakdown: [], coAuthored: 0 };
  const aiLabels = ['Human', ...(ai.aiBreakdown || []).map(a => a.name)];
  const aiData = [ai.human, ...(ai.aiBreakdown || []).map(a => a.commits)];
  const aiPaletteColors = ['#22d3ee', '#fbbf24', '#f472b6', '#34d399', '#fb923c', '#a78bfa', '#fb7185', '#3b82f6'];
  const aiColors = aiLabels.map((_, i) => aiPaletteColors[i % aiPaletteColors.length]);
  const aiSummary = [
    `${ai.human} human`,
    ...(ai.aiBreakdown || []).map(a => `${a.commits} ${a.name}`),
  ].join(' &middot; ');

  // Pre-build dynamic sections to avoid nested template literal issues
  const wpBars = [
    { label: 'Business Hours', count: wp.businessHrs || 0, color: '#22d3ee' },
    { label: 'Evening', count: wp.evening || 0, color: '#3b82f6' },
    { label: 'Night Owl', count: wp.nightOwl || 0, color: '#a78bfa' },
    { label: 'Early Bird', count: wp.earlyBird || 0, color: '#34d399' },
    { label: 'Weekend', count: wp.weekend || 0, color: '#fbbf24' },
  ].map(r => {
    const maxCount = Math.max(wp.businessHrs||0, wp.evening||0, wp.nightOwl||0, wp.earlyBird||0, wp.weekend||0);
    const pct = maxCount > 0 ? (r.count / maxCount * 100).toFixed(0) : 0;
    return '<div class="wp-bar-row"><span class="wp-bar-label">' + r.label + '</span><div class="wp-bar-track"><div class="wp-bar-fill" style="width:' + pct + '%;background:' + r.color + '">' + r.count + '</div></div></div>';
  }).join('\n        ');

  let contributorsSection = '';
  if ((data.contributors || []).length > 0) {
    const contribRows = data.contributors.slice(0, 20).map(c => {
      const maxCommits = data.contributors[0].commits;
      const pct = (c.commits / maxCommits * 100).toFixed(0);
      return '<tr><td>' + e(c.name) + '</td><td>' + num(c.commits) + '</td><td class="bar-cell"><div class="bar-fill" style="width:' + pct + '%"></div></td></tr>';
    }).join('\n        ');
    contributorsSection = `<div class="section">
    <h2><span class="icon">&#128101;</span> Contributors</h2>
    <table>
      <thead><tr><th>Name</th><th>Commits</th><th></th></tr></thead>
      <tbody>
        ${contribRows}
      </tbody>
    </table>
  </div>`;
  }

  let hottestSection = '';
  if ((data.hottestFiles || []).length > 0) {
    const hottestRows = data.hottestFiles.slice(0, 20).map(hf => {
      const maxChanges = data.hottestFiles[0].changes;
      const pct = (hf.changes / maxChanges * 100).toFixed(0);
      return '<tr><td class="file-path">' + e(hf.file) + '</td><td>' + hf.changes + '</td><td class="bar-cell"><div class="bar-fill" style="width:' + pct + '%"></div></td></tr>';
    }).join('\n        ');
    hottestSection = `<div class="section">
    <h2><span class="icon">&#128293;</span> Hottest Files (Most Changed)</h2>
    <table>
      <thead><tr><th>File</th><th>Changes</th><th></th></tr></thead>
      <tbody>
        ${hottestRows}
      </tbody>
    </table>
  </div>`;
  }

  let largestSection = '';
  if ((data.largestFiles || []).length > 0) {
    const largestRows = data.largestFiles.slice(0, 20).map(lf => {
      const maxLines = data.largestFiles[0].lines;
      const pct = (lf.lines / maxLines * 100).toFixed(0);
      return '<tr><td class="file-path">' + e(lf.file) + '</td><td>' + num(lf.lines) + '</td><td class="bar-cell"><div class="bar-fill" style="width:' + pct + '%"></div></td></tr>';
    }).join('\n        ');
    largestSection = `<div class="section">
    <h2><span class="icon">&#128451;</span> Largest Source Files</h2>
    <table>
      <thead><tr><th>File</th><th>Lines</th><th></th></tr></thead>
      <tbody>
        ${largestRows}
      </tbody>
    </table>
  </div>`;
  }

  const depTopDeps = ((data.dependencies || {}).topDeps || []).map(d => '<span class="tag">' + e(d) + '</span>').join('\n        ');
  const depTopDevDeps = ((data.dependencies || {}).topDevDeps || []).map(d => '<span class="tag">' + e(d) + '</span>').join('\n        ');

  const streaks = data.streaks || {};
  const streakDays = streaks.longestStreak ? streaks.longestStreak.days : 0;
  const busiestCommits = streaks.busiestDay ? streaks.busiestDay.commits : 0;
  const testRatio = o.totalLinesOfCode > 0 ? (((data.testInfo || {}).totalTestLines || 0) / o.totalLinesOfCode * 100).toFixed(1) : '0.0';
  const momColor = momDelta >= 0 ? '#34d399' : '#fb7185';
  const weekendMsg = (wp.weekendPct || 0) > 20 ? 'Significant weekend commitment' : 'Mostly weekday development';

  let streakDetail = '';
  if (streaks.longestStreak) {
    streakDetail += 'Longest streak: <strong style="color:var(--accent)">' + streaks.longestStreak.start + '</strong> to <strong style="color:var(--accent)">' + streaks.longestStreak.end + '</strong>';
  }
  if (streaks.busiestDay) {
    if (streakDetail) streakDetail += ' &middot; ';
    streakDetail += 'Busiest day: <strong style="color:var(--accent)">' + streaks.busiestDay.date + '</strong> with ' + streaks.busiestDay.commits + ' commits';
  }

  const html = `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>${e(o.projectName)} - Repository Insights</title>
<script src="https://cdn.jsdelivr.net/npm/chart.js@4.4.7/dist/chart.umd.min.js"><\/script>
<link rel="preconnect" href="https://fonts.googleapis.com">
<link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800;900&display=swap" rel="stylesheet">
<style>
  :root {
    --bg: #0f1117;
    --surface: #1a1d27;
    --surface2: #242837;
    --border: #2e3348;
    --border-hover: #3d4460;
    --text: #e4e7ef;
    --text2: #8b90a0;
    --text3: #5c6178;
    --accent: #22d3ee;
    --accent2: #67e8f9;
    --accent3: #a78bfa;
    --gradient-primary: linear-gradient(135deg, #22d3ee, #3b82f6);
    --gradient-secondary: linear-gradient(135deg, #67e8f9, #a78bfa);
  }
  * { margin: 0; padding: 0; box-sizing: border-box; }
  body { background: var(--bg); color: var(--text); font-family: 'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; line-height: 1.6; -webkit-font-smoothing: antialiased; }
  .container { max-width: 1200px; margin: 0 auto; padding: 2rem; }

  /* Hero */
  .hero { text-align: center; padding: 4rem 2rem 3rem; margin-bottom: 2rem; position: relative; overflow: hidden; }
  .hero::before { content: ''; position: absolute; inset: 0; background: radial-gradient(ellipse at 30% 20%, rgba(34,211,238,0.10) 0%, transparent 50%), radial-gradient(ellipse at 70% 30%, rgba(59,130,246,0.07) 0%, transparent 50%), radial-gradient(ellipse at 50% 80%, rgba(167,139,250,0.05) 0%, transparent 50%); }
  .hero .hero-icon { font-size: 3.5rem; display: block; margin-bottom: 0.75rem; position: relative; filter: drop-shadow(0 4px 12px rgba(34,211,238,0.3)); }
  .hero h1 { font-size: 2.75rem; font-weight: 900; letter-spacing: -0.03em; background: var(--gradient-primary); -webkit-background-clip: text; -webkit-text-fill-color: transparent; background-clip: text; position: relative; }
  .hero .subtitle { color: var(--text2); font-size: 1.05rem; margin-top: 0.5rem; position: relative; font-weight: 500; }
  .hero .date { color: var(--text3); font-size: 0.8rem; margin-top: 0.75rem; position: relative; }

  /* Stats */
  .stats-grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(170px, 1fr)); gap: 0.75rem; margin-bottom: 2rem; }
  .stat-card { background: var(--surface); border: 1px solid var(--border); border-radius: 14px; padding: 1.25rem 1rem; text-align: center; transition: all 0.25s ease; position: relative; overflow: hidden; }
  .stat-card::before { content: ''; position: absolute; top: 0; left: 0; right: 0; height: 2px; background: var(--gradient-primary); opacity: 0; transition: opacity 0.25s ease; }
  .stat-card:hover { transform: translateY(-2px); border-color: var(--border-hover); }
  .stat-card:hover::before { opacity: 1; }
  .stat-card .value { font-size: 2rem; font-weight: 900; letter-spacing: -0.02em; background: var(--gradient-primary); -webkit-background-clip: text; -webkit-text-fill-color: transparent; background-clip: text; }
  .stat-card .label { color: var(--text2); font-size: 0.78rem; margin-top: 0.2rem; font-weight: 500; text-transform: uppercase; letter-spacing: 0.04em; }
  .stat-card.alt .value { background: var(--gradient-secondary); -webkit-background-clip: text; -webkit-text-fill-color: transparent; background-clip: text; }

  /* Section */
  .section { background: var(--surface); border: 1px solid var(--border); border-radius: 14px; padding: 1.5rem; margin-bottom: 1.5rem; transition: border-color 0.2s ease; }
  .section:hover { border-color: var(--border-hover); }
  .section h2 { font-size: 1.15rem; font-weight: 700; margin-bottom: 1rem; display: flex; align-items: center; gap: 0.5rem; }
  .section h2 .icon { font-size: 1.3rem; }

  /* Charts */
  .chart-container { position: relative; width: 100%; max-height: 350px; }
  .chart-row { display: grid; grid-template-columns: 1fr 1fr; gap: 1rem; margin-bottom: 1rem; }
  @media (max-width: 768px) { .chart-row { grid-template-columns: 1fr; } }

  /* Tables */
  table { width: 100%; border-collapse: collapse; font-size: 0.85rem; }
  th { text-align: left; color: var(--text3); font-weight: 600; padding: 0.6rem 0.75rem; border-bottom: 1px solid var(--border); text-transform: uppercase; font-size: 0.72rem; letter-spacing: 0.05em; }
  td { padding: 0.5rem 0.75rem; border-bottom: 1px solid rgba(46,51,72,0.5); }
  tr:hover td { background: rgba(34,211,238,0.04); }
  .file-path { font-family: 'SF Mono', 'Fira Code', 'Cascadia Code', monospace; font-size: 0.78rem; color: var(--accent2); }
  .bar-cell { position: relative; width: 120px; }
  .bar-fill { position: absolute; left: 0; top: 4px; bottom: 4px; background: linear-gradient(90deg, rgba(34,211,238,0.15), rgba(34,211,238,0.05)); border-radius: 4px; }

  /* Tags */
  .tag-list { display: flex; flex-wrap: wrap; gap: 0.4rem; }
  .tag { background: rgba(34,211,238,0.08); border: 1px solid rgba(34,211,238,0.15); border-radius: 6px; padding: 0.2rem 0.6rem; font-size: 0.75rem; color: var(--accent2); font-family: 'SF Mono', 'Fira Code', monospace; transition: all 0.15s ease; }
  .tag:hover { background: rgba(34,211,238,0.15); border-color: rgba(34,211,238,0.3); }

  /* Highlight */
  .highlight-box { background: linear-gradient(135deg, rgba(34,211,238,0.08), rgba(167,139,250,0.06)); border: 1px solid rgba(34,211,238,0.2); border-radius: 12px; padding: 1.25rem; margin-bottom: 1rem; display: grid; grid-template-columns: repeat(auto-fit, minmax(130px, 1fr)); gap: 1rem; text-align: center; }
  .highlight-box .hl-value { font-size: 1.6rem; font-weight: 800; background: var(--gradient-primary); -webkit-background-clip: text; -webkit-text-fill-color: transparent; background-clip: text; }
  .highlight-box .hl-label { font-size: 0.75rem; color: var(--text2); font-weight: 500; margin-top: 0.1rem; }

  /* Fun facts */
  .fun-facts { display: grid; grid-template-columns: repeat(auto-fit, minmax(220px, 1fr)); gap: 1rem; }
  .fun-fact { background: var(--surface2); border-radius: 10px; padding: 1.25rem; display: flex; align-items: flex-start; gap: 0.75rem; }
  .fun-fact .ff-icon { font-size: 1.8rem; flex-shrink: 0; }
  .fun-fact .ff-value { font-size: 1.4rem; font-weight: 800; color: var(--accent); }
  .fun-fact .ff-desc { font-size: 0.8rem; color: var(--text2); margin-top: 0.1rem; }

  /* Work patterns */
  .work-patterns { display: grid; grid-template-columns: 1fr 1fr; gap: 1rem; }
  @media (max-width: 768px) { .work-patterns { grid-template-columns: 1fr; } }
  .wp-card { background: var(--surface2); border-radius: 10px; padding: 1.25rem; text-align: center; }
  .wp-card .wp-value { font-size: 2rem; font-weight: 900; background: var(--gradient-primary); -webkit-background-clip: text; -webkit-text-fill-color: transparent; background-clip: text; }
  .wp-card .wp-label { font-size: 0.8rem; color: var(--text2); margin-top: 0.15rem; }
  .wp-bar-row { display: flex; align-items: center; gap: 0.5rem; margin: 0.3rem 0; font-size: 0.78rem; }
  .wp-bar-label { min-width: 110px; color: var(--text2); text-align: right; }
  .wp-bar-track { flex: 1; height: 20px; background: var(--surface); border-radius: 4px; overflow: hidden; }
  .wp-bar-fill { height: 100%; border-radius: 4px; display: flex; align-items: center; padding-left: 0.5rem; font-size: 0.7rem; font-weight: 600; color: var(--text); }

  .dep-section { margin-top: 0.75rem; }
  .dep-section h3 { font-size: 0.78rem; color: var(--text3); text-transform: uppercase; letter-spacing: 0.05em; margin-bottom: 0.4rem; font-weight: 600; }

  .footer { text-align: center; color: var(--text3); font-size: 0.75rem; padding: 2.5rem 1rem 1rem; border-top: 1px solid var(--border); margin-top: 1rem; }

  ::-webkit-scrollbar { width: 6px; }
  ::-webkit-scrollbar-track { background: transparent; }
  ::-webkit-scrollbar-thumb { background: var(--border); border-radius: 3px; }
</style>
</head>
<body>
<div class="container">

  <div class="hero">
    <span class="hero-icon">&#128202;</span>
    <h1>${e(o.projectName)} Insights</h1>
    <div class="subtitle">Repository analytics & codebase health</div>
    <div class="date">${e(o.firstCommit)} &mdash; ${e(o.latestCommit)} &middot; ${projectAge} days of development</div>
  </div>

  <!-- Key Stats -->
  <div class="stats-grid">
    <div class="stat-card"><div class="value">${num(o.totalCommits)}</div><div class="label">Commits</div></div>
    <div class="stat-card alt"><div class="value">${num(o.totalLinesOfCode)}</div><div class="label">Lines of Code</div></div>
    <div class="stat-card"><div class="value">${num(o.totalCharacters || 0)}</div><div class="label">Characters</div></div>
    <div class="stat-card alt"><div class="value">${num(o.totalSourceFiles)}</div><div class="label">Source Files</div></div>
    <div class="stat-card"><div class="value">${commitsPerDay}</div><div class="label">Commits / Day</div></div>
    <div class="stat-card alt"><div class="value">${avgFileSize}</div><div class="label">Avg Lines / File</div></div>
    <div class="stat-card"><div class="value">${totalPRs}</div><div class="label">PRs Merged</div></div>
    <div class="stat-card alt"><div class="value">${prsPerMonth}</div><div class="label">PRs / Month</div></div>
    <div class="stat-card"><div class="value">${streakDays}</div><div class="label">Day Streak</div></div>
  </div>

  <!-- Fun Facts -->
  <div class="section">
    <h2><span class="icon">&#127775;</span> By the Numbers</h2>
    <div class="fun-facts">
      <div class="fun-fact">
        <div class="ff-icon">&#128214;</div>
        <div><div class="ff-value">${f.novelEquivalent || 0} novels</div><div class="ff-desc">Worth of text written (at ~80k words each)</div></div>
      </div>
      <div class="fun-fact">
        <div class="ff-icon">&#128221;</div>
        <div><div class="ff-value">${num(f.totalWords || 0)} words</div><div class="ff-desc">Total words (chars &divide; 5)</div></div>
      </div>
      <div class="fun-fact">
        <div class="ff-icon">&#128196;</div>
        <div><div class="ff-value">${num(f.printedPages || 0)} pages</div><div class="ff-desc">If printed single-spaced</div></div>
      </div>
      <div class="fun-fact">
        <div class="ff-icon">&#9997;&#65039;</div>
        <div><div class="ff-value">${num(f.linesPerDay || 0)} lines/day</div><div class="ff-desc">Average daily output</div></div>
      </div>
      <div class="fun-fact">
        <div class="ff-icon">&#128187;</div>
        <div><div class="ff-value">~${num(f.typingHours || 0)} hours</div><div class="ff-desc">Estimated typing time at 60 WPM</div></div>
      </div>
    </div>
  </div>

  <!-- Streaks -->
  <div class="section">
    <h2><span class="icon">&#9889;</span> Streaks & Activity</h2>
    <div class="highlight-box">
      <div><div class="hl-value">${streakDays}</div><div class="hl-label">Longest Streak (days)</div></div>
      <div><div class="hl-value">${busiestCommits}</div><div class="hl-label">Most Commits in 1 Day</div></div>
      <div><div class="hl-value">${streaks.activeDays || 0}</div><div class="hl-label">Active Days</div></div>
      <div><div class="hl-value">${streaks.activityRate || 0}%</div><div class="hl-label">Activity Rate</div></div>
    </div>
    <p style="color:var(--text2);font-size:0.82rem;">${streakDetail}</p>
  </div>

  <!-- Codebase Growth -->
  <div class="section">
    <h2><span class="icon">&#128200;</span> Codebase Growth</h2>
    <div class="chart-container" style="max-height:280px;"><canvas id="chartGrowth"></canvas></div>
  </div>

  <!-- Commit Velocity -->
  <div class="chart-row">
    <div class="section">
      <h2><span class="icon">&#128197;</span> Commits by Month <span style="font-size:0.8rem;font-weight:600;color:${momColor};margin-left:auto;">${momLabel} vs prev month</span></h2>
      <div class="chart-container"><canvas id="chartMonthly"></canvas></div>
    </div>
    <div class="section">
      <h2><span class="icon">&#128293;</span> Code Churn (Lines +/-)</h2>
      <div class="chart-container"><canvas id="chartChurn"></canvas></div>
    </div>
  </div>

  <div class="chart-row">
    <div class="section">
      <h2><span class="icon">&#128197;</span> Commits by Day of Week</h2>
      <div class="chart-container"><canvas id="chartDow"></canvas></div>
    </div>
    <div class="section">
      <h2><span class="icon">&#9200;</span> Commits by Hour</h2>
      <div class="chart-container"><canvas id="chartHour"></canvas></div>
    </div>
  </div>

  <div class="section">
    <h2><span class="icon">&#128640;</span> Weekly Velocity</h2>
    <div class="chart-container" style="max-height:250px;"><canvas id="chartWeekly"></canvas></div>
  </div>

  <!-- AI & Commit Types -->
  <div class="chart-row">
    <div class="section">
      <h2><span class="icon">&#129302;</span> AI vs Human Contributions</h2>
      <div class="chart-container" style="max-height:280px;"><canvas id="chartAI"></canvas></div>
      <p style="color:var(--text2);font-size:0.78rem;margin-top:0.75rem;text-align:center;">
        ${aiSummary}${ai.coAuthored ? ' &middot; ' + ai.coAuthored + ' co-authored' : ''}
      </p>
    </div>
    <div class="section">
      <h2><span class="icon">&#128221;</span> Commit Types</h2>
      <div class="chart-container" style="max-height:280px;"><canvas id="chartCommitTypes"></canvas></div>
    </div>
  </div>

  <!-- File Types & Architecture -->
  <div class="chart-row">
    <div class="section">
      <h2><span class="icon">&#128193;</span> File Types</h2>
      <div class="chart-container" style="max-height:280px;"><canvas id="chartFileTypes"></canvas></div>
    </div>
    <div class="section">
      <h2><span class="icon">&#127959;</span> Architecture (Directories)</h2>
      <div class="chart-container" style="max-height:280px;"><canvas id="chartDirs"></canvas></div>
    </div>
  </div>

  <!-- Work Patterns -->
  <div class="section">
    <h2><span class="icon">&#128338;</span> Work Patterns</h2>
    <div class="work-patterns">
      <div>
        <div style="display:flex;gap:0.75rem;margin-bottom:1rem;">
          <div class="wp-card" style="flex:1"><div class="wp-value">${100 - (wp.weekendPct || 0)}%</div><div class="wp-label">Weekday</div></div>
          <div class="wp-card" style="flex:1"><div class="wp-value">${wp.weekendPct || 0}%</div><div class="wp-label">Weekend</div></div>
        </div>
        <p style="color:var(--text2);font-size:0.8rem;">
          ${weekendMsg} &mdash;
          ${num(wp.weekend || 0)} of ${num((wp.weekday||0) + (wp.weekend||0))} commits on Sat/Sun
        </p>
      </div>
      <div>
        ${wpBars}
      </div>
    </div>
  </div>

  ${contributorsSection}

  ${hottestSection}

  ${largestSection}

  <!-- Tests -->
  <div class="section">
    <h2><span class="icon">&#9989;</span> Test Suite</h2>
    <div class="highlight-box">
      <div><div class="hl-value">${(data.testInfo || {}).testFiles || 0}</div><div class="hl-label">Test Files</div></div>
      <div><div class="hl-value">${num((data.testInfo || {}).estimatedTests || 0)}</div><div class="hl-label">Test Cases</div></div>
      <div><div class="hl-value">${num((data.testInfo || {}).totalTestLines || 0)}</div><div class="hl-label">Lines of Test Code</div></div>
      <div><div class="hl-value">${testRatio}%</div><div class="hl-label">Test-to-Code Ratio</div></div>
    </div>
  </div>

  <!-- Dependencies -->
  <div class="section">
    <h2><span class="icon">&#128230;</span> Dependencies (${(data.dependencies || {}).total || 0} total)</h2>
    <div class="dep-section">
      <h3>Runtime (${(data.dependencies || {}).production || 0}) &mdash; packages shipped to production</h3>
      <div class="tag-list">
        ${depTopDeps}
      </div>
    </div>
    <div class="dep-section">
      <h3>Build & Dev (${(data.dependencies || {}).dev || 0}) &mdash; used only during development</h3>
      <div class="tag-list">
        ${depTopDevDeps}
      </div>
    </div>
  </div>

  <div class="footer">
    &#128202; Generated by repo-insights &middot; ${e(o.projectName)} &middot; ${new Date().toLocaleDateString()}
  </div>
</div>

<script>
const P = {
  teal: '#22d3ee', blue: '#3b82f6', purple: '#a78bfa', pink: '#f472b6',
  green: '#34d399', amber: '#fbbf24', orange: '#fb923c', rose: '#fb7185',
};
const gridColor = 'rgba(46,51,72,0.4)';
const tickColor = '#5c6178';
const commonOpts = {
  responsive: true, maintainAspectRatio: false,
  plugins: { legend: { display: false } },
  scales: {
    x: { ticks: { color: tickColor, maxRotation: 45, font: { family: 'Inter' } }, grid: { color: gridColor } },
    y: { ticks: { color: tickColor, font: { family: 'Inter' } }, grid: { color: gridColor } }
  }
};

// Codebase growth
new Chart(document.getElementById('chartGrowth'), {
  type: 'line',
  data: {
    labels: ${JSON.stringify((data.codeGrowth || []).map(g => g.month))},
    datasets: [{
      label: 'Net Lines of Code',
      data: ${JSON.stringify((data.codeGrowth || []).map(g => g.netLines))},
      borderColor: P.teal, backgroundColor: 'rgba(34,211,238,0.08)', fill: true,
      tension: 0.3, pointRadius: 4, pointBackgroundColor: P.teal, borderWidth: 2.5,
      pointHoverRadius: 7, pointHoverBackgroundColor: P.blue,
    }]
  },
  options: { ...commonOpts, plugins: { legend: { display: true, labels: { color: tickColor, font: { family: 'Inter' } } } } }
});

// Monthly commits
new Chart(document.getElementById('chartMonthly'), {
  type: 'bar',
  data: {
    labels: ${JSON.stringify((data.commitsByMonth || []).map(m => m.month))},
    datasets: [{ data: ${JSON.stringify((data.commitsByMonth || []).map(m => m.count))}, backgroundColor: 'rgba(34,211,238,0.7)', hoverBackgroundColor: P.teal, borderRadius: 5, borderSkipped: false }]
  },
  options: { ...commonOpts }
});

// Churn
new Chart(document.getElementById('chartChurn'), {
  type: 'bar',
  data: {
    labels: ${JSON.stringify((data.churnByMonth || []).map(m => m.month))},
    datasets: [
      { label: 'Added', data: ${JSON.stringify((data.churnByMonth || []).map(m => m.added))}, backgroundColor: 'rgba(52,211,153,0.7)', borderRadius: 4 },
      { label: 'Deleted', data: ${JSON.stringify((data.churnByMonth || []).map(m => -m.deleted))}, backgroundColor: 'rgba(251,113,133,0.6)', borderRadius: 4 }
    ]
  },
  options: { ...commonOpts, plugins: { legend: { display: true, labels: { color: tickColor, font: { family: 'Inter' } } } }, scales: { x: { ...commonOpts.scales.x, stacked: true }, y: { ...commonOpts.scales.y, stacked: true } } }
});

// Day of week
new Chart(document.getElementById('chartDow'), {
  type: 'bar',
  data: {
    labels: ${JSON.stringify((data.commitsByDayOfWeek || []).map(d => d.day))},
    datasets: [{ data: ${JSON.stringify((data.commitsByDayOfWeek || []).map(d => d.count))}, backgroundColor: ${JSON.stringify(dowColors)}, borderRadius: 8, borderSkipped: false }]
  },
  options: { ...commonOpts, scales: { ...commonOpts.scales, y: { ...commonOpts.scales.y, beginAtZero: true } } }
});

// Hour of day
new Chart(document.getElementById('chartHour'), {
  type: 'line',
  data: {
    labels: ${JSON.stringify((data.commitsByHour || []).map(h => h.hour + ':00'))},
    datasets: [{ data: ${JSON.stringify((data.commitsByHour || []).map(h => h.count))}, borderColor: P.teal, backgroundColor: 'rgba(34,211,238,0.08)', fill: true, tension: 0.4, pointRadius: 3, pointBackgroundColor: P.teal, pointHoverRadius: 6, borderWidth: 2 }]
  },
  options: { ...commonOpts }
});

// Weekly velocity
new Chart(document.getElementById('chartWeekly'), {
  type: 'bar',
  data: {
    labels: ${JSON.stringify((data.commitsByWeek || []).map(w => w.week))},
    datasets: [{ data: ${JSON.stringify((data.commitsByWeek || []).map(w => w.count))}, backgroundColor: 'rgba(34,211,238,0.5)', hoverBackgroundColor: P.teal, borderRadius: 2, borderSkipped: false }]
  },
  options: { ...commonOpts, scales: { ...commonOpts.scales, x: { ...commonOpts.scales.x, ticks: { ...commonOpts.scales.x.ticks, maxTicksLimit: 20 } } } }
});

// AI vs Human
new Chart(document.getElementById('chartAI'), {
  type: 'doughnut',
  data: {
    labels: ${JSON.stringify(aiLabels)},
    datasets: [{ data: ${JSON.stringify(aiData)}, backgroundColor: ${JSON.stringify(aiColors)}, borderColor: '#1a1d27', borderWidth: 3 }]
  },
  options: { responsive: true, maintainAspectRatio: false, cutout: '65%', plugins: { legend: { display: true, position: 'bottom', labels: { color: tickColor, padding: 12, font: { family: 'Inter', size: 12 } } } } }
});

// Commit types
const commitTypes = ${JSON.stringify(data.commitMessagePatterns || [])};
const typeColors = [P.teal, P.blue, P.purple, P.pink, P.green, P.amber, P.orange, P.rose, '#5c6178', '#3d4460', '#2e3348'];
new Chart(document.getElementById('chartCommitTypes'), {
  type: 'doughnut',
  data: {
    labels: commitTypes.map(t => t.type),
    datasets: [{ data: commitTypes.map(t => t.count), backgroundColor: typeColors.slice(0, commitTypes.length), borderColor: '#1a1d27', borderWidth: 2 }]
  },
  options: { responsive: true, maintainAspectRatio: false, cutout: '55%', plugins: { legend: { display: true, position: 'bottom', labels: { color: tickColor, padding: 8, font: { family: 'Inter', size: 11 } } } } }
});

// File types
const topTypes = ${JSON.stringify((data.fileTypes || []).slice(0, 8))};
new Chart(document.getElementById('chartFileTypes'), {
  type: 'doughnut',
  data: {
    labels: topTypes.map(t => '.' + t.extension),
    datasets: [{ data: topTypes.map(t => t.count), backgroundColor: [P.teal, P.blue, P.purple, P.pink, P.green, P.amber, P.orange, P.rose], borderColor: '#1a1d27', borderWidth: 3 }]
  },
  options: { responsive: true, maintainAspectRatio: false, cutout: '60%', plugins: { legend: { display: true, position: 'bottom', labels: { color: tickColor, padding: 8, font: { family: 'Inter' } } } } }
});

// Directory breakdown
const topDirs = ${JSON.stringify((data.directoryBreakdown || []).slice(0, 12))};
new Chart(document.getElementById('chartDirs'), {
  type: 'bar',
  data: {
    labels: topDirs.map(d => d.directory),
    datasets: [{ data: topDirs.map(d => d.fileCount), backgroundColor: 'rgba(103,232,249,0.6)', hoverBackgroundColor: P.teal, borderRadius: 4 }]
  },
  options: { indexAxis: 'y', responsive: true, maintainAspectRatio: false, plugins: { legend: { display: false } }, scales: { x: { ticks: { color: tickColor }, grid: { color: gridColor } }, y: { ticks: { color: tickColor, font: { family: 'monospace', size: 11 } }, grid: { display: false } } } }
});

<\/script>
</body>
</html>`;

  return html;
}
