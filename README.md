# repo-insights

Zero-config git repository analytics. Run in any repo to get a beautiful, self-contained HTML report with charts covering commits, code growth, contributors, AI contributions, work patterns, tests, and dependencies.

## Usage

```bash
npx repo-insights
```

This produces two files in the current directory:

- **repo-insights.json** — raw metrics data
- **report.html** — self-contained HTML report with interactive charts

### Auto-open the report

```bash
npx repo-insights --open
```

## What's included

- Project overview (commits, files, LOC, characters)
- Commit velocity (by month, week, day of week, hour)
- Code growth over time
- Code churn (lines added/deleted)
- Contributor breakdown
- AI vs human contributions (Claude, Cursor, Copilot, CodeRabbit, etc.)
- Commit message patterns (features, fixes, refactoring, etc.)
- File type distribution
- Directory architecture breakdown
- Hottest files (most changed)
- Largest source files
- Commit streaks & activity rate
- Work patterns (weekday/weekend, time of day)
- Test suite summary
- Dependency overview
- Fun facts (novel equivalents, printed pages, typing hours)

## Requirements

- Node.js 18+
- Must be run inside a git repository

## License

MIT
