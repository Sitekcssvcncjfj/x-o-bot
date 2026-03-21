const { Telegraf, Markup } = require('telegraf');
const fs = require('fs');
const path = require('path');

const BOT_TOKEN = "8722669683:AAHTNuh4soLWzGZmiywLzu9UwjRMsJZPgzQ";
const TURN_MS = 30000;

const bot = new Telegraf(BOT_TOKEN);

// ================= DB =================
const DATA_DIR = process.env.DATA_DIR || path.join(__dirname, 'data');
const DATA_FILE = path.join(DATA_DIR, 'db.json');
if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true });
if (!fs.existsSync(DATA_FILE)) {
  fs.writeFileSync(DATA_FILE, JSON.stringify({ users: {} }, null, 2));
}
const loadDB = () => {
  try { return JSON.parse(fs.readFileSync(DATA_FILE, 'utf8')); }
  catch { return { users: {} }; }
};
const saveDB = (db) => fs.writeFileSync(DATA_FILE, JSON.stringify(db, null, 2));

function ensureUser(user) {
  const db = loadDB();
  const id = String(user.id);
  if (!db.users[id]) {
    db.users[id] = {
      id: user.id,
      name: user.first_name || user.username || 'User',
      username: user.username || '',
      language: 'tr',
      theme: 'classic',
      wins: 0, losses: 0, draws: 0,
      multiplayerWins: 0, multiplayerLosses: 0, multiplayerDraws: 0
    };
  } else {
    db.users[id].name = user.first_name || user.username || db.users[id].name;
    db.users[id].username = user.username || db.users[id].username;
  }
  saveDB(db);
  return db.users[id];
}
const getUser = (id) => loadDB().users[String(id)];
function patchUser(userId, patch) {
  const db = loadDB();
  const id = String(userId);
  if (!db.users[id]) return;
  Object.assign(db.users[id], patch);
  saveDB(db);
}
function addSingleResult(userId, r) {
  const u = getUser(userId); if (!u) return;
  if (r === 'win') patchUser(userId, { wins: u.wins + 1 });
  if (r === 'loss') patchUser(userId, { losses: u.losses + 1 });
  if (r === 'draw') patchUser(userId, { draws: u.draws + 1 });
}
function addMultiResult(userId, r) {
  const u = getUser(userId); if (!u) return;
  if (r === 'win') patchUser(userId, { multiplayerWins: u.multiplayerWins + 1 });
  if (r === 'loss') patchUser(userId, { multiplayerLosses: u.multiplayerLosses + 1 });
  if (r === 'draw') patchUser(userId, { multiplayerDraws: u.multiplayerDraws + 1 });
}
function leaderboard() {
  return Object.values(loadDB().users).map(u => {
    const totalWins = u.wins + u.multiplayerWins;
    const totalLosses = u.losses + u.multiplayerLosses;
    const totalDraws = u.draws + u.multiplayerDraws;
    const games = totalWins + totalLosses + totalDraws;
    const points = totalWins * 3 + totalDraws;
    const winrate = games ? ((totalWins / games) * 100).toFixed(1) : '0.0';
    let rank = 'Bronze';
    if (points >= 100) rank = 'Diamond';
    else if (points >= 60) rank = 'Gold';
    else if (points >= 30) rank = 'Silver';
    return { ...u, totalWins, totalLosses, totalDraws, games, points, winrate, rank };
  }).sort((a, b) => b.points - a.points);
}

// ================= LANG =================
const L = {
  tr: {
    hi: 'Merhaba',
    start: `🎮 *XO Arena*'ya hoş geldin!

Aşağıdaki menüden bir seçenek seç.`,
    menuNew: '🎮 Yeni Oyun',
    menuGroup: '👥 Grup Oyunu',
    menuStats: '📊 İstatistik',
    menuTop: '🏆 Liderlik',
    menuLang: '🌐 Dil',
    menuProfile: '👤 Profil',
    chooseDifficulty: '🎚️ Zorluk seç:',
    chooseTheme: '🎨 Tema seç:',
    gameStarted: '✨ Oyun başladı! Sen ilk oyuncusun.',
    yourTurn: '👉 Sıra sende.',
    noActiveGame: 'Aktif oyun yok.',
    cellBusy: 'Bu hücre dolu.',
    youWin: '🎉 Tebrikler, kazandın!',
    botWin: '🤖 Bot kazandı!',
    draw: '🤝 Oyun berabere bitti!',
    newGame: '🔄 Yeni Oyun',
    easy: '🟢 Kolay',
    medium: '🟡 Orta',
    hard: '🔴 Zor',
    onlyGroups: 'Bu komut sadece gruplarda çalışır.',
    gameExists: 'Bu grupta zaten aktif ya da bekleyen bir oyun var.',
    createdGroup: (name) => `👥 ${name} bir grup oyunu oluşturdu.\nKatılmak için aşağıdaki butona bas.`,
    join: '✅ Katıl',
    invite: '📨 Arkadaşını Davet Et',
    joined: (x,o,turn) => `🎮 *2 Oyunculu XO*\n\n❌ X: ${x}\n⭕ O: ${o}\n\n👉 İlk sıra: ${turn}`,
    notYourTurn: 'Sıra sende değil.',
    notYourGame: 'Bu oyunun oyuncusu değilsin.',
    turnText: (name, symbol, sec) => `⏳ Sıra: ${name} (${symbol})\n🕒 Kalan süre: ${sec} sn`,
    xWin: (name) => `🏆 ${name} kazandı! (X)`,
    oWin: (name) => `🏆 ${name} kazandı! (O)`,
    timeoutSkip: (name) => `⏰ ${name} süreyi kaçırdı. Sıra diğer oyuncuya geçti.`,
    timeoutEnd: '⏰ Kimse zamanında oynamadı. Oyun iptal edildi.',
    canceled: '🛑 Oyun iptal edildi.',
    stats: (u) => `📊 *İstatistiklerin*\n\n🤖 Botla:\n🏆 ${u.wins}  ❌ ${u.losses}  🤝 ${u.draws}\n\n👥 Çok Oyunculu:\n🏆 ${u.multiplayerWins}  ❌ ${u.multiplayerLosses}  🤝 ${u.multiplayerDraws}`,
    topTitle: '🏆 *Liderlik Tablosu*',
    emptyTop: 'Henüz veri yok.',
    chooseLang: '🌐 Dil seç:',
    langTr: 'Dil Türkçe yapıldı.',
    langEn: 'Language set to English.',
    langAz: 'Dil Azərbaycan dili olaraq təyin edildi.',
    profile: (name, rank, wr, pts) => `👤 *Profil Kartı*\n\nİsim: ${name}\nRütbe: ${rank}\nWinrate: %${wr}\nPuan: ${pts}`,
    cancelHint: 'Aktif oyunu iptal etmek için /cancelgame',
    themeClassic: '❌ ⭕',
    themeFruit: '🍎 🍌',
    themeFire: '🔥 💧',
    chooseMode: 'Aşağıdan bir mod seç:',
    tournamentCreated: '🏟️ Turnuva oluşturuldu. Katılım yakında...',
    mentionInvite: (u) => `📨 Davet: ${u}`,
    rematch: '🤝 Rövanş',
    selectPlayer: 'Önce bir oyuncuya yanıt vererek /invite yaz veya grup oyunu aç.',
    singleInfo: 'Tekli oyun için tema ve zorluk seç.',
    groupInfo: 'Grup oyunu açıp arkadaşınla oyna.'
  },
  en: {
    hi: 'Hello',
    start: `🎮 *XO Arena* welcomes you!

Choose an option from the menu below.`,
    menuNew: '🎮 New Game',
    menuGroup: '👥 Group Game',
    menuStats: '📊 Stats',
    menuTop: '🏆 Leaderboard',
    menuLang: '🌐 Language',
    menuProfile: '👤 Profile',
    chooseDifficulty: '🎚️ Choose difficulty:',
    chooseTheme: '🎨 Choose theme:',
    gameStarted: '✨ Game started! You play first.',
    yourTurn: '👉 Your turn.',
    noActiveGame: 'No active game.',
    cellBusy: 'This cell is occupied.',
    youWin: '🎉 Congratulations, you won!',
    botWin: '🤖 Bot won!',
    draw: '🤝 Draw!',
    newGame: '🔄 New Game',
    easy: '🟢 Easy',
    medium: '🟡 Medium',
    hard: '🔴 Hard',
    onlyGroups: 'This command works only in groups.',
    gameExists: 'There is already an active or pending game in this group.',
    createdGroup: (name) => `👥 ${name} created a group game.\nTap below to join.`,
    join: '✅ Join',
    invite: '📨 Invite Friend',
    joined: (x,o,turn) => `🎮 *2 Player XO*\n\n❌ X: ${x}\n⭕ O: ${o}\n\n👉 First turn: ${turn}`,
    notYourTurn: 'It is not your turn.',
    notYourGame: 'You are not a player in this game.',
    turnText: (name, symbol, sec) => `⏳ Turn: ${name} (${symbol})\n🕒 Time left: ${sec}s`,
    xWin: (name) => `🏆 ${name} won! (X)`,
    oWin: (name) => `🏆 ${name} won! (O)`,
    timeoutSkip: (name) => `⏰ ${name} missed the time. Turn passed to the other player.`,
    timeoutEnd: '⏰ Nobody played in time. Game canceled.',
    canceled: '🛑 Game canceled.',
    stats: (u) => `📊 *Your Stats*\n\n🤖 Vs Bot:\n🏆 ${u.wins}  ❌ ${u.losses}  🤝 ${u.draws}\n\n👥 Multiplayer:\n🏆 ${u.multiplayerWins}  ❌ ${u.multiplayerLosses}  🤝 ${u.multiplayerDraws}`,
    topTitle: '🏆 *Leaderboard*',
    emptyTop: 'No data yet.',
    chooseLang: '🌐 Choose language:',
    langTr: 'Dil Türkçe yapıldı.',
    langEn: 'Language set to English.',
    langAz: 'Dil Azərbaycan dili olaraq təyin edildi.',
    profile: (name, rank, wr, pts) => `👤 *Profile Card*\n\nName: ${name}\nRank: ${rank}\nWinrate: %${wr}\nPoints: ${pts}`,
    cancelHint: 'Use /cancelgame to cancel the active game',
    themeClassic: '❌ ⭕',
    themeFruit: '🍎 🍌',
    themeFire: '🔥 💧',
    chooseMode: 'Choose a mode below:',
    tournamentCreated: '🏟️ Tournament created. Join flow can be extended later.',
    mentionInvite: (u) => `📨 Invite: ${u}`,
    rematch: '🤝 Rematch',
    selectPlayer: 'Reply to a user with /invite or create a group game first.',
    singleInfo: 'Choose theme and difficulty for single player.',
    groupInfo: 'Create a group game and play with your friend.'
  },
  az: {
    hi: 'Salam',
    start: `🎮 *XO Arena*'ya xoş gəldin!

Aşağıdakı menyudan seçim et.`,
    menuNew: '🎮 Yeni Oyun',
    menuGroup: '👥 Qrup Oyunu',
    menuStats: '📊 Statistika',
    menuTop: '🏆 Liderlik',
    menuLang: '🌐 Dil',
    menuProfile: '👤 Profil',
    chooseDifficulty: '🎚️ Çətinlik seç:',
    chooseTheme: '🎨 Tema seç:',
    gameStarted: '✨ Oyun başladı! İlk sən oynayırsan.',
    yourTurn: '👉 Növbə səndədir.',
    noActiveGame: 'Aktiv oyun yoxdur.',
    cellBusy: 'Bu xana doludur.',
    youWin: '🎉 Təbriklər, qazandın!',
    botWin: '🤖 Bot qazandı!',
    draw: '🤝 Heç-heçə!',
    newGame: '🔄 Yeni Oyun',
    easy: '🟢 Asan',
    medium: '🟡 Orta',
    hard: '🔴 Çətin',
    onlyGroups: 'Bu komanda yalnız qruplarda işləyir.',
    gameExists: 'Bu qrupda artıq aktiv və ya gözləyən oyun var.',
    createdGroup: (name) => `👥 ${name} qrup oyunu yaratdı.\nQoşulmaq üçün aşağıdakı düyməyə bas.`,
    join: '✅ Qoşul',
    invite: '📨 Dostunu Dəvət Et',
    joined: (x,o,turn) => `🎮 *2 Nəfərlik XO*\n\n❌ X: ${x}\n⭕ O: ${o}\n\n👉 İlk növbə: ${turn}`,
    notYourTurn: 'Növbə səndə deyil.',
    notYourGame: 'Bu oyunun iştirakçısı deyilsən.',
    turnText: (name, symbol, sec) => `⏳ Növbə: ${name} (${symbol})\n🕒 Qalan vaxt: ${sec} san`,
    xWin: (name) => `🏆 ${name} qazandı! (X)`,
    oWin: (name) => `🏆 ${name} qazandı! (O)`,
    timeoutSkip: (name) => `⏰ ${name} vaxtı qaçırdı. Növbə digər oyunçuya keçdi.`,
    timeoutEnd: '⏰ Heç kim vaxtında oynamadı. Oyun ləğv edildi.',
    canceled: '🛑 Oyun ləğv edildi.',
    stats: (u) => `📊 *Statistikan*\n\n🤖 Botla:\n🏆 ${u.wins}  ❌ ${u.losses}  🤝 ${u.draws}\n\n👥 Çox oyunçulu:\n🏆 ${u.multiplayerWins}  ❌ ${u.multiplayerLosses}  🤝 ${u.multiplayerDraws}`,
    topTitle: '🏆 *Liderlik Cədvəli*',
    emptyTop: 'Hələ məlumat yoxdur.',
    chooseLang: '🌐 Dil seç:',
    langTr: 'Dil Türkçe yapıldı.',
    langEn: 'Language set to English.',
    langAz: 'Dil Azərbaycan dili olaraq təyin edildi.',
    profile: (name, rank, wr, pts) => `👤 *Profil Kartı*\n\nAd: ${name}\nRütbə: ${rank}\nQazanma faizi: %${wr}\nXal: ${pts}`,
    cancelHint: 'Aktiv oyunu ləğv etmək üçün /cancelgame',
    themeClassic: '❌ ⭕',
    themeFruit: '🍎 🍌',
    themeFire: '🔥 💧',
    chooseMode: 'Aşağıdan bir rejim seç:',
    tournamentCreated: '🏟️ Turnir yaradıldı. Qoşulma axını sonra genişləndirilə bilər.',
    mentionInvite: (u) => `📨 Dəvət: ${u}`,
    rematch: '🤝 Revans',
    selectPlayer: 'Bir istifadəçiyə reply edib /invite yaz və ya qrup oyunu yarat.',
    singleInfo: 'Tək oyun üçün tema və çətinlik seç.',
    groupInfo: 'Qrup oyunu yaradıb dostunla oyna.'
  }
};

function langOf(userId) {
  return getUser(userId)?.language || 'tr';
}
function t(userId, key, ...args) {
  const value = L[langOf(userId)][key];
  return typeof value === 'function' ? value(...args) : value;
}

// ================= STATE =================
const singleGames = new Map(); // userId => { board,difficulty,theme,gameOver }
const groupGames = new Map();  // chatId => { board, playerX, playerO, turn, gameOver, timer, misses, theme }
const pendingSingle = new Map(); // userId => { theme? }
const tournaments = new Map(); // simple placeholder

const THEMES = {
  classic: { X: '❌', O: '⭕' },
  fruit: { X: '🍎', O: '🍌' },
  fire: { X: '🔥', O: '💧' }
};

// ================= HELPERS =================
function nameOf(u) {
  return u.username ? `@${u.username}` : u.first_name || 'User';
}
function symbolOf(raw, theme) {
  if (!raw) return ' ';
  return THEMES[theme || 'classic'][raw];
}
function checkWinner(board) {
  const wins = [[0,1,2],[3,4,5],[6,7,8],[0,3,6],[1,4,7],[2,5,8],[0,4,8],[2,4,6]];
  for (const [a,b,c] of wins) {
    if (board[a] && board[a] === board[b] && board[a] === board[c]) return board[a];
  }
  return board.every(Boolean) ? 'draw' : null;
}
function currentPlayer(game) {
  return game.turn === 'X' ? game.playerX : game.playerO;
}
function currentPlayerId(game) {
  return currentPlayer(game).id;
}
function calcProfile(userId) {
  const u = getUser(userId);
  if (!u) return null;
  const totalWins = u.wins + u.multiplayerWins;
  const totalLosses = u.losses + u.multiplayerLosses;
  const totalDraws = u.draws + u.multiplayerDraws;
  const games = totalWins + totalLosses + totalDraws;
  const points = totalWins * 3 + totalDraws;
  const winrate = games ? ((totalWins / games) * 100).toFixed(1) : '0.0';
  let rank = 'Bronze';
  if (points >= 100) rank = 'Diamond';
  else if (points >= 60) rank = 'Gold';
  else if (points >= 30) rank = 'Silver';
  return { rank, winrate, points };
}

// ================= AI =================
function aiEasy(board) {
  const e = board.map((v, i) => v === '' ? i : null).filter(v => v !== null);
  return e[Math.floor(Math.random() * e.length)];
}
function aiMedium(board) {
  for (let i = 0; i < 9; i++) if (board[i] === '') {
    const b = [...board]; b[i] = 'O'; if (checkWinner(b) === 'O') return i;
  }
  for (let i = 0; i < 9; i++) if (board[i] === '') {
    const b = [...board]; b[i] = 'X'; if (checkWinner(b) === 'X') return i;
  }
  if (board[4] === '') return 4;
  const corners = [0,2,6,8].filter(i => board[i] === '');
  if (corners.length) return corners[Math.floor(Math.random() * corners.length)];
  return aiEasy(board);
}
function aiHard(board) {
  function minimax(b, depth, max) {
    const r = checkWinner(b);
    if (r === 'O') return 10 - depth;
    if (r === 'X') return depth - 10;
    if (r === 'draw') return 0;
    if (max) {
      let best = -999;
      for (let i = 0; i < 9; i++) if (b[i] === '') {
        b[i] = 'O';
        best = Math.max(best, minimax(b, depth + 1, false));
        b[i] = '';
      }
      return best;
    } else {
      let best = 999;
      for (let i = 0; i < 9; i++) if (b[i] === '') {
        b[i] = 'X';
        best = Math.min(best, minimax(b, depth + 1, true));
        b[i] = '';
      }
      return best;
    }
  }
  let best = -999, move = -1;
  for (let i = 0; i < 9; i++) if (board[i] === '') {
    board[i] = 'O';
    const s = minimax(board, 0, false);
    board[i] = '';
    if (s > best) { best = s; move = i; }
  }
  return move;
}
const AI = { easy: aiEasy, medium: aiMedium, hard: aiHard };

// ================= KEYBOARDS =================
function mainMenu(userId) {
  return Markup.inlineKeyboard([
    [
      Markup.button.callback(t(userId, 'menuNew'), 'menu_new'),
      Markup.button.callback(t(userId, 'menuGroup'), 'menu_group')
    ],
    [
      Markup.button.callback(t(userId, 'menuStats'), 'menu_stats'),
      Markup.button.callback(t(userId, 'menuTop'), 'menu_top')
    ],
    [
      Markup.button.callback(t(userId, 'menuProfile'), 'menu_profile'),
      Markup.button.callback(t(userId, 'menuLang'), 'menu_lang')
    ]
  ]);
}
function langKeyboard() {
  return Markup.inlineKeyboard([
    [
      Markup.button.callback('🇹🇷 Türkçe', 'lang_tr'),
      Markup.button.callback('🇬🇧 English', 'lang_en'),
      Markup.button.callback('🇦🇿 Azərbaycan', 'lang_az')
    ]
  ]);
}
function themeKeyboard(userId, prefix='theme') {
  return Markup.inlineKeyboard([
    [Markup.button.callback(`${t(userId,'themeClassic')}`, `${prefix}_classic`)],
    [Markup.button.callback(`${t(userId,'themeFruit')}`, `${prefix}_fruit`)],
    [Markup.button.callback(`${t(userId,'themeFire')}`, `${prefix}_fire`)]
  ]);
}
function difficultyKeyboard(userId) {
  return Markup.inlineKeyboard([
    [
      Markup.button.callback(t(userId,'easy'), 'diff_easy'),
      Markup.button.callback(t(userId,'medium'), 'diff_medium'),
      Markup.button.callback(t(userId,'hard'), 'diff_hard')
    ]
  ]);
}
function groupJoinKeyboard(userId) {
  return Markup.inlineKeyboard([
    [Markup.button.callback(t(userId,'join'), 'group_join')],
    [Markup.button.callback(t(userId,'invite'), 'group_invite')]
  ]);
}
function boardKeyboard(board, prefix, theme, gameOver = false, extra = []) {
  const rows = [];
  for (let r = 0; r < 3; r++) {
    const row = [];
    for (let c = 0; c < 3; c++) {
      const i = r * 3 + c;
      row.push(Markup.button.callback(symbolOf(board[i], theme), gameOver ? 'ignore' : `${prefix}_${i}`));
    }
    rows.push(row);
  }
  extra.forEach(r => rows.push(r));
  return Markup.inlineKeyboard(rows);
}

// ================= TIMER =================
function clearGameTimer(game) {
  if (game?.timer) clearTimeout(game.timer);
  game.timer = null;
}
async function scheduleTurnTimeout(ctxLike, chatId) {
  const game = groupGames.get(chatId);
  if (!game || game.gameOver || game.type !== 'active') return;

  clearGameTimer(game);
  game.timer = setTimeout(async () => {
    const g = groupGames.get(chatId);
    if (!g || g.gameOver || g.type !== 'active') return;

    const missed = currentPlayer(g);
    g.misses = (g.misses || 0) + 1;

    if (g.misses >= 2) {
      g.gameOver = true;
      try {
        await bot.telegram.editMessageText(
          chatId,
          g.messageId,
          undefined,
          t(g.playerX.id, 'timeoutEnd'),
          { reply_markup: boardKeyboard(g.board, 'groupmove', g.theme, true).reply_markup, parse_mode: 'Markdown' }
        );
      } catch {}
      groupGames.delete(chatId);
      return;
    }

    g.turn = g.turn === 'X' ? 'O' : 'X';
    try {
      await bot.telegram.editMessageText(
        chatId,
        g.messageId,
        undefined,
        `${t(g.playerX.id, 'timeoutSkip', nameOf(missed))}\n\n${t(g.playerX.id, 'turnText', nameOf(currentPlayer(g)), g.turn, 30)}`,
        { reply_markup: boardKeyboard(g.board, 'groupmove', g.theme).reply_markup, parse_mode: 'Markdown' }
      );
    } catch {}
    scheduleTurnTimeout(null, chatId);
  }, TURN_MS);
}

// ================= COMMANDS =================
bot.start(async (ctx) => {
  ensureUser(ctx.from);
  await ctx.replyWithMarkdown(t(ctx.from.id, 'start'), mainMenu(ctx.from.id));
});

bot.command('stats', async (ctx) => {
  ensureUser(ctx.from);
  await ctx.replyWithMarkdown(t(ctx.from.id, 'stats', getUser(ctx.from.id)));
});

bot.command('top', async (ctx) => {
  ensureUser(ctx.from);
  const list = leaderboard().slice(0, 10);
  if (!list.length) return ctx.reply(t(ctx.from.id, 'emptyTop'));
  let text = `${t(ctx.from.id, 'topTitle')}\n\n`;
  list.forEach((u, i) => {
    const nm = u.username ? `@${u.username}` : u.name;
    text += `${i+1}. ${nm} — ${u.points} pts\n`;
    text += `   🏆 ${u.totalWins} | ❌ ${u.totalLosses} | 🤝 ${u.totalDraws} | ${u.rank}\n`;
  });
  await ctx.replyWithMarkdown(text);
});

bot.command('profile', async (ctx) => {
  ensureUser(ctx.from);
  const p = calcProfile(ctx.from.id);
  await ctx.replyWithMarkdown(t(ctx.from.id, 'profile', nameOf(ctx.from), p.rank, p.winrate, p.points));
});

bot.command('language', async (ctx) => {
  ensureUser(ctx.from);
  await ctx.reply(t(ctx.from.id, 'chooseLang'), langKeyboard());
});

bot.command('newgame', async (ctx) => {
  ensureUser(ctx.from);
  pendingSingle.set(ctx.from.id, {});
  await ctx.replyWithMarkdown(`*${t(ctx.from.id, 'singleInfo')}*\n\n${t(ctx.from.id, 'chooseTheme')}`, themeKeyboard(ctx.from.id, 'singletheme'));
});

bot.command('groupgame', async (ctx) => {
  ensureUser(ctx.from);
  if (!['group', 'supergroup'].includes(ctx.chat.type)) return ctx.reply(t(ctx.from.id, 'onlyGroups'));
  if (groupGames.has(ctx.chat.id)) return ctx.reply(t(ctx.from.id, 'gameExists'));

  const sent = await ctx.replyWithMarkdown(
    t(ctx.from.id, 'createdGroup', nameOf(ctx.from)),
    groupJoinKeyboard(ctx.from.id)
  );

  groupGames.set(ctx.chat.id, {
    type: 'pending',
    chatId: ctx.chat.id,
    board: Array(9).fill(''),
    playerX: ctx.from,
    playerO: null,
    turn: 'X',
    gameOver: false,
    misses: 0,
    timer: null,
    messageId: sent.message_id,
    theme: getUser(ctx.from.id)?.theme || 'classic'
  });
});

bot.command('invite', async (ctx) => {
  ensureUser(ctx.from);
  if (!['group','supergroup'].includes(ctx.chat.type)) return ctx.reply(t(ctx.from.id, 'onlyGroups'));
  if (!ctx.message.reply_to_message?.from) return ctx.reply(t(ctx.from.id, 'selectPlayer'));
  const target = ctx.message.reply_to_message.from;
  await ctx.reply(t(ctx.from.id, 'mentionInvite', `[${target.first_name}](tg://user?id=${target.id})`), { parse_mode: 'Markdown' });
});

bot.command('tournament', async (ctx) => {
  ensureUser(ctx.from);
  if (!['group','supergroup'].includes(ctx.chat.type)) return ctx.reply(t(ctx.from.id, 'onlyGroups'));
  tournaments.set(ctx.chat.id, { host: ctx.from.id, players: [ctx.from.id], createdAt: Date.now() });
  await ctx.reply(t(ctx.from.id, 'tournamentCreated'));
});

bot.command('cancelgame', async (ctx) => {
  ensureUser(ctx.from);

  if (singleGames.has(ctx.from.id)) {
    singleGames.delete(ctx.from.id);
    return ctx.reply(t(ctx.from.id, 'canceled'));
  }

  if (['group','supergroup'].includes(ctx.chat.type) && groupGames.has(ctx.chat.id)) {
    const g = groupGames.get(ctx.chat.id);
    const allowed = [g.playerX?.id, g.playerO?.id].includes(ctx.from.id);
    if (!allowed) return ctx.reply(t(ctx.from.id, 'notYourGame'));
    clearGameTimer(g);
    groupGames.delete(ctx.chat.id);
    return ctx.reply(t(ctx.from.id, 'canceled'));
  }

  return ctx.reply(t(ctx.from.id, 'noActiveGame'));
});

// ================= MENU ACTIONS =================
bot.action('menu_new', async (ctx) => {
  ensureUser(ctx.from);
  pendingSingle.set(ctx.from.id, {});
  await ctx.editMessageText(`*${t(ctx.from.id, 'singleInfo')}*\n\n${t(ctx.from.id, 'chooseTheme')}`, {
    parse_mode: 'Markdown',
    reply_markup: themeKeyboard(ctx.from.id, 'singletheme').reply_markup
  });
  await ctx.answerCbQuery();
});

bot.action('menu_group', async (ctx) => {
  ensureUser(ctx.from);
  await ctx.answerCbQuery();
  await ctx.replyWithMarkdown(`*${t(ctx.from.id, 'groupInfo')}*\n\n/groupgame\n\n${t(ctx.from.id, 'cancelHint')}`);
});

bot.action('menu_stats', async (ctx) => {
  ensureUser(ctx.from);
  await ctx.editMessageText(t(ctx.from.id, 'stats', getUser(ctx.from.id)), { parse_mode: 'Markdown', reply_markup: mainMenu(ctx.from.id).reply_markup });
  await ctx.answerCbQuery();
});

bot.action('menu_top', async (ctx) => {
  ensureUser(ctx.from);
  const list = leaderboard().slice(0, 10);
  let text = t(ctx.from.id, 'emptyTop');
  if (list.length) {
    text = `${t(ctx.from.id, 'topTitle')}\n\n`;
    list.forEach((u, i) => 
