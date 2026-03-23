const { Telegraf, Markup } = require('telegraf');
const fs = require('fs');
const path = require('path');

const BOT_TOKEN = process.env.BOT_TOKEN;
if (!BOT_TOKEN) {
  throw new Error('BOT_TOKEN tapılmadı. Railway Variables bölməsinə əlavə et.');
}

const DATA_DIR = process.env.DATA_DIR || path.join(__dirname, 'data');
const DATA_FILE = path.join(DATA_DIR, 'db.json');

const BOT_USERNAME = 'KGBXOBOT';
const SUPPORT_LINK = 'https://t.me/KGBotomasyon';
const ADD_GROUP_LINK = `https://t.me/${BOT_USERNAME}?startgroup=true`;

const bot = new Telegraf(BOT_TOKEN);
const processingLocks = new Set();

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function safeAnswerCbQuery(ctx, text) {
  try {
    await ctx.answerCbQuery(text).catch(() => {});
  } catch (_) {}
}

async function safeEditMessageText(ctx, text, extra, retry = 0) {
  try {
    return await ctx.editMessageText(text, extra);
  } catch (err) {
    const desc = err?.response?.description || err?.description || '';

    if (desc.includes('message is not modified')) {
      return;
    }

    if (err?.response?.error_code === 429 && retry < 4) {
      const waitSec = err?.response?.parameters?.retry_after || 2;
      await sleep((waitSec + 1) * 1000);
      return safeEditMessageText(ctx, text, extra, retry + 1);
    }

    throw err;
  }
}

function getLockKey(ctx, type = 'default') {
  return `${type}:${ctx.chat?.id || 'nochat'}:${ctx.from?.id || 'nouser'}`;
}

async function withLock(ctx, handler, type = 'default') {
  const key = getLockKey(ctx, type);

  if (processingLocks.has(key)) {
    await safeAnswerCbQuery(ctx, 'İşlem devam ediyor...');
    return;
  }

  processingLocks.add(key);

  try {
    await handler();
  } finally {
    processingLocks.delete(key);
  }
}

// ==============================
// DB FAST CACHE
// ==============================

if (!fs.existsSync(DATA_DIR)) {
  fs.mkdirSync(DATA_DIR, { recursive: true });
}
if (!fs.existsSync(DATA_FILE)) {
  fs.writeFileSync(DATA_FILE, JSON.stringify({ users: {} }, null, 2));
}

let dbCache = { users: {} };
let dbDirty = false;

function loadDBFromDisk() {
  try {
    dbCache = JSON.parse(fs.readFileSync(DATA_FILE, 'utf8'));
  } catch {
    dbCache = { users: {} };
  }
}

function saveDBToDisk() {
  try {
    fs.writeFileSync(DATA_FILE, JSON.stringify(dbCache, null, 2));
    dbDirty = false;
  } catch (e) {
    console.error('DB save error:', e);
  }
}

loadDBFromDisk();
console.log('DB cache loaded. Users:', Object.keys(dbCache.users || {}).length);

setInterval(() => {
  if (dbDirty) {
    saveDBToDisk();
  }
}, 10000);

function ensureUser(user) {
  const id = String(user.id);

  if (!dbCache.users[id]) {
    dbCache.users[id] = {
      id: user.id,
      name: user.first_name || user.username || 'User',
      username: user.username || '',
      language: 'tr',
      wins: 0,
      losses: 0,
      draws: 0,
      multiplayerWins: 0,
      multiplayerLosses: 0,
      multiplayerDraws: 0
    };
    dbDirty = true;
  } else {
    const oldName = dbCache.users[id].name;
    const oldUsername = dbCache.users[id].username;

    dbCache.users[id].name = user.first_name || user.username || dbCache.users[id].name;
    dbCache.users[id].username = user.username || dbCache.users[id].username;

    if (oldName !== dbCache.users[id].name || oldUsername !== dbCache.users[id].username) {
      dbDirty = true;
    }
  }

  return dbCache.users[id];
}

function getUser(userId) {
  return dbCache.users[String(userId)];
}

function setLanguage(userId, lang) {
  const id = String(userId);
  if (!dbCache.users[id]) return;
  dbCache.users[id].language = lang;
  dbDirty = true;
}

function addSingleResult(userId, result) {
  const id = String(userId);
  if (!dbCache.users[id]) return;

  if (result === 'win') dbCache.users[id].wins++;
  if (result === 'loss') dbCache.users[id].losses++;
  if (result === 'draw') dbCache.users[id].draws++;

  dbDirty = true;
}

function addMultiResult(userId, result) {
  const id = String(userId);
  if (!dbCache.users[id]) return;

  if (result === 'win') dbCache.users[id].multiplayerWins++;
  if (result === 'loss') dbCache.users[id].multiplayerLosses++;
  if (result === 'draw') dbCache.users[id].multiplayerDraws++;

  dbDirty = true;
}

function getLeaderboard() {
  return Object.values(dbCache.users)
    .map((u) => ({
      ...u,
      totalWins: u.wins + u.multiplayerWins,
      totalLosses: u.losses + u.multiplayerLosses,
      totalDraws: u.draws + u.multiplayerDraws,
      points: (u.wins + u.multiplayerWins) * 3 + (u.draws + u.multiplayerDraws)
    }))
    .sort((a, b) => b.points - a.points);
}

// ==============================
// TEXTS
// ==============================

const texts = {
  tr: {
    welcome:
`🎮 XO Oyun Botuna hoş geldin!

Aşağıdaki menüden seçim yapabilirsin.`,
    menuNewGame: '🎯 Yeni Oyun',
    menuGroupGame: '👥 Grup Oyunu',
    menuStats: '📊 İstatistik',
    menuTop: '🏆 Liderlik',
    menuLang: '🌐 Dil',
    menuCancel: '🛑 Oyunu İptal Et',
    menuSupport: '💬 Destek',
    menuAddGroup: '➕ Beni Gruba Ekle',
    menuProfile: '👤 Profil',
    chooseDifficulty: 'Zorluk seç:',
    chooseBoardSize: 'Tahta boyutunu seç:',
    easy: '🟢 Kolay',
    medium: '🟡 Orta',
    hard: '🔴 Zor',
    gameStarted: 'Oyun başladı! Sen ❌ işaretisin.',
    yourTurn: 'Sıra sende.',
    noActiveGame: 'Aktif oyun yok.',
    cellBusy: 'Bu hücre dolu.',
    youWin: '🎉 Tebrikler, kazandın!',
    botWin: '🤖 Bot kazandı!',
    draw: '🤝 Berabere!',
    newGame: '🔄 Yeni Oyun',
    rematch: '🔁 Rövanş',
    stats: (u) =>
`📊 İstatistiklerin

🤖 Botla Oyun
🏆 Kazanma: ${u.wins}
❌ Kaybetme: ${u.losses}
🤝 Berabere: ${u.draws}

👥 2 Oyunculu
🏆 Kazanma: ${u.multiplayerWins}
❌ Kaybetme: ${u.multiplayerLosses}
🤝 Berabere: ${u.multiplayerDraws}`,
    profile: (u, points, rank) =>
`👤 Profil Kartın

🆔 ID: ${u.id}
👋 İsim: ${u.name}
🔗 Kullanıcı Adı: ${u.username ? '@' + u.username : '-'}
🌐 Dil: ${u.language.toUpperCase()}
🏆 Toplam Puan: ${points}
🥇 Sıra: ${rank}

🤖 Botla Oyun
• Kazanma: ${u.wins}
• Kaybetme: ${u.losses}
• Berabere: ${u.draws}

👥 Çok Oyunculu
• Kazanma: ${u.multiplayerWins}
• Kaybetme: ${u.multiplayerLosses}
• Berabere: ${u.multiplayerDraws}`,
    topTitle: '🏆 Liderlik Tablosu',
    languageChoose: 'Dil seç:',
    langSetTr: 'Dil Türkçe olarak ayarlandı.',
    langSetEn: 'Language set to English.',
    onlyGroups: 'Bu özellik sadece gruplarda kullanılabilir.',
    gameAlreadyExists: 'Bu grupta zaten aktif veya bekleyen bir oyun var.',
    groupGameCreated: (name, size) =>
`👥 ${name} bir grup oyunu başlattı!
Tahta: ${size}x${size}

Katılmak için aşağıdaki butona bas veya birini mention ederek davet et.`,
    join: '✅ Katıl',
    joinedGame: (xName, oName, turnName, size) =>
`🎮 Grup oyunu başladı!

Tahta: ${size}x${size}
❌ ${xName}
⭕ ${oName}

İlk sıra: ${turnName}`,
    notYourTurn: 'Sıra sende değil.',
    notYourGame: 'Bu oyunda değilsin.',
    playerXWin: (name) => `🏆 Kazanan: ${name} ❌`,
    playerOWin: (name) => `🏆 Kazanan: ${name} ⭕`,
    gameDraw: '🤝 Oyun berabere bitti!',
    turnText: (name, symbol) => `Sıra: ${name} ${symbol}`,
    leaderboardEmpty: 'Henüz veri yok.',
    gameCancelled: '🛑 Oyun iptal edildi.',
    noPermissionCancel: 'Bu oyunu iptal etme yetkin yok.',
    backMenu: '⬅️ Menü',
    selectGroupBoard: 'Grup oyunu için tahta boyutunu seç:',
    startGroupOnly: 'Grup oyunu başlatmak için beni bir gruba ekle.',
    selfJoinError: 'Kendi oyununa ikinci oyuncu olarak katılamazsın.',
    inviteExample: 'Birini mention ederek davet etmek için örnek:\n/groupgame @kullaniciadi',
    invitedText: (starter, invited, size) =>
`🎯 ${starter} seni XO oyununa davet etti ${invited}
Tahta: ${size}x${size}

Katılmak için aşağıdaki butona bas.`,
    rematchAccepted: '🔁 Rövanş başladı!',
    rematchWaiting: 'Diğer oyuncunun rövanşı kabul etmesi bekleniyor.',
    onlyInvitedCanJoin: 'Bu oyuna sadece davet edilen kişi katılabilir.'
  },
  en: {
    welcome:
`🎮 Welcome to XO Game Bot!

Choose an option from the menu below.`,
    menuNewGame: '🎯 New Game',
    menuGroupGame: '👥 Group Game',
    menuStats: '📊 Stats',
    menuTop: '🏆 Leaderboard',
    menuLang: '🌐 Language',
    menuCancel: '🛑 Cancel Game',
    menuSupport: '💬 Support',
    menuAddGroup: '➕ Add Me To Group',
    menuProfile: '👤 Profile',
    chooseDifficulty: 'Choose difficulty:',
    chooseBoardSize: 'Choose board size:',
    easy: '🟢 Easy',
    medium: '🟡 Medium',
    hard: '🔴 Hard',
    gameStarted: 'Game started! You are ❌.',
    yourTurn: 'Your turn.',
    noActiveGame: 'No active game.',
    cellBusy: 'This cell is occupied.',
    youWin: '🎉 Congratulations, you won!',
    botWin: '🤖 Bot won!',
    draw: '🤝 Draw!',
    newGame: '🔄 New Game',
    rematch: '🔁 Rematch',
    stats: (u) =>
`📊 Your Stats

🤖 Vs Bot
🏆 Wins: ${u.wins}
❌ Losses: ${u.losses}
🤝 Draws: ${u.draws}

👥 Multiplayer
🏆 Wins: ${u.multiplayerWins}
❌ Losses: ${u.multiplayerLosses}
🤝 Draws: ${u.multiplayerDraws}`,
    profile: (u, points, rank) =>
`👤 Your Profile

🆔 ID: ${u.id}
👋 Name: ${u.name}
🔗 Username: ${u.username ? '@' + u.username : '-'}
🌐 Language: ${u.language.toUpperCase()}
🏆 Total Points: ${points}
🥇 Rank: ${rank}

🤖 Vs Bot
• Wins: ${u.wins}
• Losses: ${u.losses}
• Draws: ${u.draws}

👥 Multiplayer
• Wins: ${u.multiplayerWins}
• Losses: ${u.multiplayerLosses}
• Draws: ${u.multiplayerDraws}`,
    topTitle: '🏆 Leaderboard',
    languageChoose: 'Choose language:',
    langSetTr: 'Dil Türkçe olarak ayarlandı.',
    langSetEn: 'Language set to English.',
    onlyGroups: 'This feature can only be used in groups.',
    gameAlreadyExists: 'There is already an active or pending game in this group.',
    groupGameCreated: (name, size) =>
`👥 ${name} started a group game!
Board: ${size}x${size}

Press the button below to join or invite someone by mention.`,
    join: '✅ Join',
    joinedGame: (xName, oName, turnName, size) =>
`🎮 Group game started!

Board: ${size}x${size}
❌ ${xName}
⭕ ${oName}

First turn: ${turnName}`,
    notYourTurn: 'It is not your turn.',
    notYourGame: 'You are not in this game.',
    playerXWin: (name) => `🏆 Winner: ${name} ❌`,
    playerOWin: (name) => `🏆 Winner: ${name} ⭕`,
    gameDraw: '🤝 The game ended in a draw!',
    turnText: (name, symbol) => `Turn: ${name} ${symbol}`,
    leaderboardEmpty: 'No data yet.',
    gameCancelled: '🛑 Game cancelled.',
    noPermissionCancel: 'You do not have permission to cancel this game.',
    backMenu: '⬅️ Menu',
    selectGroupBoard: 'Choose board size for group game:',
    startGroupOnly: 'Add me to a group to start a group game.',
    selfJoinError: 'You cannot join your own game as second player.',
    inviteExample: 'Example invite:\n/groupgame @username',
    invitedText: (starter, invited, size) =>
`🎯 ${starter} invited you to XO game ${invited}
Board: ${size}x${size}

Press the button below to join.`,
    rematchAccepted: '🔁 Rematch started!',
    rematchWaiting: 'Waiting for the other player to accept rematch.',
    onlyInvitedCanJoin: 'Only the invited user can join this game.'
  }
};

function t(userId, key, ...args) {
  const user = getUser(userId);
  const lang = user?.language || 'tr';
  const value = texts[lang][key];
  return typeof value === 'function' ? value(...args) : value;
}

// ==============================
// STATE
// ==============================

const singleGames = new Map();
const groupGames = new Map();

// ==============================
// HELPERS
// ==============================

function getDisplayName(user) {
  if (!user) return 'User';
  return user.username ? `@${user.username}` : user.first_name || 'User';
}

function getProfileText(userId) {
  const u = getUser(userId);
  if (!u) return 'Profil bulunamadı.';

  const list = getLeaderboard();
  const rankIndex = list.findIndex((item) => String(item.id) === String(userId));
  const rank = rankIndex >= 0 ? rankIndex + 1 : '-';
  const points = ((u.wins + u.multiplayerWins) * 3) + (u.draws + u.multiplayerDraws);

  return t(userId, 'profile', u, points, rank);
}

function buildLeaderboardText(requesterId) {
  const list = getLeaderboard();
  if (!list.length) return t(requesterId, 'leaderboardEmpty');

  let text = `${t(requesterId, 'topTitle')}\n\n`;
  list.slice(0, 10).forEach((u, i) => {
    const name = u.username ? `@${u.username}` : u.name;
    text += `${i + 1}. ${name} — ${u.points} puan\n`;
    text += `   🏆 ${u.totalWins} | ❌ ${u.totalLosses} | 🤝 ${u.totalDraws}\n`;
  });
  return text;
}

function createBoard(size) {
  return Array(size * size).fill('');
}

function neededToWin(size) {
  return size;
}

function checkWinner(board, size) {
  const target = neededToWin(size);
  const get = (r, c) => board[r * size + c];

  for (let r = 0; r < size; r++) {
    for (let c = 0; c <= size - target; c++) {
      const first = get(r, c);
      if (!first) continue;
      let ok = true;
      for (let k = 1; k < target; k++) {
        if (get(r, c + k) !== first) {
          ok = false;
          break;
        }
      }
      if (ok) return first;
    }
  }

  for (let c = 0; c < size; c++) {
    for (let r = 0; r <= size - target; r++) {
      const first = get(r, c);
      if (!first) continue;
      let ok = true;
      for (let k = 1; k < target; k++) {
        if (get(r + k, c) !== first) {
          ok = false;
          break;
        }
      }
      if (ok) return first;
    }
  }

  for (let r = 0; r <= size - target; r++) {
    for (let c = 0; c <= size - target; c++) {
      const first = get(r, c);
      if (!first) continue;
      let ok = true;
      for (let k = 1; k < target; k++) {
        if (get(r + k, c + k) !== first) {
          ok = false;
          break;
        }
      }
      if (ok) return first;
    }
  }

  for (let r = 0; r <= size - target; r++) {
    for (let c = target - 1; c < size; c++) {
      const first = get(r, c);
      if (!first) continue;
      let ok = true;
      for (let k = 1; k < target; k++) {
        if (get(r + k, c - k) !== first) {
          ok = false;
          break;
        }
      }
      if (ok) return first;
    }
  }

  if (board.every((cell) => cell !== '')) return 'draw';
  return null;
}

function renderCell(value) {
  if (value === 'X') return '❌';
  if (value === 'O') return '⭕';
  return '▫️';
}

function boardKeyboard(board, size, prefix, gameOver = false, extraRows = []) {
  const rows = [];

  for (let r = 0; r < size; r++) {
    const row = [];
    for (let c = 0; c < size; c++) {
      const i = r * size + c;
      row.push(
        Markup.button.callback(
          renderCell(board[i]),
          gameOver ? 'ignore' : `${prefix}_${i}`
        )
      );
    }
    rows.push(row);
  }

  extraRows.forEach((row) => rows.push(row));
  return Markup.inlineKeyboard(rows);
}

function mainMenu(userId) {
  const user = getUser(userId);
  const lang = user?.language || 'tr';

  return Markup.inlineKeyboard([
    [
      Markup.button.callback(texts[lang].menuNewGame, 'menu_newgame'),
      Markup.button.callback(texts[lang].menuGroupGame, 'menu_groupgame')
    ],
    [
      Markup.button.callback(texts[lang].menuStats, 'menu_stats'),
      Markup.button.callback(texts[lang].menuTop, 'menu_top')
    ],
    [
      Markup.button.callback(texts[lang].menuProfile, 'menu_profile'),
      Markup.button.callback(texts[lang].menuLang, 'menu_lang')
    ],
    [
      Markup.button.callback(texts[lang].menuCancel, 'menu_cancel')
    ],
    [
      Markup.button.url(texts[lang].menuSupport, SUPPORT_LINK),
      Markup.button.url(texts[lang].menuAddGroup, ADD_GROUP_LINK)
    ]
  ]);
}

function languageKeyboard() {
  return Markup.inlineKeyboard([
    [
      Markup.button.callback('🇹🇷 Türkçe', 'lang_tr'),
      Markup.button.callback('🇬🇧 English', 'lang_en')
    ],
    [
      Markup.button.callback('⬅️ Menu', 'back_menu')
    ]
  ]);
}

function boardSizeKeyboard(prefix) {
  return Markup.inlineKeyboard([
    [
      Markup.button.callback('3x3', `${prefix}_3`),
      Markup.button.callback('4x4', `${prefix}_4`)
    ],
    [
      Markup.button.callback('⬅️ Menu', 'back_menu')
    ]
  ]);
}

function difficultyKeyboard(userId, size) {
  const user = getUser(userId);
  const lang = user?.language || 'tr';

  return Markup.inlineKeyboard([
    [
      Markup.button.callback(texts[lang].easy, `diff_${size}_easy`),
      Markup.button.callback(texts[lang].medium, `diff_${size}_medium`),
      Markup.button.callback(texts[lang].hard, `diff_${size}_hard`)
    ],
    [
      Markup.button.callback(texts[lang].backMenu, 'back_menu')
    ]
  ]);
}

function groupJoinKeyboard(userId, size) {
  const user = getUser(userId);
  const lang = user?.language || 'tr';

  return Markup.inlineKeyboard([
    [Markup.button.callback(texts[lang].join, `group_join_${size}`)],
    [Markup.button.callback(texts[lang].backMenu, 'back_menu')]
  ]);
}

function singleAfterGameButtons(userId, size, difficulty) {
  const user = getUser(userId);
  const lang = user?.language || 'tr';

  return [
    [
      Markup.button.callback(texts[lang].rematch, `rematch_single_${size}_${difficulty}`),
      Markup.button.callback(texts[lang].newGame, 'menu_newgame')
    ],
    [Markup.button.callback(texts[lang].backMenu, 'back_menu')]
  ];
}

function groupAfterGameButtons(userId, size) {
  const user = getUser(userId);
  const lang = user?.language || 'tr';

  return [
    [Markup.button.callback(texts[lang].rematch, `group_rematch_${size}`)],
    [Markup.button.callback(texts[lang].backMenu, 'back_menu')]
  ];
}

// ==============================
// AI
// ==============================

function randomMove(board) {
  const empty = board.map((v, i) => v === '' ? i : null).filter((v) => v !== null);
  return empty[Math.floor(Math.random() * empty.length)];
}

function canWinMove(board, size, symbol) {
  for (let i = 0; i < board.length; i++) {
    if (board[i] === '') {
      const test = [...board];
      test[i] = symbol;
      if (checkWinner(test, size) === symbol) return i;
    }
  }
  return null;
}

function bestCenterOrNear(board, size) {
  const centers = [];
  const mid = Math.floor(size / 2);

  if (size % 2 === 1) {
    centers.push(mid * size + mid);
  } else {
    centers.push((mid - 1) * size + (mid - 1));
    centers.push((mid - 1) * size + mid);
    centers.push(mid * size + (mid - 1));
    centers.push(mid * size + mid);
  }

  for (const c of centers) {
    if (board[c] === '') return c;
  }

  return null;
}

function aiEasy(board) {
  return randomMove(board);
}

function aiMedium(board, size) {
  let move = canWinMove(board, size, 'O');
  if (move !== null) return move;

  move = canWinMove(board, size, 'X');
  if (move !== null) return move;

  move = bestCenterOrNear(board, size);
  if (move !== null) return move;

  return randomMove(board);
}

function aiHard3x3(board) {
  function minimax(b, depth, isMax) {
    const result = checkWinner(b, 3);

    if (result === 'O') return 10 - depth;
    if (result === 'X') return depth - 10;
    if (result === 'draw') return 0;

    if (isMax) {
      let best = -Infinity;
      for (let i = 0; i < b.length; i++) {
        if (b[i] === '') {
          b[i] = 'O';
          best = Math.max(best, minimax(b, depth + 1, false));
          b[i] = '';
        }
      }
      return best;
    } else {
      let best = Infinity;
      for (let i = 0; i < b.length; i++) {
        if (b[i] === '') {
          b[i] = 'X';
          best = Math.min(best, minimax(b, depth + 1, true));
          b[i] = '';
        }
      }
      return best;
    }
  }

  let bestScore = -Infinity;
  let bestMove = -1;

  for (let i = 0; i < board.length; i++) {
    if (board[i] === '') {
      board[i] = 'O';
      const score = minimax(board, 0, false);
      board[i] = '';
      if (score > bestScore) {
        bestScore = score;
        bestMove = i;
      }
    }
  }

  return bestMove;
}

function aiHard(board, size) {
  if (size === 3) return aiHard3x3(board);

  let move = canWinMove(board, size, 'O');
  if (move !== null) return move;

  move = canWinMove(board, size, 'X');
  if (move !== null) return move;

  move = bestCenterOrNear(board, size);
  if (move !== null) return move;

  return randomMove(board);
}

function getAiMove(board, size, difficulty) {
  if (difficulty === 'easy') return aiEasy(board);
  if (difficulty === 'medium') return aiMedium(board, size);
  return aiHard(board, size);
}

// ==============================
// COMMANDS
// ==============================

bot.start(async (ctx) => {
  ensureUser(ctx.from);
  await ctx.reply(t(ctx.from.id, 'welcome'), mainMenu(ctx.from.id));
});

bot.command('newgame', async (ctx) => {
  ensureUser(ctx.from);
  await ctx.reply(t(ctx.from.id, 'chooseBoardSize'), boardSizeKeyboard('size_single'));
});

bot.command('stats', async (ctx) => {
  ensureUser(ctx.from);
  const user = getUser(ctx.from.id);
  await ctx.reply(t(ctx.from.id, 'stats', user), mainMenu(ctx.from.id));
});

bot.command('top', async (ctx) => {
  ensureUser(ctx.from);
  await ctx.reply(buildLeaderboardText(ctx.from.id), mainMenu(ctx.from.id));
});

bot.command('language', async (ctx) => {
  ensureUser(ctx.from);
  await ctx.reply(t(ctx.from.id, 'languageChoose'), languageKeyboard());
});

bot.command('profile', async (ctx) => {
  ensureUser(ctx.from);
  await ctx.reply(getProfileText(ctx.from.id), mainMenu(ctx.from.id));
});

bot.command('cancelgame', async (ctx) => {
  ensureUser(ctx.from);
  const userId = ctx.from.id;
  const chatId = ctx.chat.id;

  if (singleGames.has(userId)) {
    singleGames.delete(userId);
    return ctx.reply(t(userId, 'gameCancelled'), mainMenu(userId));
  }

  const game = groupGames.get(chatId);
  if (game) {
    const allowed = [game.playerX?.id, game.playerO?.id].includes(userId);
    if (!allowed) {
      return ctx.reply(t(userId, 'noPermissionCancel'));
    }
    groupGames.delete(chatId);
    return ctx.reply(t(userId, 'gameCancelled'), mainMenu(userId));
  }

  return ctx.reply(t(userId, 'noActiveGame'));
});

bot.command('groupgame', async (ctx) => {
  ensureUser(ctx.from);

  if (!['group', 'supergroup'].includes(ctx.chat.type)) {
    return ctx.reply(t(ctx.from.id, 'onlyGroups'));
  }

  const parts = (ctx.message.text || '').trim().split(/\s+/);
  const mention = parts[1];

  if (mention && mention.startsWith('@')) {
    return ctx.reply(
      t(ctx.from.id, 'selectGroupBoard'),
      Markup.inlineKeyboard([
        [
          Markup.button.callback(`3x3 | ${mention}`, `size_group_invite_3_${mention.slice(1).toLowerCase()}`),
          Markup.button.callback(`4x4 | ${mention}`, `size_group_invite_4_${mention.slice(1).toLowerCase()}`)
        ],
        [Markup.button.callback(t(ctx.from.id, 'backMenu'), 'back_menu')]
      ])
    );
  }

  await ctx.reply(t(ctx.from.id, 'selectGroupBoard'), boardSizeKeyboard('size_group'));
});

// ==============================
// MENU ACTIONS
// ==============================

bot.action('menu_newgame', async (ctx) => {
  ensureUser(ctx.from);
  await safeEditMessageText(ctx, t(ctx.from.id, 'chooseBoardSize'), boardSizeKeyboard('size_single'));
  await safeAnswerCbQuery(ctx);
});

bot.action('menu_groupgame', async (ctx) => {
  ensureUser(ctx.from);

  if (!['group', 'supergroup'].includes(ctx.chat.type)) {
    await safeEditMessageText(
      ctx,
      t(ctx.from.id, 'startGroupOnly'),
      Markup.inlineKeyboard([
        [Markup.button.url(texts[getUser(ctx.from.id)?.language || 'tr'].menuAddGroup, ADD_GROUP_LINK)],
        [Markup.button.callback(t(ctx.from.id, 'backMenu'), 'back_menu')]
      ])
    );
    return safeAnswerCbQuery(ctx);
  }

  await safeEditMessageText(ctx, t(ctx.from.id, 'selectGroupBoard'), boardSizeKeyboard('size_group'));
  await safeAnswerCbQuery(ctx);
});

bot.action('menu_stats', async (ctx) => {
  ensureUser(ctx.from);
  const user = getUser(ctx.from.id);
  await safeEditMessageText(ctx, t(ctx.from.id, 'stats', user), mainMenu(ctx.from.id));
  await safeAnswerCbQuery(ctx);
});

bot.action('menu_top', async (ctx) => {
  ensureUser(ctx.from);
  await safeEditMessageText(ctx, buildLeaderboardText(ctx.from.id), mainMenu(ctx.from.id));
  await safeAnswerCbQuery(ctx);
});

bot.action('menu_profile', async (ctx) => {
  ensureUser(ctx.from);
  await safeEditMessageText(ctx, getProfileText(ctx.from.id), mainMenu(ctx.from.id));
  await safeAnswerCbQuery(ctx);
});

bot.action('menu_lang', async (ctx) => {
  ensureUser(ctx.from);
  await safeEditMessageText(ctx, t(ctx.from.id, 'languageChoose'), languageKeyboard());
  await safeAnswerCbQuery(ctx);
});

bot.action('menu_cancel', async (ctx) => {
  ensureUser(ctx.from);

  const userId = ctx.from.id;
  const chatId = ctx.chat.id;

  if (singleGames.has(userId)) {
    singleGames.delete(userId);
    await safeEditMessageText(ctx, t(userId, 'gameCancelled'), mainMenu(userId));
    return safeAnswerCbQuery(ctx);
  }

  const game = groupGames.get(chatId);
  if (game) {
    const allowed = [game.playerX?.id, game.playerO?.id].includes(userId);
    if (!allowed) {
      await safeAnswerCbQuery(ctx, t(userId, 'noPermissionCancel'));
      return;
    }
    groupGames.delete(chatId);
    await safeEditMessageText(ctx, t(userId, 'gameCancelled'), mainMenu(userId));
    return safeAnswerCbQuery(ctx);
  }

  await safeAnswerCbQuery(ctx, t(userId, 'noActiveGame'));
});

bot.action('back_menu', async (ctx) => {
  ensureUser(ctx.from);
  await safeEditMessageText(ctx, t(ctx.from.id, 'welcome'), mainMenu(ctx.from.id));
  await safeAnswerCbQuery(ctx);
});

// ==============================
// LANGUAGE
// ==============================

bot.action('lang_tr', async (ctx) => {
  ensureUser(ctx.from);
  setLanguage(ctx.from.id, 'tr');
  await safeEditMessageText(ctx, texts.tr.langSetTr, mainMenu(ctx.from.id));
  await safeAnswerCbQuery(ctx);
});

bot.action('lang_en', async (ctx) => {
  ensureUser(ctx.from);
  setLanguage(ctx.from.id, 'en');
  await safeEditMessageText(ctx, texts.en.langSetEn, mainMenu(ctx.from.id));
  await safeAnswerCbQuery(ctx);
});

// ==============================
// SINGLEPLAYER
// ==============================

bot.action(/^size_single_(3|4)$/, async (ctx) => {
  await withLock(ctx, async () => {
    ensureUser(ctx.from);
    const size = Number(ctx.match[1]);
    await safeEditMessageText(ctx, t(ctx.from.id, 'chooseDifficulty'), difficultyKeyboard(ctx.from.id, size));
    await safeAnswerCbQuery(ctx);
  }, 'size_single');
});

bot.action(/^diff_(3|4)_(easy|medium|hard)$/, async (ctx) => {
  await withLock(ctx, async () => {
    ensureUser(ctx.from);
    const size = Number(ctx.match[1]);
    const difficulty = ctx.match[2];
    const userId = ctx.from.id;

    const game = {
      size,
      board: createBoard(size),
      difficulty,
      gameOver: false
    };

    singleGames.set(userId, game);

    await safeEditMessageText(
      ctx,
      `${t(userId, 'gameStarted')}\n\n🎲 Tahta: ${size}x${size}`,
      boardKeyboard(game.board, size, 'singlemove')
    );

    await safeAnswerCbQuery(ctx);
  }, 'diff_single');
});

bot.action(/^singlemove_(\d+)$/, async (ctx) => {
  await withLock(ctx, async () => {
    ensureUser(ctx.from);

    const userId = ctx.from.id;
    const game = singleGames.get(userId);

    if (!game || game.gameOver) {
      await safeAnswerCbQuery(ctx, t(userId, 'noActiveGame'));
      return;
    }

    const index = Number(ctx.match[1]);

    if (game.board[index] !== '') {
      await safeAnswerCbQuery(ctx, t(userId, 'cellBusy'));
      return;
    }

    game.board[index] = 'X';

    let result = checkWinner(game.board, game.size);

    if (result) {
      game.gameOver = true;

      let text;
      if (result === 'X') {
        text = t(userId, 'youWin');
        addSingleResult(userId, 'win');
      } else if (result === 'O') {
        text = t(userId, 'botWin');
        addSingleResult(userId, 'loss');
      } else {
        text = t(userId, 'draw');
        addSingleResult(userId, 'draw');
      }

      await safeEditMessageText(
        ctx,
        `${text}\n\n🎲 Tahta: ${game.size}x${game.size}`,
        boardKeyboard(game.board, game.size, 'singlemove', true, singleAfterGameButtons(userId, game.size, game.difficulty))
      );

      await safeAnswerCbQuery(ctx);
      return;
    }

    const move = getAiMove(game.board, game.size, game.difficulty);
    if (move !== undefined && move !== null) {
      game.board[move] = 'O';
    }

    result = checkWinner(game.board, game.size);

    if (result) {
      game.gameOver = true;

      let text;
      if (result === 'X') {
        text = t(userId, 'youWin');
        addSingleResult(userId, 'win');
      } else if (result === 'O') {
        text = t(userId, 'botWin');
        addSingleResult(userId, 'loss');
      } else {
        text = t(userId, 'draw');
        addSingleResult(userId, 'draw');
      }

      await safeEditMessageText(
        ctx,
        `${text}\n\n🎲 Tahta: ${game.size}x${game.size}`,
        boardKeyboard(game.board, game.size, 'singlemove', true, singleAfterGameButtons(userId, game.size, game.difficulty))
      );

      await safeAnswerCbQuery(ctx);
      return;
    }

    await safeEditMessageText(
      ctx,
      `${t(userId, 'yourTurn')}\n\n🎲 Tahta: ${game.size}x${game.size}`,
      boardKeyboard(game.board, game.size, 'singlemove')
    );

    await safeAnswerCbQuery(ctx);
  }, 'singlemove');
});

bot.action(/^rematch_single_(3|4)_(easy|medium|hard)$/, async (ctx) => {
  await withLock(ctx, async () => {
    ensureUser(ctx.from);

    const size = Number(ctx.match[1]);
    const difficulty = ctx.match[2];
    const userId = ctx.from.id;

    const game = {
      size,
      board: createBoard(size),
      difficulty,
      gameOver: false
    };

    singleGames.set(userId, game);

    await safeEditMessageText(
      ctx,
      `${t(userId, 'gameStarted')}\n\n🎲 Tahta: ${size}x${size}`,
      boardKeyboard(game.board, size, 'singlemove')
    );

    await safeAnswerCbQuery(ctx);
  }, 'single_rematch');
});

// ==============================
// GROUP
// ==============================

bot.action(/^size_group_(3|4)$/, async (ctx) => {
  await withLock(ctx, async () => {
    ensureUser(ctx.from);

    if (!['group', 'supergroup'].includes(ctx.chat.type)) {
      await safeAnswerCbQuery(ctx, t(ctx.from.id, 'onlyGroups'));
      return;
    }

    const size = Number(ctx.match[1]);
    const chatId = ctx.chat.id;

    if (groupGames.has(chatId)) {
      await safeAnswerCbQuery(ctx, t(ctx.from.id, 'gameAlreadyExists'));
      return;
    }

    groupGames.set(chatId, {
      type: 'pending',
      size,
      board: createBoard(size),
      playerX: ctx.from,
      playerO: null,
      invitedUsername: null,
      turn: 'X',
      gameOver: false,
      rematch: null
    });

    await safeEditMessageText(
      ctx,
      `${t(ctx.from.id, 'groupGameCreated', getDisplayName(ctx.from), size)}\n\n${t(ctx.from.id, 'inviteExample')}`,
      groupJoinKeyboard(ctx.from.id, size)
    );

    await safeAnswerCbQuery(ctx);
  }, 'group_create');
});

bot.action(/^size_group_invite_(3|4)_(.+)$/, async (ctx) => {
  await withLock(ctx, async () => {
    ensureUser(ctx.from);

    const size = Number(ctx.match[1]);
    const username = String(ctx.match[2]).toLowerCase();
    const chatId = ctx.chat.id;

    if (groupGames.has(chatId)) {
      await safeAnswerCbQuery(ctx, t(ctx.from.id, 'gameAlreadyExists'));
      return;
    }

    groupGames.set(chatId, {
      type: 'pending',
      size,
      board: createBoard(size),
      playerX: ctx.from,
      playerO: null,
      invitedUsername: username,
      turn: 'X',
      gameOver: false,
      rematch: null
    });

    await safeEditMessageText(
      ctx,
      t(ctx.from.id, 'invitedText', getDisplayName(ctx.from), '@' + username, size),
      Markup.inlineKeyboard([
        [Markup.button.callback(t(ctx.from.id, 'join'), `group_join_invited_${size}_${username}`)],
        [Markup.button.callback(t(ctx.from.id, 'backMenu'), 'back_menu')]
      ])
    );

    await safeAnswerCbQuery(ctx);
  }, 'group_create_invite');
});

bot.action(/^group_join_(3|4)$/, async (ctx) => {
  await withLock(ctx, async () => {
    ensureUser(ctx.from);

    const chatId = ctx.chat.id;
    const game = groupGames.get(chatId);

    if (!game) {
      await safeAnswerCbQuery(ctx, t(ctx.from.id, 'noActiveGame'));
      return;
    }

    if (game.type !== 'pending') {
      await safeAnswerCbQuery(ctx, t(ctx.from.id, 'gameAlreadyExists'));
      return;
    }

    if (game.playerX.id === ctx.from.id) {
      await safeAnswerCbQuery(ctx, t(ctx.from.id, 'selfJoinError'));
      return;
    }

    if (game.invitedUsername && (ctx.from.username || '').toLowerCase() !== game.invitedUsername) {
      await safeAnswerCbQuery(ctx, t(ctx.from.id, 'onlyInvitedCanJoin'));
      return;
    }

    game.playerO = ctx.from;
    game.type = 'active';
    game.turn = 'X';
    game.rematch = null;

    const xName = getDisplayName(game.playerX);
    const oName = getDisplayName(game.playerO);
    const turnName = getDisplayName(game.playerX);

    await safeEditMessageText(
      ctx,
      t(game.playerX.id, 'joinedGame', xName, oName, turnName, game.size),
      boardKeyboard(game.board, game.size, 'groupmove')
    );

    await safeAnswerCbQuery(ctx);
  }, 'group_join');
});

bot.action(/^group_join_invited_(3|4)_(.+)$/, async (ctx) => {
  await withLock(ctx, async () => {
    ensureUser(ctx.from);

    const chatId = ctx.chat.id;
    const game = groupGames.get(chatId);

    if (!game) {
      await safeAnswerCbQuery(ctx, t(ctx.from.id, 'noActiveGame'));
      return;
    }

    if (game.type !== 'pending') {
      await safeAnswerCbQuery(ctx, t(ctx.from.id, 'gameAlreadyExists'));
      return;
    }

    if (game.playerX.id === ctx.from.id) {
      await safeAnswerCbQuery(ctx, t(ctx.from.id, 'selfJoinError'));
      return;
    }

    const currentUsername = (ctx.from.username || '').toLowerCase();
    if (game.invitedUsername && currentUsername !== game.invitedUsername) {
      await safeAnswerCbQuery(ctx, t(ctx.from.id, 'onlyInvitedCanJoin'));
      return;
    }

    game.playerO = ctx.from;
    game.type = 'active';
    game.turn = 'X';
    game.rematch = null;

    await safeEditMessageText(
      ctx,
      t(ctx.from.id, 'joinedGame', getDisplayName(game.playerX), getDisplayName(game.playerO), getDisplayName(game.playerX), game.size),
      boardKeyboard(game.board, game.size, 'groupmove')
    );

    await safeAnswerCbQuery(ctx);
  }, 'group_join_invited');
});

bot.action(/^groupmove_(\d+)$/, async (ctx) => {
  await withLock(ctx, async () => {
    ensureUser(ctx.from);

    const chatId = ctx.chat.id;
    const game = groupGames.get(chatId);

    if (!game || game.type !== 'active' || game.gameOver) {
      await safeAnswerCbQuery(ctx, t(ctx.from.id, 'noActiveGame'));
      return;
    }

    const playerIds = [game.playerX.id, game.playerO.id];
    if (!playerIds.includes(ctx.from.id)) {
      await safeAnswerCbQuery(ctx, t(ctx.from.id, 'notYourGame'));
      return;
    }

    const currentPlayerId = game.turn === 'X' ? game.playerX.id : game.playerO.id;
    if (ctx.from.id !== currentPlayerId) {
      await safeAnswerCbQuery(ctx, t(ctx.from.id, 'notYourTurn'));
      return;
    }

    const index = Number(ctx.match[1]);
    if (game.board[index] !== '') {
      await safeAnswerCbQuery(ctx, t(ctx.from.id, 'cellBusy'));
      return;
    }

    game.board[index] = game.turn;

    const result = checkWinner(game.board, game.size);

    if (result) {
      game.gameOver = true;
      game.type = 'finished';
      game.rematch = { x: false, o: false };

      if (result === 'X') {
        addMultiResult(game.playerX.id, 'win');
        addMultiResult(game.playerO.id, 'loss');

        await safeEditMessageText(
          ctx,
          `${t(game.playerX.id, 'playerXWin', getDisplayName(game.playerX))}\n\n🎲 Tahta: ${game.size}x${game.size}`,
          boardKeyboard(game.board, game.size, 'groupmove', true, groupAfterGameButtons(game.playerX.id, game.size))
        );
      } else if (result === 'O') {
        addMultiResult(game.playerO.id, 'win');
        addMultiResult(game.playerX.id, 'loss');

        await safeEditMessageText(
          ctx,
          `${t(game.playerO.id, 'playerOWin', getDisplayName(game.playerO))}\n\n🎲 Tahta: ${game.size}x${game.size}`,
          boardKeyboard(game.board, game.size, 'groupmove', true, groupAfterGameButtons(game.playerO.id, game.size))
        );
      } else {
        addMultiResult(game.playerX.id, 'draw');
        addMultiResult(game.playerO.id, 'draw');

        await safeEditMessageText(
          ctx,
          `${t(game.playerX.id, 'gameDraw')}\n\n🎲 Tahta: ${game.size}x${game.size}`,
          boardKeyboard(game.board, game.size, 'groupmove', true, groupAfterGameButtons(game.playerX.id, game.size))
        );
      }

      await safeAnswerCbQuery(ctx);
      return;
    }

    game.turn = game.turn === 'X' ? 'O' : 'X';
    const nextPlayer = game.turn === 'X' ? game.playerX : game.playerO;
    const nextSymbol = game.turn === 'X' ? '❌' : '⭕';

    await safeEditMessageText(
      ctx,
      `Oyun #${String(chatId).replace('-', '')}\n${t(ctx.from.id, 'turnText', getDisplayName(nextPlayer), nextSymbol)}`,
      boardKeyboard(game.board, game.size, 'groupmove')
    );

    await safeAnswerCbQuery(ctx);
  }, 'groupmove');
});

bot.action(/^group_rematch_(3|4)$/, async (ctx) => {
  await withLock(ctx, async () => {
    ensureUser(ctx.from);

    const chatId = ctx.chat.id;
    const game = groupGames.get(chatId);

    if (!game || game.type !== 'finished') {
      await safeAnswerCbQuery(ctx, t(ctx.from.id, 'noActiveGame'));
      return;
    }

    if (![game.playerX.id, game.playerO.id].includes(ctx.from.id)) {
      await safeAnswerCbQuery(ctx, t(ctx.from.id, 'notYourGame'));
      return;
    }

    if (!game.rematch) {
      game.rematch = { x: false, o: false };
    }

    if (ctx.from.id === game.playerX.id) game.rematch.x = true;
    if (ctx.from.id === game.playerO.id) game.rematch.o = true;

    if (game.rematch.x && game.rematch.o) {
      game.type = 'active';
      game.gameOver = false;
      game.board = createBoard(game.size);
      game.turn = 'X';
      game.rematch = { x: false, o: false };

      await safeEditMessageText(
        ctx,
        `${t(ctx.from.id, 'rematchAccepted')}\n\n${t(ctx.from.id, 'joinedGame', getDisplayName(game.playerX), getDisplayName(game.playerO), getDisplayName(game.playerX), game.size)}`,
        boardKeyboard(game.board, game.size, 'groupmove')
      );

      await safeAnswerCbQuery(ctx);
      return;
    }

    await safeAnswerCbQuery(ctx, t(ctx.from.id, 'rematchWaiting'));
  }, 'group_rematch');
});

// ==============================
// IGNORE
// ==============================

bot.action('ignore', async (ctx) => {
  await safeAnswerCbQuery(ctx);
});

// ==============================
// ERROR
// ==============================

bot.catch((err) => {
  console.error('Bot error:', err);
});

// ==============================
// START
// ==============================

bot.launch({ dropPendingUpdates: true })
  .then(() => {
    console.log('✅ Bot çalışıyor');
  })
  .catch((err) => {
    console.error('Launch error:', err);
  });

process.once('SIGINT', () => {
  if (dbDirty) saveDBToDisk();
  bot.stop('SIGINT');
});

process.once('SIGTERM', () => {
  if (dbDirty) saveDBToDisk();
  bot.stop('SIGTERM');
});
