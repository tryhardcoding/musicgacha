/**
 * MusicGacha 日次更新スクリプト
 * 
 * songs.json更新 → Top200更新 → レアリティ付与 → iTunesデータ補完 を一括実行
 * 
 * 使い方:
 *   node scripts/daily-update.js              (全ステップ実行)
 *   node scripts/daily-update.js --skip-fetch  (データ取得をスキップしてエンリッチのみ)
 *   node scripts/daily-update.js --enrich-limit 100  (エンリッチを100曲に制限)
 * 
 * Cron設定例 (毎日AM3時):
 *   0 3 * * * cd /path/to/musicgacha && node scripts/daily-update.js >> logs/daily-update.log 2>&1
 * 
 * Windows タスクスケジューラ:
 *   プログラム: node
 *   引数: scripts\daily-update.js
 *   開始フォルダ: C:\dev\musicgacha
 */

const { execSync } = require('child_process');
const path = require('path');
const fs = require('fs');

const ROOT = path.join(__dirname, '..');

// ---- 設定 ----
const STEPS = [
    {
        name: 'songs.json更新 (Last.fm + Apple Charts)',
        command: 'node scripts/fetch-lastfm.js',
        skip: false,
    },
    {
        name: 'Top 200更新 (kworb)',
        command: 'node scripts/fetch-kworb-top200.js',
        skip: false,
    },
    {
        name: 'Top 200をパックにマージ',
        command: 'node scripts/merge-top200-to-packs.js',
        skip: false,
    },
    {
        name: 'レアリティ付与',
        command: 'node scripts/assign-rarity.js',
        skip: false,
    },
    {
        name: 'iTunesデータ補完 (songs.json)',
        command: 'node scripts/enrich-itunes-data.js',
        skip: false,
        // エンリッチは差分更新なので毎回実行しても安全
    },
    {
        name: 'iTunesデータ補完 (Top 200)',
        command: 'node scripts/enrich-itunes-data.js --top200',
        skip: false,
    },
];

// ---- メイン ----
async function main() {
    const args = process.argv.slice(2);
    const skipFetch = args.includes('--skip-fetch');
    const enrichLimitIdx = args.indexOf('--enrich-limit');
    const enrichLimit = enrichLimitIdx !== -1 ? parseInt(args[enrichLimitIdx + 1], 10) : 0;

    console.log('========================================');
    console.log('  MusicGacha Daily Update');
    console.log(`  ${new Date().toISOString()}`);
    console.log('========================================\n');

    const results = [];

    for (let i = 0; i < STEPS.length; i++) {
        const step = STEPS[i];

        // --skip-fetch: データ取得ステップをスキップ
        if (skipFetch && i < 4) {
            console.log(`[${i + 1}/${STEPS.length}] SKIP: ${step.name}`);
            results.push({ name: step.name, status: 'skipped' });
            continue;
        }

        console.log(`\n[${i + 1}/${STEPS.length}] ${step.name}`);
        console.log('─'.repeat(50));

        let command = step.command;

        // エンリッチの制限
        if (enrichLimit > 0 && command.includes('enrich-itunes-data')) {
            command += ` --limit ${enrichLimit}`;
        }

        try {
            const startTime = Date.now();
            execSync(command, {
                cwd: ROOT,
                stdio: 'inherit',
                timeout: 3600000, // 1時間タイムアウト
            });
            const elapsed = ((Date.now() - startTime) / 1000).toFixed(1);
            console.log(`\n✓ 完了 (${elapsed}s)`);
            results.push({ name: step.name, status: 'success', elapsed });
        } catch (error) {
            console.error(`\n✗ 失敗: ${error.message}`);
            results.push({ name: step.name, status: 'failed', error: error.message });
            // エラーでも次のステップに進む
        }
    }

    // サマリー
    console.log('\n========================================');
    console.log('  Summary');
    console.log('========================================');
    for (const r of results) {
        const icon = r.status === 'success' ? '✓' : r.status === 'skipped' ? '→' : '✗';
        const detail = r.elapsed ? ` (${r.elapsed}s)` : '';
        console.log(`  ${icon} ${r.name}${detail}`);
    }

    const failed = results.filter(r => r.status === 'failed').length;
    if (failed > 0) {
        console.log(`\n⚠ ${failed} step(s) failed`);
        process.exit(1);
    }

    console.log('\n✓ All steps completed successfully');

    // ログファイルに記録
    const logDir = path.join(ROOT, 'logs');
    if (!fs.existsSync(logDir)) fs.mkdirSync(logDir, { recursive: true });
    const logEntry = {
        timestamp: new Date().toISOString(),
        results,
    };
    const logPath = path.join(logDir, 'daily-update-history.json');
    let history = [];
    if (fs.existsSync(logPath)) {
        try { history = JSON.parse(fs.readFileSync(logPath, 'utf-8')); } catch { }
    }
    history.push(logEntry);
    // 最新30件のみ保持
    if (history.length > 30) history = history.slice(-30);
    fs.writeFileSync(logPath, JSON.stringify(history, null, 2), 'utf-8');
}

main().catch(err => {
    console.error('Fatal error:', err);
    process.exit(1);
});
