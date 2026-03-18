/**
 * iTunes エンリッチ連続バッチ実行スクリプト
 * 
 * enrich-itunes-data.js を500曲ずつ繰り返し実行し、
 * 全曲のエンリッチが完了するまで自動的にバッチを回す。
 * 
 * 使い方:
 *   node scripts/enrich-batch-loop.js              (500曲ずつ全完了まで)
 *   node scripts/enrich-batch-loop.js --batch 1000 (1000曲ずつ)
 *   node scripts/enrich-batch-loop.js --max-batches 10 (最大10バッチで停止)
 */

const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, '..');
const SONGS_PATH = path.join(ROOT, 'data', 'songs.json');

// CLI引数パース
const args = process.argv.slice(2);
const batchIdx = args.indexOf('--batch');
const BATCH_SIZE = batchIdx !== -1 ? parseInt(args[batchIdx + 1], 10) : 500;
const maxBatchIdx = args.indexOf('--max-batches');
const MAX_BATCHES = maxBatchIdx !== -1 ? parseInt(args[maxBatchIdx + 1], 10) : Infinity;

function countRemaining() {
    const data = JSON.parse(fs.readFileSync(SONGS_PATH, 'utf-8'));
    const packs = data.packs;
    let total = 0, enriched = 0;
    const seen = new Set();
    for (const [packId, tracks] of Object.entries(packs)) {
        for (const t of tracks) {
            const key = `${(t.artist || '').toLowerCase()}::${(t.name || '').toLowerCase()}`;
            if (seen.has(key)) continue;
            seen.add(key);
            total++;
            if (t.itunesSearched) enriched++;
        }
    }
    return { total, enriched, remaining: total - enriched };
}

async function main() {
    console.log('='.repeat(60));
    console.log('  iTunes Enrich - Continuous Batch Runner');
    console.log(`  Batch size: ${BATCH_SIZE} | Max batches: ${MAX_BATCHES === Infinity ? 'unlimited' : MAX_BATCHES}`);
    console.log(`  Started: ${new Date().toISOString()}`);
    console.log('='.repeat(60));

    let batchNum = 0;
    let totalSuccess = 0;
    let totalFailed = 0;

    while (batchNum < MAX_BATCHES) {
        const { total, enriched, remaining } = countRemaining();

        if (remaining === 0) {
            console.log('\n🎉 全曲のエンリッチが完了しました！');
            break;
        }

        batchNum++;
        const actualBatch = Math.min(BATCH_SIZE, remaining);

        console.log(`\n${'─'.repeat(60)}`);
        console.log(`  Batch #${batchNum} | Remaining: ${remaining}/${total} | Progress: ${((enriched / total) * 100).toFixed(1)}%`);
        console.log(`  Processing: ${actualBatch} tracks`);
        console.log(`  ETA for this batch: ~${Math.ceil(actualBatch * 3 / 60)} minutes`);
        console.log(`  ETA for all remaining: ~${Math.ceil(remaining * 3 / 60)} minutes (~${(remaining * 3 / 3600).toFixed(1)} hours)`);
        console.log(`${'─'.repeat(60)}`);

        try {
            execSync(`node scripts/enrich-itunes-data.js --limit ${actualBatch}`, {
                cwd: ROOT,
                stdio: 'inherit',
                timeout: 7200000, // 2時間タイムアウト
            });

            // 結果を確認
            const after = countRemaining();
            const batchSuccess = enriched + actualBatch - (total - after.total) - after.remaining;
            const processed = remaining - after.remaining;
            totalSuccess += processed;

            console.log(`\n✓ Batch #${batchNum} complete | Enriched this batch: ${processed}`);
            console.log(`  Cumulative: ${totalSuccess} tracks enriched`);

            // バッチ間の休憩（10秒）
            if (after.remaining > 0 && batchNum < MAX_BATCHES) {
                console.log('  Resting 10s before next batch...');
                await new Promise(r => setTimeout(r, 10000));
            }
        } catch (error) {
            console.error(`\n✗ Batch #${batchNum} failed: ${error.message}`);
            console.log('  Waiting 60s before retry...');
            await new Promise(r => setTimeout(r, 60000));
        }
    }

    // 最終サマリー
    const final = countRemaining();
    console.log('\n' + '='.repeat(60));
    console.log('  FINAL SUMMARY');
    console.log('='.repeat(60));
    console.log(`  Batches completed: ${batchNum}`);
    console.log(`  Total enriched: ${final.enriched}/${final.total}`);
    console.log(`  Remaining: ${final.remaining}`);
    console.log(`  Completion: ${((final.enriched / final.total) * 100).toFixed(1)}%`);
    console.log(`  Finished: ${new Date().toISOString()}`);
    console.log('='.repeat(60));
}

main().catch(err => {
    console.error('Fatal error:', err);
    process.exit(1);
});
