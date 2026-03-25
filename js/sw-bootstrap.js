// SW強制更新ブートストラップ
// 古いSWが残っているユーザーのために、SW更新+ページリロードを確実に行う
(function() {
    if (!('serviceWorker' in navigator)) return;

    // 新しいSWがcontrollerになったら即リロード
    var reloading = false;
    navigator.serviceWorker.addEventListener('controllerchange', function() {
        if (reloading) return;
        reloading = true;
        window.location.reload();
    });

    // 即座にSW更新チェック
    navigator.serviceWorker.getRegistration().then(function(reg) {
        if (reg) reg.update();
    });
})();
