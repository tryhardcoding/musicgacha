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
(function() {
    function scaleAds() {
        document.querySelectorAll('.ad-container').forEach(function(container) {
            // CSSキャッシュ対策: スタイルを強制リセット
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
                // top leftを基準にスケーリング → scaleした幅がコンテナにぴったり
                adEl.style.transformOrigin = 'top left';
                adEl.style.transform = 'scale(' + s + ')';
                // コンテナをblock表示に変更（flex centeringによるズレ防止）
                container.style.display = 'block';
                var ah = parseInt(adEl.getAttribute('data-imobile-creative-height'), 10) || adEl.offsetHeight || 90;
                container.style.height = (ah * s) + 'px';
            }
        });
    }
    // 定期チェック（i-mobileの広告挿入タイミングが不定のため）
    var t = setInterval(scaleAds, 1000);
    setTimeout(function() { clearInterval(t); }, 15000);
    // DOMの変更も監視
    if (window.MutationObserver) {
        new MutationObserver(function() { setTimeout(scaleAds, 300); })
            .observe(document.body || document.documentElement, { childList: true, subtree: true });
    }
    window.addEventListener('resize', function() {
        document.querySelectorAll('.ad-container [data-imobile-creative-width]').forEach(function(el) {
            el.style.transform = '';
            el.parentElement.style.height = '';
        });
        setTimeout(scaleAds, 300);
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
