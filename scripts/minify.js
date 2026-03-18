#!/usr/bin/env node
// ============================================================
// MusicGacha - CSS/JS Minification Build Script
// バンドラーなしでCSS/JSをミニファイ
//
// 使い方: node scripts/minify.js
// 依存: npm install --save-dev clean-css terser
// ============================================================

const fs = require('fs');
const path = require('path');

async function minifyCSS() {
  try {
    const CleanCSS = require('clean-css');
    const input = fs.readFileSync('index.css', 'utf8');
    const output = new CleanCSS({
      level: 2, // 最適化レベル2（構造的な最適化も含む）
    }).minify(input);

    if (output.errors.length > 0) {
      console.error('[CSS] Errors:', output.errors);
      return;
    }

    const originalSize = Buffer.byteLength(input, 'utf8');
    const minifiedSize = Buffer.byteLength(output.styles, 'utf8');

    // バックアップ
    if (!fs.existsSync('index.css.backup')) {
      fs.copyFileSync('index.css', 'index.css.backup');
    }

    fs.writeFileSync('index.css', output.styles);
    console.log(`[CSS] index.css: ${(originalSize / 1024).toFixed(0)}KB → ${(minifiedSize / 1024).toFixed(0)}KB (${((1 - minifiedSize / originalSize) * 100).toFixed(0)}% 削減)`);

    if (output.warnings.length > 0) {
      console.log(`[CSS] Warnings: ${output.warnings.length}`);
    }
  } catch (err) {
    if (err.code === 'MODULE_NOT_FOUND') {
      console.log('[CSS] clean-css not found. Install with: npm install --save-dev clean-css');
    } else {
      console.error('[CSS] Error:', err.message);
    }
  }
}

async function minifyJS() {
  try {
    const { minify } = require('terser');
    const jsDir = 'js';
    const files = fs.readdirSync(jsDir).filter(f => f.endsWith('.js') && !f.endsWith('.backup'));

    let totalOriginal = 0;
    let totalMinified = 0;

    for (const file of files) {
      const filePath = path.join(jsDir, file);
      const input = fs.readFileSync(filePath, 'utf8');
      const originalSize = Buffer.byteLength(input, 'utf8');

      try {
        const result = await minify(input, {
          module: true,
          compress: {
            dead_code: true,
            drop_console: false, // console.logは残す（デバッグ用）
            passes: 2,
          },
          mangle: {
            module: true,
          },
          format: {
            comments: false,
          },
        });

        if (result.code) {
          const minifiedSize = Buffer.byteLength(result.code, 'utf8');
          totalOriginal += originalSize;
          totalMinified += minifiedSize;

          // バックアップ
          const backupPath = filePath + '.backup';
          if (!fs.existsSync(backupPath)) {
            fs.copyFileSync(filePath, backupPath);
          }

          fs.writeFileSync(filePath, result.code);
          console.log(`[JS] ${file}: ${(originalSize / 1024).toFixed(1)}KB → ${(minifiedSize / 1024).toFixed(1)}KB (${((1 - minifiedSize / originalSize) * 100).toFixed(0)}%)`);
        }
      } catch (err) {
        console.error(`[JS] Error minifying ${file}:`, err.message);
      }
    }

    console.log(`\n[JS] Total: ${(totalOriginal / 1024).toFixed(0)}KB → ${(totalMinified / 1024).toFixed(0)}KB (${((1 - totalMinified / totalOriginal) * 100).toFixed(0)}% 削減)`);
  } catch (err) {
    if (err.code === 'MODULE_NOT_FOUND') {
      console.log('[JS] terser not found. Install with: npm install --save-dev terser');
    } else {
      console.error('[JS] Error:', err.message);
    }
  }
}

async function main() {
  console.log('=== MusicGacha Minification ===\n');
  await minifyCSS();
  console.log('');
  await minifyJS();
}

main();
