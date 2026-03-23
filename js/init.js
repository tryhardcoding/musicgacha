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
// デバウンス＋Observer一時停止で二重実行によるガタつきを防止。
(function() {
    var scaling = false; // スケーリング中フラグ（Observer自己トリガー防止）
    var debounceTimer = null;

    function scaleAds() {
        scaling = true;
        document.querySelectorAll('.ad-container').forEach(function(container) {
            container.style.padding = '0';
            container.style.borderRadius = '0';
            container.style.overflow = 'hidden';
            var cw = container.clientWidth;
            if (cw <= 0) return;
            var adEl = container.querySelector('[data-imobile-creative-width]');
            if (!adEl) return;
            var aw = parseInt(adEl.getAttribute('data-imobile-creative-width'), 10) || adEl.offsetWidth;
            if (aw > cw) {
                var s = cw / aw;
                adEl.style.transformOrigin = 'top left';
                adEl.style.transform = 'scale(' + s + ')';
                container.style.display = 'block';
                var ah = parseInt(adEl.getAttribute('data-imobile-creative-height'), 10) || adEl.offsetHeight || 90;
                container.style.height = (ah * s) + 'px';
            }
        });
        // スケーリング完了後にフラグ解除（DOM更新がflushされるのを待つ）
        requestAnimationFrame(function() { scaling = false; });
    }

    // デバウンス付きスケーリング: 最後のトリガーから500ms後に1回だけ実行
    function debouncedScale() {
        if (scaling) return; // 自分自身のDOM変更では再トリガーしない
        clearTimeout(debounceTimer);
        debounceTimer = setTimeout(scaleAds, 500);
    }

    // 定期チェック（i-mobileの広告挿入タイミングが不定のため）
    // 2秒間隔×5回 = 10秒間のみ
    var t = setInterval(debouncedScale, 2000);
    setTimeout(function() { clearInterval(t); }, 10000);

    // .ad-container要素のみを監視（document.body全体は広すぎて無関係なDOM変更でも発火する）
    if (window.MutationObserver) {
        function observeAdContainers() {
            document.querySelectorAll('.ad-container').forEach(function(container) {
                if (container._adObserverAttached) return; // 二重登録防止
                container._adObserverAttached = true;
                new MutationObserver(function() { debouncedScale(); })
                    .observe(container, { childList: true, subtree: true });
            });
        }
        // 初回 + 少し遅れて（動的生成されるコンテナ対応）
        observeAdContainers();
        setTimeout(observeAdContainers, 2000);
    }

    window.addEventListener('resize', function() {
        document.querySelectorAll('.ad-container [data-imobile-creative-width]').forEach(function(el) {
            el.style.transform = '';
            el.parentElement.style.height = '';
        });
        debouncedScale();
    });
})();

// ---- 3. Service Worker 登録 + 更新検知 ----
if ('serviceWorker' in navigator) {
    window.addEventListener('load', function() {
        navigator.serviceWorker.register('/sw.js').then(function(reg) {
            console.log('[SW] Registered:', reg.scope);

            // SW更新検知: 新しいSWがインストールされたらデータキャッシュをクリア
            reg.addEventListener('updatefound', function() {
                var newWorker = reg.installing;
                if (!newWorker) return;
                newWorker.addEventListener('statechange', function() {
                    if (newWorker.state === 'activated') {
                        console.log('[SW] New service worker activated, invalidating data cache');
                        if (window.MusicGacha && window.MusicGacha.invalidateDataCache) {
                            window.MusicGacha.invalidateDataCache();
                        }
                    }
                });
            });
        }).catch(function(err) {
            console.warn('[SW] Registration failed:', err);
        });
    });
}
