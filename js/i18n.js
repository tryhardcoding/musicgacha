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
        'home.dailyBonusDesc': 'パック回復！',
        'home.dailyBonusClaimed': '受取済み',
        'home.claim': '受け取る',
        'home.watchAd': '広告を見てパックを獲得',
        'home.collected': '曲収集済み',
        'home.regenIn': '次の回復まで {time}',
        'home.goldPackProgress': '{current}/10 ゴールドパックまで',
        'home.choosePack': 'パックを選ぶ',
        'home.top200Challenge': 'TOP 200 チャレンジ',
        'home.top200Cta': '毎日更新のチャートを集めよう →',
        'home.achievements': '実績',
        'home.share': 'シェア',

        // Amazon PR
        'home.amazonTitle': '見つけた曲、フルで聴ける',
        'home.amazonTitleWithCount': 'あなたが見つけた{count}曲、フルで聴ける',
        'home.amazonDesc': 'Amazon Music Unlimited ── <strong>30日間無料</strong>で試す',
        'home.amazonCta': '試す →',
        'pack.amazonTitle': '気になった曲、フルで聴ける',
        'pack.amazonTitleWithCount': '{count}曲の出会い、フルで聴こう',

        // Pack Opening
        'pack.tapToOpen': '▲ タップで開ける ▲',
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
        'pack.shareResult': '結果をXでシェア',

        // Top 200
        'home.top200Title': '本日のiTunes Top 200',
        'home.top200Title.jp': '本日のiTunes Japan Top 200',
        'home.top200Title.us': '本日のiTunes US Top 200',
        'home.top200Title.uk': '本日のiTunes UK Top 200',
        'home.top200Progress': '残り {remaining}/200',
        'home.top200Complete': 'コンプリート！',
        'home.top200Updated': 'チャートが更新されました',

        // Milestones
        'milestone.debut': 'デビュー',
        'milestone.silver': 'シルバーディスク',
        'milestone.gold': 'ゴールドディスク',
        'milestone.platinum': 'プラチナディスク',
        'milestone.diamond': 'ダイヤモンドディスク',
        'milestone.nextLabel': '次',
        'milestone.songs': '曲',

        // TOP200 CTA
        'top200.complete': '全200曲コンプリート！',
        'top200.remaining': 'あと{remaining}曲で完全制覇！ →',
        'top200.almostThere': 'あと{remaining}曲！ゴールが見えてきた →',

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
        'collection.top200Obtained': '0/200 取得済み',

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
        'settings.region': 'リージョン',
        'settings.regionDesc': 'チャートとパックの国を切り替え',

        // Footer
        'footer.support': 'サーバー代で赤字運営中…応援いただけると嬉しいです',
        'footer.affiliate': '当サイトはAmazonアソシエイトプログラムに参加しています',

        // Dialog
        'dialog.cancel': 'キャンセル',
        'dialog.confirm': '確認',
        'dialog.resetMessage': 'データをリセットしますか？\nこうかいしませんね？',
        'dialog.resetStep2': '集めたカードやTOP200の進捗が\n全て消えますが、よろしいですか？',
        'dialog.resetStep3': '現在 {unique}種類（{total}枚）のカードを所持しています。\nこのデータは復元できません。続けますか？',
        'dialog.resetFinal': '🚨 これが最後の確認です。\n本当に削除しますか？',

        // Share Card/Receive
        'share.cardArrived': 'カードが届いています！',
        'share.addToCollection': 'コレクションに追加する',

        // Amazon CTA
        'amazon.listenFull': '🎧 この曲をフルで聴く',

        // Toast
        'toast.packOpened': 'パックを開封しました！',
        'toast.dailyBonus': 'デイリーボーナス：パック回復！',
        'toast.noPacks': 'パックがありません。回復をお待ちください。',
        'toast.dataReset': 'データをリセットしました',
        'toast.adReward': '広告報酬: パック回復！',
        'toast.apiError': 'データの取得に失敗しました。後でもう一度お試しください。',
        'toast.packReward': 'パック10個獲得！',
        'toast.noShareData': '共有するパック結果がありません',
        'toast.soundHint': '🔊 パック開封時に音楽が流れます。音量は右上で調整できます',

        // Ads
        'ads.showing': '広告を表示中...',
        'ads.watchToRecover': '視聴完了でパックを回復できます',
        'ads.closeAndRecover': '閉じてパックを回復する',

        // Achievements
        'ach.cat.collection': 'コレクション',
        'ach.cat.pack': 'パック開封',
        'ach.cat.rarity': 'レアリティ',
        'ach.cat.top200': 'TOP200チャレンジ',
        'ach.cat.artist': 'アーティスト',
        'ach.cat.social': 'ソーシャル',
        'ach.cat.dedication': 'やりこみ',
        'ach.unlocked': '実績解放',
        'ach.unlockedMsg': '実績解放「{name}」パック回復 +{added}',
        'ach.completeMaster': 'コンプリートマスター',
        'ach.first_card.name': 'はじめての一曲', 'ach.first_card.desc': '最初のカードを手に入れた',
        'ach.collector_10.name': 'ビギナーコレクター', 'ach.collector_10.desc': '10種類の曲を集めた',
        'ach.collector_50.name': 'シルバーコレクター', 'ach.collector_50.desc': '50種類の曲を集めた',
        'ach.collector_100.name': 'ゴールドコレクター', 'ach.collector_100.desc': '100種類の曲を集めた',
        'ach.collector_300.name': 'プラチナコレクター', 'ach.collector_300.desc': '300種類の曲を集めた',
        'ach.collector_500.name': 'ダイヤモンドコレクター', 'ach.collector_500.desc': '500種類の曲を集めた',
        'ach.collector_1000.name': 'レジェンドコレクター', 'ach.collector_1000.desc': '1000種類の曲を集めた',
        'ach.duplicate_10.name': '推し活マスター', 'ach.duplicate_10.desc': '同じ曲のカードを10枚集めた',
        'ach.pack_1.name': 'はじめてのガチャ', 'ach.pack_1.desc': '最初のパックを開けた',
        'ach.pack_10.name': 'ガチャ好き', 'ach.pack_10.desc': '10パック開封した',
        'ach.pack_50.name': 'ガチャマニア', 'ach.pack_50.desc': '50パック開封した',
        'ach.pack_100.name': 'ガチャ職人', 'ach.pack_100.desc': '100パック開封した',
        'ach.pack_500.name': 'ガチャマシーン', 'ach.pack_500.desc': '500パック開封した',
        'ach.pack_1000.name': 'ガチャの神', 'ach.pack_1000.desc': '1000パック開封した',
        'ach.rarity_r_10.name': 'レアハンター', 'ach.rarity_r_10.desc': 'Rレアリティのカードを20枚集めた',
        'ach.rarity_sr_5.name': 'スーパーレア', 'ach.rarity_sr_5.desc': 'SRレアリティのカードを20枚集めた',
        'ach.rarity_ur_3.name': 'ウルトラレア', 'ach.rarity_ur_3.desc': 'URレアリティのカードを20枚集めた',
        'ach.rarity_lr.name': 'レジェンド降臨', 'ach.rarity_lr.desc': 'LRレアリティのカードを20枚集めた',
        'ach.gold_pack.name': 'ゴールドパック', 'ach.gold_pack.desc': 'ゴールドパックに遭遇した',
        'ach.god_pack.name': 'ゴッドパック', 'ach.god_pack.desc': 'ゴッドパック（1/200）に遭遇した',
        'ach.top200_10.name': 'チャート入門', 'ach.top200_10.desc': 'TOP200の10曲を集めた',
        'ach.top200_50.name': 'シルバーディスク', 'ach.top200_50.desc': 'TOP200の50曲を集めた',
        'ach.top200_100.name': 'ゴールドディスク', 'ach.top200_100.desc': 'TOP200の100曲を集めた',
        'ach.top200_150.name': 'プラチナディスク', 'ach.top200_150.desc': 'TOP200の150曲を集めた',
        'ach.top200_200.name': 'ダイヤモンドディスク', 'ach.top200_200.desc': 'TOP200全200曲を集めた',
        'ach.top200_complete_1.name': '初日制覇', 'ach.top200_complete_1.desc': 'TOP200を1日分コンプリート',
        'ach.top200_complete_3.name': '3日連覇', 'ach.top200_complete_3.desc': 'TOP200を3日分コンプリート',
        'ach.top200_complete_7.name': '7日連覇', 'ach.top200_complete_7.desc': 'TOP200を7日分コンプリート',
        'ach.top200_complete_30.name': '月間王者', 'ach.top200_complete_30.desc': 'TOP200を30日分コンプリート',
        'ach.artist_3.name': '推しの始まり', 'ach.artist_3.desc': '同一アーティストの曲を3曲集めた',
        'ach.artist_5.name': 'ファン認定', 'ach.artist_5.desc': '同一アーティストの曲を5曲集めた',
        'ach.artist_10.name': 'ガチファン', 'ach.artist_10.desc': '同一アーティストの曲を10曲集めた',
        'ach.artist_20.name': '推しの極み', 'ach.artist_20.desc': '同一アーティストの曲を20曲集めた',
        'ach.diverse_artists_20.name': '音楽の旅人', 'ach.diverse_artists_20.desc': '100人以上のアーティストを収集',
        'ach.share_first.name': '初シェア', 'ach.share_first.desc': 'ガチャ結果をXでシェアした',
        'ach.transfer_send.name': 'カードギフター', 'ach.transfer_send.desc': 'カードを友達に送った',
        'ach.transfer_receive.name': 'カード受取人', 'ach.transfer_receive.desc': '友達からカードを受け取った',
        'ach.daily_7.name': '週間ログイン', 'ach.daily_7.desc': 'デイリーボーナスを7回受け取った',
        'ach.daily_30.name': '月間ログイン', 'ach.daily_30.desc': 'デイリーボーナスを30回受け取った',
        'ach.all_packs.name': '全パック制覇', 'ach.all_packs.desc': '全種類のパックを開封した',
        'ach.rarity_complete.name': 'レアリティフルコンプ', 'ach.rarity_complete.desc': '全レアリティ(C〜LR)を取得した',
        'ach.achievement_all.name': 'コンプリートマスター', 'ach.achievement_all.desc': '全実績を解放した',

        // Share SNS
        'share.godPack': '⚡ 神パック降臨！',
        'share.rareSong': '✨ レア曲ゲット！',
        'share.gachaResult': '🎵 ガチャ結果',
        'share.footer': '\n\n#MusicGacha #音楽ガチャ\n',
        'share.footerWithUrl': '\n\n#MusicGacha #音楽ガチャ\nmusicgacha.com',
        'share.gotOnMusicGacha': '🎵 MusicGachaでゲット！',
        'share.hashtags': '#MusicGacha #音楽ガチャ',
        'share.collectionTitle': '🎵 MusicGacha コレクション',
        'share.songsCollected': '曲収集済み！',
        'share.discoverMusic': '音楽ガチャで新しい曲と出会おう！',
        'share.top200Title': '🏆 MusicGacha TOP 200 チャレンジ',
        'share.completed': '曲コンプリート！',
        'share.allComplete': '🎉 全曲制覇達成！！！',
        'share.nextGoal': '次の目標: {next}曲',
        'share.top200Hashtags': '#MusicGacha #TOP200チャレンジ',
        'share.rareRate': 'レアカード率',

        // Loading
        'loading': '読み込み中...',
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
        'home.dailyBonusDesc': 'Recover packs!',
        'home.dailyBonusClaimed': 'Claimed',
        'home.claim': 'Claim',
        'home.watchAd': 'Watch ad for a pack',
        'home.collected': 'Songs Collected',
        'home.regenIn': 'Next pack in {time}',
        'home.goldPackProgress': '{current}/10 until Gold Pack',
        'home.choosePack': 'Choose a Pack',
        'home.top200Challenge': 'TOP 200 Challenge',
        'home.top200Cta': 'Collect daily chart hits →',
        'home.achievements': 'Achievements',
        'home.share': 'Share',

        // Amazon PR
        'home.amazonTitle': 'Listen to your discoveries in full',
        'home.amazonTitleWithCount': 'Listen to {count} songs you discovered in full',
        'home.amazonDesc': 'Amazon Music Unlimited ── <strong>30 days free</strong> trial',
        'home.amazonCta': 'Try →',
        'pack.amazonTitle': 'Love these songs? Listen in full',
        'pack.amazonTitleWithCount': '{count} new discoveries, listen in full',

        // Pack Opening
        'pack.tapToOpen': '▲ Tap to open ▲',
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
        'pack.shareResult': 'Share results on X',

        // Top 200
        'home.top200Title': 'iTunes Top 200 Today',
        'home.top200Title.jp': 'iTunes Japan Top 200 Today',
        'home.top200Title.us': 'iTunes US Top 200 Today',
        'home.top200Title.uk': 'iTunes UK Top 200 Today',
        'home.top200Progress': '{remaining}/200 remaining',
        'home.top200Complete': 'Complete!',
        'home.top200Updated': 'Chart has been updated',

        // Milestones
        'milestone.debut': 'Debut',
        'milestone.silver': 'Silver Disc',
        'milestone.gold': 'Gold Disc',
        'milestone.platinum': 'Platinum Disc',
        'milestone.diamond': 'Diamond Disc',
        'milestone.nextLabel': 'Next',
        'milestone.songs': ' songs',

        // TOP200 CTA
        'top200.complete': 'All 200 songs complete!',
        'top200.remaining': '{remaining} songs to go! →',
        'top200.almostThere': 'Only {remaining} left! Almost there →',

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
        'collection.top200Obtained': '0/200 obtained',

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
        'settings.region': 'Region',
        'settings.regionDesc': 'Switch chart and pack region',

        // Footer
        'footer.support': 'Running at a loss for server costs... Your support means a lot!',
        'footer.affiliate': 'This site participates in the Amazon Associates Program',

        // Dialog
        'dialog.cancel': 'Cancel',
        'dialog.confirm': 'Confirm',
        'dialog.resetMessage': 'Reset all data?\nYou won\'t regret this, right?',
        'dialog.resetStep2': 'All collected cards and TOP200 progress\nwill be lost. Are you sure?',
        'dialog.resetStep3': 'You own {unique} unique cards ({total} total).\nThis data cannot be recovered. Continue?',
        'dialog.resetFinal': '🚨 This is the final confirmation.\nReally delete everything?',

        // Share Card/Receive
        'share.cardArrived': 'A card has arrived!',
        'share.addToCollection': 'Add to Collection',

        // Amazon CTA
        'amazon.listenFull': '🎧 Listen to this song in full',

        // Toast
        'toast.packOpened': 'Pack opened!',
        'toast.dailyBonus': 'Daily bonus: Packs recovered!',
        'toast.noPacks': 'No packs available. Please wait for regeneration.',
        'toast.dataReset': 'Data has been reset',
        'toast.adReward': 'Ad reward: Packs recovered!',
        'toast.apiError': 'Failed to fetch data. Please try again later.',
        'toast.packReward': '10 packs received!',
        'toast.noShareData': 'No pack results to share',
        'toast.soundHint': '🔊 Music plays when opening packs. Adjust volume in the top right',

        // Ads
        'ads.showing': 'Showing ad...',
        'ads.watchToRecover': 'Watch to recover packs',
        'ads.closeAndRecover': 'Close and recover packs',

        // Achievements
        'ach.cat.collection': 'Collection',
        'ach.cat.pack': 'Pack Opening',
        'ach.cat.rarity': 'Rarity',
        'ach.cat.top200': 'TOP200 Challenge',
        'ach.cat.artist': 'Artist',
        'ach.cat.social': 'Social',
        'ach.cat.dedication': 'Dedication',
        'ach.unlocked': 'Achievements Unlocked',
        'ach.unlockedMsg': 'Achievement "{name}" unlocked! +{added} packs',
        'ach.completeMaster': 'Complete Master',
        'ach.first_card.name': 'First Song', 'ach.first_card.desc': 'Got your first card',
        'ach.collector_10.name': 'Beginner Collector', 'ach.collector_10.desc': 'Collected 10 unique songs',
        'ach.collector_50.name': 'Silver Collector', 'ach.collector_50.desc': 'Collected 50 unique songs',
        'ach.collector_100.name': 'Gold Collector', 'ach.collector_100.desc': 'Collected 100 unique songs',
        'ach.collector_300.name': 'Platinum Collector', 'ach.collector_300.desc': 'Collected 300 unique songs',
        'ach.collector_500.name': 'Diamond Collector', 'ach.collector_500.desc': 'Collected 500 unique songs',
        'ach.collector_1000.name': 'Legend Collector', 'ach.collector_1000.desc': 'Collected 1000 unique songs',
        'ach.duplicate_10.name': 'Fan Master', 'ach.duplicate_10.desc': 'Collected 10 cards of the same song',
        'ach.pack_1.name': 'First Gacha', 'ach.pack_1.desc': 'Opened your first pack',
        'ach.pack_10.name': 'Gacha Fan', 'ach.pack_10.desc': 'Opened 10 packs',
        'ach.pack_50.name': 'Gacha Maniac', 'ach.pack_50.desc': 'Opened 50 packs',
        'ach.pack_100.name': 'Gacha Artisan', 'ach.pack_100.desc': 'Opened 100 packs',
        'ach.pack_500.name': 'Gacha Machine', 'ach.pack_500.desc': 'Opened 500 packs',
        'ach.pack_1000.name': 'Gacha God', 'ach.pack_1000.desc': 'Opened 1000 packs',
        'ach.rarity_r_10.name': 'Rare Hunter', 'ach.rarity_r_10.desc': 'Collected 20 R rarity cards',
        'ach.rarity_sr_5.name': 'Super Rare', 'ach.rarity_sr_5.desc': 'Collected 20 SR rarity cards',
        'ach.rarity_ur_3.name': 'Ultra Rare', 'ach.rarity_ur_3.desc': 'Collected 20 UR rarity cards',
        'ach.rarity_lr.name': 'Legend Arrives', 'ach.rarity_lr.desc': 'Collected 20 LR rarity cards',
        'ach.gold_pack.name': 'Gold Pack', 'ach.gold_pack.desc': 'Encountered a Gold Pack',
        'ach.god_pack.name': 'God Pack', 'ach.god_pack.desc': 'Encountered a God Pack (1/200)',
        'ach.top200_10.name': 'Chart Beginner', 'ach.top200_10.desc': 'Collected 10 TOP200 songs',
        'ach.top200_50.name': 'Silver Disc', 'ach.top200_50.desc': 'Collected 50 TOP200 songs',
        'ach.top200_100.name': 'Gold Disc', 'ach.top200_100.desc': 'Collected 100 TOP200 songs',
        'ach.top200_150.name': 'Platinum Disc', 'ach.top200_150.desc': 'Collected 150 TOP200 songs',
        'ach.top200_200.name': 'Diamond Disc', 'ach.top200_200.desc': 'Collected all 200 TOP200 songs',
        'ach.top200_complete_1.name': 'First Day Champion', 'ach.top200_complete_1.desc': 'Completed 1 day of TOP200',
        'ach.top200_complete_3.name': '3-Day Streak', 'ach.top200_complete_3.desc': 'Completed 3 days of TOP200',
        'ach.top200_complete_7.name': '7-Day Streak', 'ach.top200_complete_7.desc': 'Completed 7 days of TOP200',
        'ach.top200_complete_30.name': 'Monthly Champion', 'ach.top200_complete_30.desc': 'Completed 30 days of TOP200',
        'ach.artist_3.name': 'Beginning of Fandom', 'ach.artist_3.desc': 'Collected 3 songs from same artist',
        'ach.artist_5.name': 'Certified Fan', 'ach.artist_5.desc': 'Collected 5 songs from same artist',
        'ach.artist_10.name': 'True Fan', 'ach.artist_10.desc': 'Collected 10 songs from same artist',
        'ach.artist_20.name': 'Ultimate Fan', 'ach.artist_20.desc': 'Collected 20 songs from same artist',
        'ach.diverse_artists_20.name': 'Music Traveler', 'ach.diverse_artists_20.desc': 'Collected from 100+ artists',
        'ach.share_first.name': 'First Share', 'ach.share_first.desc': 'Shared gacha results on X',
        'ach.transfer_send.name': 'Card Gifter', 'ach.transfer_send.desc': 'Sent a card to a friend',
        'ach.transfer_receive.name': 'Card Receiver', 'ach.transfer_receive.desc': 'Received a card from a friend',
        'ach.daily_7.name': 'Weekly Login', 'ach.daily_7.desc': 'Claimed daily bonus 7 times',
        'ach.daily_30.name': 'Monthly Login', 'ach.daily_30.desc': 'Claimed daily bonus 30 times',
        'ach.all_packs.name': 'All Packs Opened', 'ach.all_packs.desc': 'Opened all pack types',
        'ach.rarity_complete.name': 'Rarity Complete', 'ach.rarity_complete.desc': 'Obtained all rarities (C to LR)',
        'ach.achievement_all.name': 'Complete Master', 'ach.achievement_all.desc': 'Unlocked all achievements',

        // Share SNS
        'share.godPack': '⚡ God Pack!',
        'share.rareSong': '✨ Rare Song!',
        'share.gachaResult': '🎵 Gacha Results',
        'share.footer': '\n\n#MusicGacha\n',
        'share.footerWithUrl': '\n\n#MusicGacha\nmusicgacha.com',
        'share.gotOnMusicGacha': '🎵 Got on MusicGacha!',
        'share.hashtags': '#MusicGacha',
        'share.collectionTitle': '🎵 MusicGacha Collection',
        'share.songsCollected': 'songs collected!',
        'share.discoverMusic': 'Discover new music through gacha!',
        'share.top200Title': '🏆 MusicGacha TOP 200 Challenge',
        'share.completed': 'songs complete!',
        'share.allComplete': '🎉 All songs collected!!!',
        'share.nextGoal': 'Next goal: {next} songs',
        'share.top200Hashtags': '#MusicGacha #TOP200Challenge',
        'share.rareRate': 'Rare card rate',

        // Loading
        'loading': 'Loading...',
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
        const text = t(key);
        if (text.includes('<')) {
            el.innerHTML = text;
        } else {
            el.textContent = text;
        }
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
