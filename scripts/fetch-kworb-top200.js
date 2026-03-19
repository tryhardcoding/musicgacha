/**
 * kworb.net から iTunes Japan Top 200 チャートをスクレイピングし、JSONファイルに保存するスクリプト
 * 
 * 使い方: node scripts/fetch-kworb-top200.js
 * 
 * 出力: data/top200-daily.json
 */

const https = require('https');
const fs = require('fs');
const path = require('path');

const KWORB_URL = 'https://kworb.net/charts/itunes/jp.html';

function fetchHTML(url) {
    return new Promise((resolve, reject) => {
        const options = {
            headers: {
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
                'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
                'Accept-Language': 'ja,en-US;q=0.9,en;q=0.8',
            }
        };

        https.get(url, options, (res) => {
            if (res.statusCode !== 200) {
                reject(new Error(`HTTP ${res.statusCode}`));
                return;
            }
            let data = '';
            res.on('data', chunk => data += chunk);
            res.on('end', () => resolve(data));
            res.on('error', reject);
        }).on('error', reject);
    });
}

/**
 * HTMLテーブルからTop 200データをパース
 * kworb.net の構造:
 *   <table id="simpletable" class="sortable">
 *     <tr><th>Pos</th><th>P+</th><th>Artist and Title</th></tr>
 *     <tr><td>1</td><td>=</td><td class="mp text"><div>ARASHI - Five</div></td></tr>
 *     ...
 *   </table>
 */
function parseTop200(html) {
    const tracks = [];

    // テーブル行を正規表現で抽出
    // 各データ行: <tr><td>Pos</td><td>P+</td><td class="mp text"><div>Artist - Title</div></td></tr>
    const rowRegex = /<tr>\s*<td[^>]*>(\d+)<\/td>\s*<td[^>]*>[^<]*<\/td>\s*<td[^>]*>\s*<div>([^<]+)<\/div>/gi;

    let match;
    while ((match = rowRegex.exec(html)) !== null) {
        const rank = parseInt(match[1], 10);
        const rawText = match[2].trim();

        // HTMLエンティティをデコード
        const decoded = rawText
            .replace(/&amp;/g, '&')
            .replace(/&lt;/g, '<')
            .replace(/&gt;/g, '>')
            .replace(/&quot;/g, '"')
            .replace(/&#039;/g, "'")
            .replace(/&#39;/g, "'");

        // "Artist - Title" を分割
        // 最初の " - " で分割（アーティスト名にハイフンが含まれる場合を考慮）
        const separatorIndex = decoded.indexOf(' - ');
        if (separatorIndex === -1) {
            console.warn(`  Warning: Could not parse "${decoded}" (no separator found)`);
            continue;
        }

        const artist = decoded.substring(0, separatorIndex).trim();
        const name = decoded.substring(separatorIndex + 3).trim();

        if (artist && name) {
            tracks.push({
                rank,
                artist,
                name,
            });
        }
    }

    return tracks;
}

async function main() {
    console.log('=== Kworb iTunes Japan Top 200 Fetcher ===');
    console.log(`URL: ${KWORB_URL}`);
    console.log('');

    try {
        // 1. HTMLを取得
        console.log('Fetching HTML...');
        const html = await fetchHTML(KWORB_URL);
        console.log(`  Received ${html.length} bytes`);

        // 2. パース
        console.log('Parsing table...');
        const tracks = parseTop200(html);
        console.log(`  Found ${tracks.length} tracks`);

        if (tracks.length === 0) {
            console.error('Error: No tracks found. The page structure may have changed.');
            process.exit(1);
        }

        // 3. 結果表示（最初と最後の5曲）
        console.log('\nFirst 5 tracks:');
        tracks.slice(0, 5).forEach(t => {
            console.log(`  #${t.rank}: ${t.artist} - ${t.name}`);
        });
        console.log('\nLast 5 tracks:');
        tracks.slice(-5).forEach(t => {
            console.log(`  #${t.rank}: ${t.artist} - ${t.name}`);
        });

        // 4. JSONに保存
        const now = new Date();
        // JST (UTC+9) の当日をチャート日付とする
        // 例: 3/20 JST 05:00 (= 3/19 UTC 20:00) に取得 → chartDate = 3/20
        const jstNow = new Date(now.getTime() + 9 * 60 * 60 * 1000);
        const chartDate = jstNow.toISOString().split('T')[0]; // YYYY-MM-DD

        const output = {
            fetchedAt: now.toISOString(),
            chartDate,
            source: 'kworb.net/charts/itunes/jp.html',
            totalTracks: tracks.length,
            tracks,
        };

        // 最新データ
        const outputPath = path.join(__dirname, '..', 'data', 'top200-daily.json');
        fs.writeFileSync(outputPath, JSON.stringify(output, null, 2), 'utf-8');

        // 日別アーカイブ
        const historyDir = path.join(__dirname, '..', 'data', 'top200-history');
        if (!fs.existsSync(historyDir)) {
            fs.mkdirSync(historyDir, { recursive: true });
        }
        const historyPath = path.join(historyDir, `${chartDate}.json`);
        fs.writeFileSync(historyPath, JSON.stringify(output, null, 2), 'utf-8');

        // 日付一覧インデックスを更新
        const indexPath = path.join(historyDir, 'index.json');
        let dateIndex = [];
        if (fs.existsSync(indexPath)) {
            try { dateIndex = JSON.parse(fs.readFileSync(indexPath, 'utf-8')); } catch { }
        }
        if (!dateIndex.includes(chartDate)) {
            dateIndex.push(chartDate);
            dateIndex.sort().reverse(); // 新しい順
        }
        fs.writeFileSync(indexPath, JSON.stringify(dateIndex, null, 2), 'utf-8');

        console.log(`\nSaved to ${outputPath}`);
        console.log(`Archived to ${historyPath}`);
        console.log(`Chart date: ${chartDate}`);
        console.log(`Total tracks: ${tracks.length}`);
        console.log('Done!');
    } catch (error) {
        console.error('Fatal error:', error.message);
        process.exit(1);
    }
}

main();
