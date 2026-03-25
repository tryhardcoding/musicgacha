// ============================================================
// MusicGacha - Init Module
// インライン実行が必要な初期化処理を外部ファイル化
// (CSP unsafe-inline 除去のため)
// ============================================================

// ---- 1. Google AdSense 遅延読込 ----
window.addEventListener('load', function() {
    setTimeout(function() {
        var s = document.createElement('script');
        s.async = true;
        s.src = 'https://pagead2.googlesyndication.com/pagead/js/adsbygoogle.js?client=ca-pub-6425460794376495';
        s.crossOrigin = 'anonymous';
        document.head.appendChild(s);
    }, 1500);
});

// ---- 2. 広告スケーリング（i-mobile対応） ----
// ads.js側のscaleAdToFitは削除し、ここに一本化。
// rAF + デバウンスで1フレームに1回だけ実行し、ガタつきを完全防止。
(function() {
    var pendingRaf = null; // rAFリクエストID（二重実行防止）
    var scaling = false;   // スケーリング中フラグ（Observer自己トリガー防止）

    function scaleAds() {
        scaling = true;
        var containers = document.querySelectorAll('.ad-container');
        containers.forEach(function(container) {
            var cw = container.clientWidth;
            if (cw <= 0) return;
            var adEl = container.querySelector('[data-imobile-creative-width]');
            if (!adEl) return;
            var aw = parseInt(adEl.getAttribute('data-imobile-creative-width'), 10) || adEl.offsetWidth;
            var ah = parseInt(adEl.getAttribute('data-imobile-creative-height'), 10) || adEl.offsetHeight || 90;
            var newH;
            if (aw > cw) {
                var s = cw / aw;
                adEl.style.transformOrigin = 'top left';
                adEl.style.transform = 'scale(' + s + ')';
                newH = Math.round(ah * s) + 'px';
            } else {
                // 広告がコンテナ幅以下ならスケーリング不要
                adEl.style.transform = '';
                newH = ah + 'px';
            }
            // 同じ値なら書き込みをスキップ（不要なreflow/transition防止）
            if (container.style.height !== newH) {
                container.style.height = newH;
            }
        });
        // DOM更新がflushされるのを待ってからフラグ解除
        requestAnimationFrame(function() {
            scaling = false;
            pendingRaf = null;
        });
    }

    // rAFベースのスケーリングリクエスト: 同一フレーム内で複数回呼ばれても1回だけ実行
    function requestScale() {
        if (scaling || pendingRaf) return;
        pendingRaf = requestAnimationFrame(scaleAds);
    }

    // 定期チェック（i-mobileの広告挿入タイミングが不定のため）
    // 1秒間隔。広告が見つかったコンテナ数を追跡し、全コンテナ処理済みなら停止
    var checkCount = 0;
    var t = setInterval(function() {
        checkCount++;
        requestScale();
        if (checkCount >= 15) clearInterval(t); // 最大15秒
    }, 1000);

    // .ad-container要素のみを監視（document.body全体は広すぎて無関係なDOM変更でも発火する）
    if (window.MutationObserver) {
        function observeAdContainers() {
            document.querySelectorAll('.ad-container').forEach(function(container) {
                if (container._adObserverAttached) return; // 二重登録防止
                container._adObserverAttached = true;
                new MutationObserver(function() { requestScale(); })
                    .observe(container, { childList: true, subtree: true });
            });
        }
        // 初回 + 少し遅れて（動的生成されるコンテナ対応）
        observeAdContainers();
        setTimeout(observeAdContainers, 3000);
    }

    window.addEventListener('resize', function() {
        // リサイズ時はスケーリングをリセットしてから再計算
        document.querySelectorAll('.ad-container [data-imobile-creative-width]').forEach(function(el) {
            el.style.transform = '';
            if (el.parentElement) el.parentElement.style.height = '';
        });
        // リサイズはデバウンスで処理（連続リサイズ対策）
        scaling = false;
        if (pendingRaf) { cancelAnimationFrame(pendingRaf); pendingRaf = null; }
        requestScale();
    });
})();

// ---- 3. Service Worker 登録 + 自動更新 ----
if ('serviceWorker' in navigator) {
    // 新しいSWがページを制御したらリロード（1回だけ）
    var swReloading = false;
    navigator.serviceWorker.addEventListener('controllerchange', function() {
        if (swReloading) return;
        swReloading = true;
        console.log('[SW] New service worker activated, reloading for latest version...');
        window.location.reload();
    });

    window.addEventListener('load', function() {
        navigator.serviceWorker.register('/sw.js').then(function(reg) {
            console.log('[SW] Registered:', reg.scope);

            // SW更新検知: 新しいSWがインストールされたらデータキャッシュをクリア
            reg.addEventListener('updatefound', function() {
                var newWorker = reg.installing;
                if (!newWorker) return;
                console.log('[SW] Update found, installing new version...');
                newWorker.addEventListener('statechange', function() {
                    if (newWorker.state === 'activated') {
                        console.log('[SW] New service worker activated, invalidating data cache');
                        if (window.MusicGacha && window.MusicGacha.invalidateDataCache) {
                            window.MusicGacha.invalidateDataCache();
                        }
                    }
                });
            });

            // 定期的にSW更新をチェック（1時間ごと）
            setInterval(function() {
                reg.update();
            }, 60 * 60 * 1000);
        }).catch(function(err) {
            console.warn('[SW] Registration failed:', err);
        });
    });
}
