/**
 * repo-insights — Data Collector
 *
 * Collects git and codebase metrics into a structured data object.
 * Export: collectData(onProgress) → data object
 */

import { execSync } from 'child_process';
import { readFileSync, existsSync } from 'fs';
import { join, extname, basename } from 'path';

const SOURCE_EXTENSIONS = new Set([
  '.ts', '.tsx', '.js', '.jsx', '.mjs', '.cjs',
  '.py', '.rb', '.go', '.rs', '.java',
  '.c', '.cpp', '.h', '.hpp', '.cs',
  '.php', '.swift', '.kt', '.scala',
  '.sh', '.vue', '.svelte',
]);

let ROOT;

function git(cmd) {
  return execSync(`git ${cmd}`, { cwd: ROOT, encoding: 'utf8', maxBuffer: 50 * 1024 * 1024 }).trim();
}

function isSourceFile(f) {
  return SOURCE_EXTENSIONS.has(extname(f).toLowerCase());
}

// ─── Section Collectors ───────────────────────────────────────────

function collectOverview() {
  const firstCommitDate = git('log --reverse --format=%ad --date=short').split('\n')[0];
  const latestCommitDate = git('log -1 --format=%ad --date=short');
  const totalCommits = parseInt(git('rev-list --count HEAD'));
  const totalBranches = git('branch -a').split('\n').filter(Boolean).length;
  const totalTags = git('tag').split('\n').filter(Boolean).length;

  const allFiles = git('ls-files').split('\n').filter(Boolean);
  const sourceFiles = allFiles.filter(isSourceFile);

  let totalLines = 0;
  let totalCharacters = 0;
  for (const f of sourceFiles) {
    try {
      const content = readFileSync(join(ROOT, f), 'utf8');
      totalLines += content.split('\n').length;
      totalCharacters += content.length;
    } catch {}
  }

  // Detect project name: package.json name → directory basename
  let projectName = basename(ROOT);
  try {
    const pkg = JSON.parse(readFileSync(join(ROOT, 'package.json'), 'utf8'));
    if (pkg.name) projectName = pkg.name;
  } catch {}

  return {
    projectName,
    firstCommit: firstCommitDate,
    latestCommit: latestCommitDate,
    totalCommits,
    totalBranches,
    totalTags,
    totalFiles: allFiles.length,
    totalSourceFiles: sourceFiles.length,
    totalLinesOfCode: totalLines,
    totalCharacters,
    collectedAt: new Date().toISOString(),
  };
}

function collectCommitsByMonth() {
  const raw = git('log --format=%ad --date=format:%Y-%m');
  const counts = {};
  for (const line of raw.split('\n')) {
    if (line) counts[line] = (counts[line] || 0) + 1;
  }
  return Object.entries(counts)
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([month, count]) => ({ month, count }));
}

function collectCommitsByWeek() {
  const raw = git('log --format=%ad --date=format:%Y-W%V');
  const counts = {};
  for (const line of raw.split('\n')) {
    if (line) counts[line] = (counts[line] || 0) + 1;
  }
  return Object.entries(counts)
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([week, count]) => ({ week, count }));
}

function collectCommitsByDayOfWeek() {
  const days = ['', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
  const raw = git('log --format=%ad --date=format:%u');
  const counts = {};
  for (const line of raw.split('\n')) {
    if (line) {
      const day = days[parseInt(line)];
      counts[day] = (counts[day] || 0) + 1;
    }
  }
  return days.filter(d => d).map(day => ({ day, count: counts[day] || 0 }));
}

function collectCommitsByHour() {
  const raw = git('log --format=%ad --date=format:%H');
  const counts = {};
  for (const line of raw.split('\n')) {
    if (line) counts[line] = (counts[line] || 0) + 1;
  }
  return Array.from({ length: 24 }, (_, i) => {
    const hour = String(i).padStart(2, '0');
    return { hour, count: counts[hour] || 0 };
  });
}

function collectContributors() {
  const raw = git('shortlog -sne --all');
  return raw.split('\n').filter(Boolean).map(line => {
    const match = line.trim().match(/^(\d+)\t(.+?)(?:\s+<(.+)>)?$/);
    if (!match) return null;
    return { commits: parseInt(match[1]), name: match[2].trim(), email: match[3] || '' };
  }).filter(Boolean);
}

function collectFileTypes() {
  const files = git('ls-files').split('\n').filter(Boolean);
  const counts = {};
  for (const f of files) {
    const ext = extname(f).replace('.', '') || '(no ext)';
    counts[ext] = (counts[ext] || 0) + 1;
  }
  return Object.entries(counts)
    .sort(([, a], [, b]) => b - a)
    .map(([extension, count]) => ({ extension, count }));
}

function collectDirectoryBreakdown() {
  const files = git('ls-files').split('\n').filter(Boolean);
  const counts = {};
  for (const f of files) {
    const parts = f.split('/');
    const dir = parts.length > 1 ? parts.slice(0, 2).join('/') : parts[0];
    counts[dir] = (counts[dir] || 0) + 1;
  }
  return Object.entries(counts)
    .sort(([, a], [, b]) => b - a)
    .map(([directory, fileCount]) => ({ directory, fileCount }));
}

function collectLargestFiles() {
  const files = git('ls-files').split('\n').filter(Boolean).filter(isSourceFile);
  const sizes = [];
  for (const f of files) {
    try {
      const content = readFileSync(join(ROOT, f), 'utf8');
      sizes.push({ file: f, lines: content.split('\n').length });
    } catch {}
  }
  sizes.sort((a, b) => b.lines - a.lines);
  return sizes.slice(0, 25);
}

function collectHottestFiles() {
  const since = new Date();
  since.setFullYear(since.getFullYear() - 1);
  const sinceStr = since.toISOString().slice(0, 10);
  const raw = git(`log --since=${sinceStr} --pretty=format: --name-only`);
  const counts = {};
  for (const line of raw.split('\n')) {
    const f = line.trim();
    if (f) {
      counts[f] = (counts[f] || 0) + 1;
    }
  }
  return Object.entries(counts)
    .sort(([, a], [, b]) => b - a)
    .slice(0, 30)
    .map(([file, changes]) => ({ file, changes }));
}

function collectChurnByMonth() {
  const raw = git('log --numstat --format=COMMIT_MONTH:%ad --date=format:%Y-%m');
  const data = {};
  let currentMonth = '';
  for (const line of raw.split('\n')) {
    if (line.startsWith('COMMIT_MONTH:')) {
      currentMonth = line.replace('COMMIT_MONTH:', '');
      if (!data[currentMonth]) data[currentMonth] = { added: 0, deleted: 0 };
    } else if (line.trim()) {
      const parts = line.split('\t');
      if (parts.length === 3 && parts[0] !== '-') {
        data[currentMonth].added += parseInt(parts[0]) || 0;
        data[currentMonth].deleted += parseInt(parts[1]) || 0;
      }
    }
  }
  return Object.entries(data)
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([month, { added, deleted }]) => ({ month, added, deleted }));
}

function collectCommitMessagePatterns() {
  const raw = git('log --format=%s');
  const patterns = {
    'Features': 0, 'Bug Fixes': 0, 'Improvements': 0, 'Code Review': 0,
    'Refactoring': 0, 'Performance': 0, 'Testing': 0, 'Docs': 0,
    'Security': 0, 'Merges': 0, 'Other': 0,
  };
  const messages = raw.split('\n').filter(Boolean);
  for (const msg of messages) {
    const lower = msg.toLowerCase().trim();
    if (lower.startsWith('merge')) patterns['Merges']++;
    else if (/^cr\b|^cr\s/i.test(lower)) patterns['Code Review']++;
    else if (/\bfix(ed|es|ing)?\b|\bbug\b|\bresolve[ds]?\b|\bpatch\b|\bcorrect(ed)?\b|\bhotfix\b/.test(lower)) patterns['Bug Fixes']++;
    else if (/^add(ed|ing|s)?\b|\bcreate[ds]?\b|\bimplement(ed)?\b|\bnew\b|\bintroduc|\bbuilt?\b|^feat[\(:]/.test(lower)) patterns['Features']++;
    else if (/\boptimiz|\bperformance\b|\bspeed\b|\bfast(er)?\b|\bcach(e|ing)\b|^perf[\(:]/.test(lower)) patterns['Performance']++;
    else if (/\bimprov(e|ed|ing|ement)\b|\benhance[ds]?\b|\bredesign|\bstreamline|\bpolish|\bbetter\b|\bupgrade[ds]?\b|\bmodularize|\bupdate[ds]?\b/.test(lower)) patterns['Improvements']++;
    else if (/\brefactor|\brestructur|\breorganiz|\bclean(ed|up| up)?\b|\bsimplif|\bconsolidat|\bremov(e|ed|ing)\b/.test(lower)) patterns['Refactoring']++;
    else if (/\bsecur(ity|e)?\b|\bauth\b|\bpermission|\bvalidat/.test(lower)) patterns['Security']++;
    else if (/\btest(s|ing)?\b|\bspec\b|\be2e\b|\buat\b/.test(lower)) patterns['Testing']++;
    else if (/\bdoc(s|umentation)?\b|\breadme\b|\bchangelog\b/.test(lower)) patterns['Docs']++;
    else if (/\blint\b|\bformat|\bbump\b|\bdepend|\bversion\b/.test(lower)) patterns['Improvements']++;
    else patterns['Other']++;
  }
  return Object.entries(patterns)
    .map(([type, count]) => ({ type, count }))
    .filter(p => p.count > 0)
    .sort((a, b) => b.count - a.count);
}

function collectStreaks() {
  const raw = git('log --format=%ad --date=format:%Y-%m-%d');
  const dates = [...new Set(raw.split('\n').filter(Boolean))].sort();

  if (dates.length === 0) {
    return {
      longestStreak: { days: 0, start: '', end: '' },
      busiestDay: { date: '', commits: 0 },
      activeDays: 0, totalDays: 0, activityRate: 0,
    };
  }

  let longestStreak = 0;
  let currentStreak = 1;
  let longestStart = dates[0];
  let longestEnd = dates[0];
  let currentStart = dates[0];

  for (let i = 1; i < dates.length; i++) {
    const prev = new Date(dates[i - 1]);
    const curr = new Date(dates[i]);
    const diffDays = (curr - prev) / (1000 * 60 * 60 * 24);
    if (diffDays === 1) {
      currentStreak++;
    } else {
      if (currentStreak > longestStreak) {
        longestStreak = currentStreak;
        longestStart = currentStart;
        longestEnd = dates[i - 1];
      }
      currentStreak = 1;
      currentStart = dates[i];
    }
  }
  if (currentStreak > longestStreak) {
    longestStreak = currentStreak;
    longestStart = currentStart;
    longestEnd = dates[dates.length - 1];
  }

  const dayCounts = {};
  for (const line of raw.split('\n').filter(Boolean)) {
    dayCounts[line] = (dayCounts[line] || 0) + 1;
  }
  const busiestDay = Object.entries(dayCounts).sort(([, a], [, b]) => b - a)[0];

  const activeDays = dates.length;
  const firstDate = new Date(dates[0]);
  const lastDate = new Date(dates[dates.length - 1]);
  const totalDays = Math.ceil((lastDate - firstDate) / (1000 * 60 * 60 * 24)) + 1;

  return {
    longestStreak: { days: longestStreak, start: longestStart, end: longestEnd },
    busiestDay: { date: busiestDay[0], commits: busiestDay[1] },
    activeDays,
    totalDays,
    activityRate: Math.round((activeDays / totalDays) * 100),
  };
}

function collectAIContributions() {
  const allCommits = parseInt(git('rev-list --count HEAD'));

  const aiPatterns = [
    { name: 'Claude', authorPattern: 'Claude' },
    { name: 'Cursor', authorPattern: 'Cursor', allBranches: true },
    { name: 'Copilot', authorPattern: 'copilot' },
    { name: 'CodeRabbit', authorPattern: 'coderabbitai' },
    { name: 'Dependabot', authorPattern: 'dependabot' },
    { name: 'Renovate', authorPattern: 'renovate' },
    { name: 'GitHub Actions', authorPattern: 'github-actions' },
  ];

  let totalAI = 0;
  const aiBreakdown = [];
  for (const { name, authorPattern, allBranches } of aiPatterns) {
    const branchFlag = allBranches ? '--all ' : '';
    const raw = git(`log ${branchFlag}--author="${authorPattern}" --oneline`);
    const count = raw ? raw.split('\n').filter(Boolean).length : 0;
    if (count > 0) {
      aiBreakdown.push({ name, commits: count });
      totalAI += count;
    }
  }

  const coAuthoredLines = git('log --all --grep="Co-Authored-By" --oneline');
  const coAuthored = coAuthoredLines ? coAuthoredLines.split('\n').filter(Boolean).length : 0;

  return {
    total: allCommits,
    human: allCommits - totalAI,
    aiBreakdown,
    coAuthored,
  };
}

function collectMilestones() {
  const raw = git('log --merges --format=%ad%x09%s --date=format:%Y-%m-%d');
  if (!raw) return [];
  return raw.split('\n').filter(l => l.includes('pull request')).map(line => {
    const [date, ...rest] = line.split('\t');
    const msg = rest.join('\t');
    const branchMatch = msg.match(/from\s+\S+\/(\S+)/);
    const prMatch = msg.match(/#(\d+)/);
    const branch = branchMatch ? branchMatch[1] : '';
    const label = branch
      .replace(/[-_]/g, ' ')
      .replace(/\b\w/g, c => c.toUpperCase())
      .replace(/\bV(\d)/g, 'v$1')
      .replace(/\bCve\b/g, 'CVE')
      .replace(/\bE2e\b/g, 'E2E')
      .replace(/\bUx\b/g, 'UX')
      .replace(/\bAws\b/g, 'AWS')
      .replace(/\bS3\b/g, 'S3')
      .replace(/\bApi\b/g, 'API')
      .replace(/\bLlm\b/g, 'LLM')
      .replace(/\bAi\b/g, 'AI');
    return { date, pr: prMatch ? parseInt(prMatch[1]) : 0, branch, label };
  }).filter(m => m.label && !m.label.toLowerCase().includes('docstring'));
}

function collectFunFacts(data) {
  const o = data.overview || {};
  const totalLines = o.totalLinesOfCode || 0;
  const totalCharacters = o.totalCharacters || 0;
  const totalCommits = o.totalCommits || 0;
  const projectDays = Math.ceil((new Date(o.latestCommit) - new Date(o.firstCommit)) / 86400000) || 1;

  const printedPages = Math.round(totalLines / 50);
  const totalWords = Math.round(totalCharacters / 5);
  const novelEquiv = (totalWords / 80000).toFixed(1);
  const typingHours = Math.round(totalWords / 60 / 60);

  return {
    printedPages,
    totalWords,
    novelEquivalent: parseFloat(novelEquiv),
    typingHours,
    avgCommitSize: totalCommits > 0 ? Math.round(totalLines / totalCommits) : 0,
    linesPerDay: Math.round(totalLines / projectDays),
  };
}

function collectWorkPatterns() {
  const raw = git('log --format=%ad --date=format:%u_%H');
  let weekdayCommits = 0;
  let weekendCommits = 0;
  let earlyBird = 0;
  let businessHrs = 0;
  let evening = 0;
  let nightOwl = 0;

  for (const line of raw.split('\n').filter(Boolean)) {
    const [dow, hr] = line.split('_').map(Number);
    if (dow >= 6) weekendCommits++; else weekdayCommits++;
    if (hr >= 5 && hr < 9) earlyBird++;
    else if (hr >= 9 && hr < 17) businessHrs++;
    else if (hr >= 17 && hr < 22) evening++;
    else nightOwl++;
  }
  const total = weekdayCommits + weekendCommits;
  return {
    weekday: weekdayCommits,
    weekend: weekendCommits,
    weekendPct: total > 0 ? Math.round(weekendCommits / total * 100) : 0,
    earlyBird,
    businessHrs,
    evening,
    nightOwl,
    peakWindow: [
      { label: 'Early Bird (5-9am)', count: earlyBird },
      { label: 'Business Hours (9-5pm)', count: businessHrs },
      { label: 'Evening (5-10pm)', count: evening },
      { label: 'Night Owl (10pm-5am)', count: nightOwl },
    ].sort((a, b) => b.count - a.count)[0].label,
  };
}

function collectCodeGrowth() {
  const raw = git('log --numstat --format=COMMIT_MONTH:%ad --date=format:%Y-%m');
  const monthly = {};
  let currentMonth = '';
  for (const line of raw.split('\n')) {
    if (line.startsWith('COMMIT_MONTH:')) {
      currentMonth = line.replace('COMMIT_MONTH:', '');
      if (!monthly[currentMonth]) monthly[currentMonth] = { added: 0, deleted: 0 };
    } else if (line.trim()) {
      const parts = line.split('\t');
      if (parts.length === 3 && parts[0] !== '-') {
        monthly[currentMonth].added += parseInt(parts[0]) || 0;
        monthly[currentMonth].deleted += parseInt(parts[1]) || 0;
      }
    }
  }
  let cumulative = 0;
  return Object.entries(monthly)
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([month, { added, deleted }]) => {
      cumulative += added - deleted;
      return { month, netLines: cumulative };
    });
}

function collectTestInfo() {
  // Broad test file patterns covering JS/TS, Python, Go, Ruby, etc.
  const allFiles = git('ls-files').split('\n').filter(Boolean);
  const testFiles = allFiles.filter(f => {
    const lower = f.toLowerCase();
    return /\.(test|spec)\.\w+$/.test(lower) ||
           /[_\-](test|spec)\.\w+$/.test(lower) ||
           /^test_.*\.\w+$/.test(basename(lower)) ||
           /\b(e2e|tests?|__tests__)\//i.test(f);
  });

  let totalTestLines = 0;
  let testCount = 0;
  for (const f of testFiles) {
    try {
      const content = readFileSync(join(ROOT, f), 'utf8');
      totalTestLines += content.split('\n').length;
      // Count test cases across languages
      const matches = content.match(/\b(it|test)\s*\(|def\s+test_|func\s+Test[A-Z]/g);
      if (matches) testCount += matches.length;
    } catch {}
  }
  return {
    testFiles: testFiles.length,
    totalTestLines,
    estimatedTests: testCount,
    fileList: testFiles,
  };
}

function collectDependencies() {
  try {
    const pkg = JSON.parse(readFileSync(join(ROOT, 'package.json'), 'utf8'));
    const deps = Object.keys(pkg.dependencies || {});
    const devDeps = Object.keys(pkg.devDependencies || {});
    return {
      production: deps.length,
      dev: devDeps.length,
      total: deps.length + devDeps.length,
      topDeps: deps.slice(0, 20),
      topDevDeps: devDeps.slice(0, 15),
    };
  } catch {
    return { production: 0, dev: 0, total: 0, topDeps: [], topDevDeps: [] };
  }
}

// ─── Main ─────────────────────────────────────────────────────────

export async function collectData(onProgress) {
  ROOT = execSync('git rev-parse --show-toplevel', { encoding: 'utf8' }).trim();

  const sections = {
    overview: collectOverview,
    commitsByMonth: collectCommitsByMonth,
    commitsByWeek: collectCommitsByWeek,
    commitsByDayOfWeek: collectCommitsByDayOfWeek,
    commitsByHour: collectCommitsByHour,
    contributors: collectContributors,
    fileTypes: collectFileTypes,
    directoryBreakdown: collectDirectoryBreakdown,
    largestFiles: collectLargestFiles,
    hottestFiles: collectHottestFiles,
    churnByMonth: collectChurnByMonth,
    commitMessagePatterns: collectCommitMessagePatterns,
    streaks: collectStreaks,
    aiContributions: collectAIContributions,
    milestones: collectMilestones,
    codeGrowth: collectCodeGrowth,
    workPatterns: collectWorkPatterns,
    testInfo: collectTestInfo,
    dependencies: collectDependencies,
  };

  const data = {};

  for (const [name, fn] of Object.entries(sections)) {
    if (onProgress) onProgress(name, 'start');
    try {
      data[name] = fn();
      if (onProgress) onProgress(name, 'done');
    } catch (err) {
      if (onProgress) onProgress(name, 'error', err.message);
    }
  }

  // Fun facts reads from the collected data object
  if (onProgress) onProgress('funFacts', 'start');
  try {
    data.funFacts = collectFunFacts(data);
    if (onProgress) onProgress('funFacts', 'done');
  } catch (err) {
    if (onProgress) onProgress('funFacts', 'error', err.message);
  }

  return data;
}
