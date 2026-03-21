// ============================================================
// MusicGacha - i18n Module
// 日本語/英語 多言語対応
// ============================================================

const translations = {
    ja: {
        // Navigation
        'nav.home': 'ホーム',
        'nav.collection': 'コレクション',
        'nav.settings': '設定',

        // Home
        'home.subtitle': '音楽ガチャで新しい曲と出会おう',
        'home.packs': 'パック',
        'home.openPack': 'パックを開ける',
        'home.noPacks': 'パックがありません',
        'home.dailyBonus': 'デイリーボーナス',
        'home.dailyBonusDesc': '3パック獲得！',
        'home.dailyBonusClaimed': '受取済み',
        'home.claim': '受け取る',
        'home.watchAd': '広告を見てパックを獲得',
        'home.collected': '曲収集済み',
        'home.regenIn': '次の回復まで {time}',
        'home.goldPackProgress': '{current}/10 ゴールドパックまで',

        // Pack Opening
        'pack.tapToOpen': 'タップして開封',
        'pack.openAnother': 'もう1パック開ける',
        'pack.viewCollection': 'コレクションを見る',
        'pack.backHome': 'ホームに戻る',
        'pack.autoOpen': '自動開封',
        'pack.autoOpenDesc': '6曲の試聴後に次のパックを自動開封',
        'pack.goldPack': '✨ ゴールドパック ✨',
        'pack.new': 'NEW',
        'pack.standard': 'オール',
        'pack.standardDesc': '全ジャンルミックス',
        'pack.recommended': 'おすすめ',
        'pack.top200Desc': '毎日更新のチャートTOP曲',
        'pack.jpop': 'J-POP',
        'pack.kpop': 'K-POP',
        'pack.vocaloid': 'ボカロ',
        'pack.anime': 'Anime',
        'pack.rock': 'Rock',
        'pack.hiphop': 'Hip-Hop',
        'pack.western': '洋楽',
        'pack.top200': 'Top 200',
        'pack.electronic': 'Electronic',
        'pack.rnb': 'R&B',
        'pack.latin': 'Latin',

        // Top 200
        'home.top200Title': '本日のiTunes Top 200',
        'home.top200Progress': '残り {remaining}/200',
        'home.top200Complete': 'コンプリート！',
        'home.top200Updated': 'チャートが更新されました',

        // Collection
        'collection.title': 'コレクション',
        'collection.rarity': 'レアリティ',
        'collection.sort': 'ソート',
        'collection.all': '全て',
        'collection.sortDate': '取得日順',
        'collection.sortFavorite': 'お気に入り順',
        'collection.sortRarity': 'レアリティ順',
        'collection.sortAtk': 'ATK順',
        'collection.sortDef': 'DEF順',
        'collection.sortArtist': 'アーティスト名順',
        'collection.searchPlaceholder': 'アーティスト検索...',
        'collection.empty': 'まだカードがありません。パックを開封して集めましょう！',
        'collection.songs': '曲',
        'collection.types': '種類',
        'collection.obtained': '取得済み',
        'collection.noChartData': 'チャートデータがありません',
        'collection.allTab': '全て',

        // Card Detail
        'card.title': '曲名',
        'card.artist': 'アーティスト',
        'card.album': 'アルバム',
        'card.year': 'リリース年',
        'card.genre': 'ジャンル',
        'card.duration': '曲長',
        'card.acquired': '取得日',
        'card.packNo': 'パック番号',
        'card.listenSpotify': 'Spotifyで聴く',
        'card.watchYoutube': 'YouTubeで観る',
        'card.count': '所持数',

        // Settings
        'settings.title': '設定',
        'settings.language': '言語',
        'settings.resetData': 'データリセット',
        'settings.reset': 'リセット',
        'settings.autoOpen': '自動パック開封',
        'settings.autoOpenDesc': '6曲の視聴後に次のパックを自動開封',
        'settings.credits': 'クレジット',
        'settings.legal': '法的情報',
        'settings.privacy': 'プライバシーポリシー',
        'settings.terms': '利用規約',

        // Dialog
        'dialog.cancel': 'キャンセル',
        'dialog.confirm': '確認',
        'dialog.resetMessage': '全てのコレクションデータを削除しますか？この操作は取り消せません。',

        // Loading
        'loading': '読み込み中...',

        // Toast
        'toast.packOpened': 'パックを開封しました！',
        'toast.dailyBonus': 'デイリーボーナス3パック獲得！',
        'toast.noPacks': 'パックがありません。回復をお待ちください。',
        'toast.dataReset': 'データをリセットしました',
        'toast.adReward': '広告報酬: 1パック獲得！',
        'toast.apiError': 'データの取得に失敗しました。後でもう一度お試しください。',
    },

    en: {
        // Navigation
        'nav.home': 'Home',
        'nav.collection': 'Collection',
        'nav.settings': 'Settings',

        // Home
        'home.subtitle': 'Discover new music through gacha!',
        'home.packs': 'Packs',
        'home.openPack': 'Open Pack',
        'home.noPacks': 'No Packs Available',
        'home.dailyBonus': 'Daily Bonus',
        'home.dailyBonusDesc': 'Get 3 packs!',
        'home.dailyBonusClaimed': 'Claimed',
        'home.claim': 'Claim',
        'home.watchAd': 'Watch ad for a pack',
        'home.collected': 'Songs Collected',
        'home.regenIn': 'Next pack in {time}',
        'home.goldPackProgress': '{current}/10 until Gold Pack',

        // Pack Opening
        'pack.tapToOpen': 'Tap to open',
        'pack.openAnother': 'Open Another Pack',
        'pack.viewCollection': 'View Collection',
        'pack.backHome': 'Back to Home',
        'pack.autoOpen': 'Auto Open',
        'pack.autoOpenDesc': 'Auto-open next pack after 6 songs',
        'pack.goldPack': '✨ Gold Pack ✨',
        'pack.new': 'NEW',
        'pack.standard': 'All',
        'pack.standardDesc': 'All genres mix',
        'pack.recommended': 'Featured',
        'pack.top200Desc': 'Daily updated chart hits',
        'pack.jpop': 'J-POP',
        'pack.kpop': 'K-POP',
        'pack.vocaloid': 'Vocaloid',
        'pack.anime': 'Anime',
        'pack.rock': 'Rock',
        'pack.hiphop': 'Hip-Hop',
        'pack.western': 'Western',
        'pack.top200': 'Top 200',
        'pack.electronic': 'Electronic',
        'pack.rnb': 'R&B',
        'pack.latin': 'Latin',

        // Top 200
        'home.top200Title': 'iTunes Top 200 Today',
        'home.top200Progress': '{remaining}/200 remaining',
        'home.top200Complete': 'Complete!',
        'home.top200Updated': 'Chart has been updated',

        // Collection
        'collection.title': 'Collection',
        'collection.rarity': 'Rarity',
        'collection.sort': 'Sort',
        'collection.all': 'All',
        'collection.sortDate': 'Date Acquired',
        'collection.sortFavorite': 'Favorites',
        'collection.sortRarity': 'Rarity',
        'collection.sortAtk': 'ATK',
        'collection.sortDef': 'DEF',
        'collection.sortArtist': 'Artist Name',
        'collection.searchPlaceholder': 'Search artists...',
        'collection.empty': 'No cards yet. Open packs to start collecting!',
        'collection.songs': 'songs',
        'collection.types': 'unique',
        'collection.obtained': 'obtained',
        'collection.noChartData': 'No chart data available',
        'collection.allTab': 'All',

        // Card Detail
        'card.title': 'Title',
        'card.artist': 'Artist',
        'card.album': 'Album',
        'card.year': 'Release Year',
        'card.genre': 'Genre',
        'card.duration': 'Duration',
        'card.acquired': 'Acquired',
        'card.packNo': 'Pack #',
        'card.listenSpotify': 'Listen on Spotify',
        'card.watchYoutube': 'Watch on YouTube',
        'card.count': 'Owned',

        // Settings
        'settings.title': 'Settings',
        'settings.language': 'Language',
        'settings.resetData': 'Reset Data',
        'settings.reset': 'Reset',
        'settings.autoOpen': 'Auto Pack Opening',
        'settings.autoOpenDesc': 'Auto-open next pack after listening to 6 songs',
        'settings.credits': 'Credits',
        'settings.legal': 'Legal',
        'settings.privacy': 'Privacy Policy',
        'settings.terms': 'Terms of Service',

        // Dialog
        'dialog.cancel': 'Cancel',
        'dialog.confirm': 'Confirm',
        'dialog.resetMessage': 'Delete all collection data? This action cannot be undone.',

        // Loading
        'loading': 'Loading...',

        // Toast
        'toast.packOpened': 'Pack opened!',
        'toast.dailyBonus': 'Daily bonus: 3 packs received!',
        'toast.noPacks': 'No packs available. Please wait for regeneration.',
        'toast.dataReset': 'Data has been reset',
        'toast.adReward': 'Ad reward: 1 pack received!',
        'toast.apiError': 'Failed to fetch data. Please try again later.',
    },
};

let currentLang = 'ja';

export function setLanguage(lang) {
    if (!translations[lang]) {
        console.warn(`[i18n] Unknown language: ${lang}`);
        return;
    }
    currentLang = lang;
    document.documentElement.lang = lang;
    applyTranslations();
}

export function getLanguage() {
    return currentLang;
}

export function t(key, params = {}) {
    let text = translations[currentLang]?.[key] || translations['ja']?.[key] || key;
    // プレースホルダー置換
    for (const [param, value] of Object.entries(params)) {
        text = text.replace(`{${param}}`, value);
    }
    return text;
}

export function applyTranslations() {
    // data-i18n属性を持つ要素のテキストを更新
    document.querySelectorAll('[data-i18n]').forEach(el => {
        const key = el.getAttribute('data-i18n');
        el.textContent = t(key);
    });

    // data-i18n-placeholder属性
    document.querySelectorAll('[data-i18n-placeholder]').forEach(el => {
        const key = el.getAttribute('data-i18n-placeholder');
        el.placeholder = t(key);
    });
}

export function initI18n(lang) {
    currentLang = lang || 'ja';
    applyTranslations();
}
