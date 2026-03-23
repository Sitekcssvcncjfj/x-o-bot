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

// ==============================
// DB
// ==============================

if (!fs.existsSync(DATA_DIR)) {
  fs.mkdirSync(DATA_DIR, { recursive: true });
}
if (!fs.existsSync(DATA_FILE)) {
  fs.writeFileSync(DATA_FILE, JSON.stringify({ users: {} }, null, 2));
}

function loadDB() {
  try {
    return JSON.parse(fs.readFileSync(DATA_FILE, 'utf8'));
  } catch {
    return { users: {} };
  }
}

function saveDB(db) {
  fs.writeFileSync(DATA_FILE, JSON.stringify(db, null, 2));
}

function ensureUser(user) {
  const db = loadDB();
  const id = String(user.id);

  if (!db.users[id]) {
    db.users[id] = {
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
  } else {
    db.users[id].name = user.first_name || user.username || db.users[id].name;
    db.users[id].username = user.username || db.users[id].username;
  }

  saveDB(db);
  return db.users[id];
}

function getUser(userId) {
  const db = loadDB();
  return db.users[String(userId)];
}

function setLanguage(userId, lang) {
  const db = loadDB();
  const id = String(userId);
  if (!db.users[id]) return;
  db.users[id].language = lang;
  saveDB(db);
}

function addSingleResult(userId, result) {
  const db = loadDB();
  const id = String(userId);
  if (!db.users[id]) return;

  if (result === 'win') db.users[id].wins++;
  if (result === 'loss') db.users[id].losses++;
  if (result === 'draw') db.users[id].draws++;

  saveDB(db);
}

function addMultiResult(userId, result) {
  const db = loadDB();
  const id = String(userId);
  if (!db.users[id]) return;

  if (result === 'win') db.users[id].multiplayerWins++;
  if (result === 'loss') db.users[id].multiplayerLosses++;
  if (result === 'draw') db.users[id].multiplayerDraws++;

  saveDB(db);
}

function getLeaderboard() {
  const db = loadDB();
  return Object.values(db.users)
    .map(u => ({
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
    gameAlreadyExists: 'Senin zaten bu grupta aktif veya bekleyen bir oyunun var.',
    groupGameCreated: (name, size, gameId) =>
`👥 ${name} bir grup oyunu başlattı!
Tahta: ${size}x${size}
Oyun ID: #${gameId}

Katılmak için aşağıdaki butona bas.`,
    join: '✅ Katıl',
    joinedGame: (xName, oName, turnName, size, gameId) =>
`🎮 Grup oyunu başladı!

Oyun ID: #${gameId}
Tahta: ${size}x${size}
❌ ${xName}
⭕ ${oName}

İlk sıra: ${turnName}`,
    notYourTurn: 'Sıra sende değil.',
    notYourGame: 'Bu oyunda değilsin.',
    playerXWin: (name) => `🏆 Kazanan: ${name} ❌`,
    playerOWin: (name) => `🏆 Kazanan: ${name} ⭕`,
    gameDraw: '🤝 Oyun berabere bitti!',
    turnText: (name, symbol, gameId) => `Oyun #${gameId}\nSıra: ${name} ${symbol}`,
    leaderboardEmpty: 'Henüz veri yok.',
    gameCancelled: '🛑 Oyun iptal edildi.',
    noPermissionCancel: 'Bu oyunu iptal etme yetkin yok.',
    backMenu: '⬅️ Menü',
    selectGroupBoard: 'Grup oyunu için tahta boyutunu seç:',
    startGroupOnly: 'Grup oyunu başlatmak için beni bir gruba ekle.',
    selfJoinError: 'Kendi oyununa ikinci oyuncu olarak katılamazsın.',
    supportText: 'Destek için aşağıdaki butona bas.',
    inviteExample: 'Birini mention ederek davet etmek için örnek:\n/groupgame @kullaniciadi',
    invitedText: (starter, invited, size, gameId) =>
`🎯 ${starter} seni XO oyununa davet etti ${invited}
Oyun ID: #${gameId}
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
    gameAlreadyExists: 'You already have an active or pending game in this group.',
    groupGameCreated: (name, size, gameId) =>
`👥 ${name} started a group game!
Board: ${size}x${size}
Game ID: #${gameId}

Press the button below to join.`,
    join: '✅ Join',
    joinedGame: (xName, oName, turnName, size, gameId) =>
`🎮 Group game started!

Game ID: #${gameId}
Board: ${size}x${size}
❌ ${xName}
⭕ ${oName}

First turn: ${turnName}`,
    notYourTurn: 'It is not your turn.',
    notYourGame: 'You are not in this game.',
    playerXWin: (name) => `🏆 Winner: ${name} ❌`,
    playerOWin: (name) => `🏆 Winner: ${name} ⭕`,
    gameDraw: '🤝 The game ended in a draw!',
    turnText: (name, symbol, gameId) => `Game #${gameId}\nTurn: ${name} ${symbol}`,
    leaderboardEmpty: 'No data yet.',
    gameCancelled: '🛑 Game cancelled.',
    noPermissionCancel: 'You do not have permission to cancel this game.',
    backMenu: '⬅️ Menu',
    selectGroupBoard: 'Choose board size for group game:',
    startGroupOnly: 'Add me to a group to start a group game.',
    selfJoinError: 'You cannot join your own game as second player.',
    supportText: 'Tap the button below for support.',
    inviteExample: 'Example invite:\n/groupgame @username',
    invitedText: (starter, invited, size, gameId) =>
`🎯 ${starter} invited you to XO game ${invited}
Game ID: #${gameId}
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

const singleGames = new Map(); // userId
const groupGames = new Map(); // gameId
let gameCounter = 1;

// ==============================
// HELPERS
// ==============================

function generateGameId(chatId) {
  return `${Math.abs(chatId)}_${Date.now()}_${gameCounter++}`;
}

function getDisplayName(user) {
  if (!user) return 'User';
  return user.username ? `@${user.username}` : user.first_name || 'User';
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

function getProfileText(userId) {
  const u = getUser(userId);
  if (!u) return 'Profil bulunamadı.';

  const list = getLeaderboard();
  const foundIndex = list.findIndex(item => String(item.id) === String(userId));
  const rank = foundIndex >= 0 ? foundIndex + 1 : '-';
  const points = ((u.wins + u.multiplayerWins) * 3) + (u.draws + u.multiplayerDraws);

  return t(userId, 'profile', u, points, rank);
}

function createBoard(size) {
  return Array(size * size).fill('');
}

function neededToWin(size) {
  if (size <= 4) return size;
  return 4;
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

  if (board.every(cell => cell !== '')) return 'draw';
  return null;
}

function renderCell(value) {
  if (value === 'X') return '❌';
  if (value === 'O') return '⭕';
  return '▫️';
}

function boardKeyboard(board, size, prefix, gameId, gameOver = false, extraRows = []) {
  const rows = [];

  for (let r = 0; r < size; r++) {
    const row = [];
    for (let c = 0; c < size; c++) {
      const i = r * size + c;
      row.push(
        Markup.button.callback(
          renderCell(board[i]),
          gameOver ? 'ignore' : `${prefix}_${gameId}_${i}`
        )
      );
    }
    rows.push(row);
  }

  extraRows.forEach(row => rows.push(row));
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
      Markup.button.callback('4x4', `${prefix}_4`),
      Markup.button.callback('5x5', `${prefix}_5`)
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

function groupJoinKeyboard(userId, size, gameId) {
  const user = getUser(userId);
  const lang = user?.language || 'tr';

  return Markup.inlineKeyboard([
    [
      Markup.button.callback(texts[lang].join, `group_join_${gameId}`)
    ],
    [
      Markup.button.callback(texts[lang].backMenu, 'back_menu')
    ]
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
    [
      Markup.button.callback(texts[lang].backMenu, 'back_menu')
    ]
  ];
}

function groupAfterGameButtons(userId, gameId) {
  const user = getUser(userId);
  const lang = user?.language || 'tr';

  return [
    [
      Markup.button.callback(texts[lang].rematch, `group_rematch_${gameId}`)
    ]
  ];
}

function findUserGroupGamesInChat(chatId, userId) {
  return [...groupGames.values()].filter(
    g =>
      g.chatId === chatId &&
      !g.deleted &&
      [g.playerX?.id, g.playerO?.id].includes(userId) &&
      ['pending', 'active', 'finished'].includes(g.type)
  );
}

function findCancelableGameForUser(chatId, userId) {
  return [...groupGames.values()].find(
    g =>
      g.chatId === chatId &&
      !g.deleted &&
      [g.playerX?.id, g.playerO?.id].includes(userId) &&
      ['pending', 'active', 'finished'].includes(g.type)
  );
}

// ==============================
// AI
// ==============================

function randomMove(board) {
  const empty = board.map((v, i) => v === '' ? i : null).filter(v => v !== null);
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

  const game = findCancelableGameForUser(chatId, userId);
  if (game) {
    groupGames.delete(game.gameId);
    return ctx.reply(`🛑 Oyun #${game.gameId} iptal edildi.`, mainMenu(userId));
  }

  return ctx.reply(t(userId, 'noActiveGame'));
});

bot.command('groupgame', async (ctx) => {
  ensureUser(ctx.from);

  if (!['group', 'supergroup'].includes(ctx.chat.type)) {
    return ctx.reply(t(ctx.from.id, 'onlyGroups'));
  }

  const mention = ctx.message.text.split(' ')[1] || null;
  if (mention && !mention.startsWith('@')) {
    return ctx.reply(t(ctx.from.id, 'inviteExample'));
  }

  await ctx.reply(t(ctx.from.id, 'selectGroupBoard'), boardSizeKeyboard('size_group'));
});

// ==============================
// MENU ACTIONS
// ==============================

bot.action('menu_newgame', async (ctx) => {
  ensureUser(ctx.from);
  await ctx.editMessageText(t(ctx.from.id, 'chooseBoardSize'), boardSizeKeyboard('size_single'));
  await ctx.answerCbQuery();
});

bot.action('menu_groupgame', async (ctx) => {
  ensureUser(ctx.from);

  if (!['group', 'supergroup'].includes(ctx.chat.type)) {
    await ctx.editMessageText(
      t(ctx.from.id, 'startGroupOnly'),
      Markup.inlineKeyboard([
        [Markup.button.url(t(ctx.from.id, 'menuAddGroup'), ADD_GROUP_LINK)],
        [Markup.button.callback(t(ctx.from.id, 'backMenu'), 'back_menu')]
      ])
    );
    return ctx.answerCbQuery();
  }

  await ctx.editMessageText(t(ctx.from.id, 'selectGroupBoard'), boardSizeKeyboard('size_group'));
  await ctx.answerCbQuery();
});

bot.action('menu_stats', async (ctx) => {
  ensureUser(ctx.from);
  const user = getUser(ctx.from.id);
  await ctx.editMessageText(t(ctx.from.id, 'stats', user), mainMenu(ctx.from.id));
  await ctx.answerCbQuery();
});

bot.action('menu_top', async (ctx) => {
  ensureUser(ctx.from);
  await ctx.editMessageText(buildLeaderboardText(ctx.from.id), mainMenu(ctx.from.id));
  await ctx.answerCbQuery();
});

bot.action('menu_lang', async (ctx) => {
  ensureUser(ctx.from);
  await ctx.editMessageText(t(ctx.from.id, 'languageChoose'), languageKeyboard());
  await ctx.answerCbQuery();
});

bot.action('menu_profile', async (ctx) => {
  ensureUser(ctx.from);
  await ctx.editMessageText(getProfileText(ctx.from.id), mainMenu(ctx.from.id));
  await ctx.answerCbQuery();
});

bot.action('menu_cancel', async (ctx) => {
  ensureUser(ctx.from);
  const userId = ctx.from.id;
  const chatId = ctx.chat.id;

  if (singleGames.has(userId)) {
    singleGames.delete(userId);
    await ctx.editMessageText(t(userId, 'gameCancelled'), mainMenu(userId));
    return ctx.answerCbQuery();
  }

  const game = findCancelableGameForUser(chatId, userId);
  if (game) {
    groupGames.delete(game.gameId);
    await ctx.editMessageText(`🛑 Oyun #${game.gameId} iptal edildi.`, mainMenu(userId));
    return ctx.answerCbQuery();
  }

  await ctx.answerCbQuery(t(userId, 'noActiveGame'));
});

bot.action('back_menu', async (ctx) => {
  ensureUser(ctx.from);
  await ctx.editMessageText(t(ctx.from.id, 'welcome'), mainMenu(ctx.from.id));
  await ctx.answerCbQuery();
});

// ==============================
// LANGUAGE
// ==============================

bot.action('lang_tr', async (ctx) => {
  ensureUser(ctx.from);
  setLanguage(ctx.from.id, 'tr');
  await ctx.editMessageText(texts.tr.langSetTr, mainMenu(ctx.from.id));
  await ctx.answerCbQuery();
});

bot.action('lang_en', async (ctx) => {
  ensureUser(ctx.from);
  setLanguage(ctx.from.id, 'en');
  await ctx.editMessageText(texts.en.langSetEn, mainMenu(ctx.from.id));
  await ctx.answerCbQuery();
});

// ==============================
// SINGLEPLAYER
// ==============================

bot.action(/^size_single_(3|4|5)$/, async (ctx) => {
  ensureUser(ctx.from);
  const size = Number(ctx.match[1]);
  await ctx.editMessageText(t(ctx.from.id, 'chooseDifficulty'), difficultyKeyboard(ctx.from.id, size));
  await ctx.answerCbQuery();
});

bot.action(/^diff_(3|4|5)_(easy|medium|hard)$/, async (ctx) => {
  ensureUser(ctx.from);
  const size = Number(ctx.match[1]);
  const difficulty = ctx.match[2];
  const userId = ctx.from.id;

  singleGames.set(userId, {
    size,
    board: createBoard(size),
    difficulty,
    gameOver: false
  });

  await ctx.editMessageText(
    `${t(userId, 'gameStarted')}\n\n🎲 Tahta: ${size}x${size}`,
    boardKeyboard(createBoard(size), size, 'singlemove', 'single')
  );
  await ctx.answerCbQuery();
});

bot.action(/^singlemove_single_(\d+)$/, async (ctx) => {
  ensureUser(ctx.from);

  const userId = ctx.from.id;
  const game = singleGames.get(userId);

  if (!game || game.gameOver) {
    await ctx.answerCbQuery(t(userId, 'noActiveGame'));
    return;
  }

  const index = Number(ctx.match[1]);

  if (game.board[index] !== '') {
    await ctx.answerCbQuery(t(userId, 'cellBusy'));
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

    await ctx.editMessageText(
      `${text}\n\n🎲 Tahta: ${game.size}x${game.size}`,
      boardKeyboard(
        game.board,
        game.size,
        'singlemove',
        'single',
        true,
        singleAfterGameButtons(userId, game.size, game.difficulty)
      )
    );

    await ctx.answerCbQuery();
    return;
  }

  const move = getAiMove(game.board, game.size, game.difficulty);
  if (move !== null && move !== undefined) {
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

    await ctx.editMessageText(
      `${text}\n\n🎲 Tahta: ${game.size}x${game.size}`,
      boardKeyboard(
        game.board,
        game.size,
        'singlemove',
        'single',
        true,
        singleAfterGameButtons(userId, game.size, game.difficulty)
      )
    );

    await ctx.answerCbQuery();
    return;
  }

  await ctx.editMessageText(
    `${t(userId, 'yourTurn')}\n\n🎲 Tahta: ${game.size}x${game.size}`,
    boardKeyboard(game.board, game.size, 'singlemove', 'single')
  );

  await ctx.answerCbQuery();
});

bot.action(/^rematch_single_(3|4|5)_(easy|medium|hard)$/, async (ctx) => {
  ensureUser(ctx.from);
  const size = Number(ctx.match[1]);
  const difficulty = ctx.match[2];
  const userId = ctx.from.id;

  singleGames.set(userId, {
    size,
    board: createBoard(size),
    difficulty,
    gameOver: false
  });

  await ctx.editMessageText(
    `${t(userId, 'gameStarted')}\n\n🎲 Tahta: ${size}x${size}`,
    boardKeyboard(createBoard(size), size, 'singlemove', 'single')
  );

  await ctx.answerCbQuery();
});

// ==============================
// GROUP
// ==============================

bot.action(/^size_group_(3|4|5)$/, async (ctx) => {
  ensureUser(ctx.from);

  if (!['group', 'supergroup'].includes(ctx.chat.type)) {
    await ctx.answerCbQuery(t(ctx.from.id, 'onlyGroups'));
    return;
  }

  const size = Number(ctx.match[1]);
  const chatId = ctx.chat.id;

  const myGames = findUserGroupGamesInChat(chatId, ctx.from.id);
  if (myGames.some(g => g.type === 'pending' || g.type === 'active')) {
    await ctx.answerCbQuery(t(ctx.from.id, 'gameAlreadyExists'));
    return;
  }

  const gameId = generateGameId(chatId);

  groupGames.set(gameId, {
    gameId,
    chatId,
    type: 'pending',
    size,
    board: createBoard(size),
    playerX: ctx.from,
    playerO: null,
    invitedUserId: null,
    invitedUsername: null,
    turn: 'X',
    gameOver: false,
    rematch: null
  });

  await ctx.editMessageText(
    t(ctx.from.id, 'groupGameCreated', getDisplayName(ctx.from), size, gameId),
    groupJoinKeyboard(ctx.from.id, size, gameId)
  );

  await ctx.answerCbQuery();
});

bot.action(/^group_join_(.+)$/, async (ctx) => {
  ensureUser(ctx.from);

  const gameId = ctx.match[1];
  const game = groupGames.get(gameId);

  if (!game) {
    await ctx.answerCbQuery(t(ctx.from.id, 'noActiveGame'));
    return;
  }

  if (game.type !== 'pending') {
    await ctx.answerCbQuery(t(ctx.from.id, 'gameAlreadyExists'));
    return;
  }

  if (game.playerX.id === ctx.from.id) {
    await ctx.answerCbQuery(t(ctx.from.id, 'selfJoinError'));
    return;
  }

  if (game.invitedUserId && game.invitedUserId !== ctx.from.id) {
    await ctx.answerCbQuery(t(ctx.from.id, 'onlyInvitedCanJoin'));
    return;
  }

  game.playerO = ctx.from;
  game.type = 'active';
  game.turn = 'X';
  game.rematch = null;

  const xName = getDisplayName(game.playerX);
  const oName = getDisplayName(game.playerO);
  const turnName = getDisplayName(game.playerX);

  await ctx.editMessageText(
    t(game.playerX.id, 'joinedGame', xName, oName, turnName, game.size, game.gameId),
    boardKeyboard(game.board, game.size, 'groupmove', game.gameId)
  );

  await ctx.answerCbQuery();
});

bot.action(/^groupmove_(.+)_(\d+)$/, async (ctx) => {
  ensureUser(ctx.from);

  const gameId = ctx.match[1];
  const index = Number(ctx.match[2]);
  const game = groupGames.get(gameId);

  if (!game || game.type !== 'active' || game.gameOver) {
    await ctx.answerCbQuery(t(ctx.from.id, 'noActiveGame'));
    return;
  }

  const allPlayers = [game.playerX.id, game.playerO.id];
  if (!allPlayers.includes(ctx.from.id)) {
    await ctx.answerCbQuery(t(ctx.from.id, 'notYourGame'));
    return;
  }

  const currentPlayerId = game.turn === 'X' ? game.playerX.id : game.playerO.id;
  if (ctx.from.id !== currentPlayerId) {
    await ctx.answerCbQuery(t(ctx.from.id, 'notYourTurn'));
    return;
  }

  if (game.board[index] !== '') {
    await ctx.answerCbQuery(t(ctx.from.id, 'cellBusy'));
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

      await ctx.editMessageText(
        `${t(game.playerX.id, 'playerXWin', getDisplayName(game.playerX))}\n\n🎲 Oyun #${game.gameId}\nTahta: ${game.size}x${game.size}`,
        boardKeyboard(
          game.board,
          game.size,
          'groupmove',
          game.gameId,
          true,
          groupAfterGameButtons(game.playerX.id, game.gameId)
        )
      );
    } else if (result === 'O') {
      addMultiResult(game.playerO.id, 'win');
      addMultiResult(game.playerX.id, 'loss');

      await ctx.editMessageText(
        `${t(game.playerO.id, 'playerOWin', getDisplayName(game.playerO))}\n\n🎲 Oyun #${game.gameId}\nTahta: ${game.size}x${game.size}`,
        boardKeyboard(
          game.board,
          game.size,
          'groupmove',
          game.gameId,
          true,
          groupAfterGameButtons(game.playerO.id, game.gameId)
        )
      );
    } else {
      addMultiResult(game.playerX.id, 'draw');
      addMultiResult(game.playerO.id, 'draw');

      await ctx.editMessageText(
        `${t(game.playerX.id, 'gameDraw')}\n\n🎲 Oyun #${game.gameId}\nTahta: ${game.size}x${game.size}`,
        boardKeyboard(
          game.board,
          game.size,
          'groupmove',
          game.gameId,
          true,
          groupAfterGameButtons(game.playerX.id, game.gameId)
        )
      );
    }

    await ctx.answerCbQuery();
    return;
  }

  game.turn = game.turn === 'X' ? 'O' : 'X';
  const nextPlayer = game.turn === 'X' ? game.playerX : game.playerO;
  const nextSymbol = game.turn === 'X' ? '❌' : '⭕';

  await ctx.editMessageText(
    t(ctx.from.id, 'turnText', getDisplayName(nextPlayer), nextSymbol, game.gameId),
    boardKeyboard(game.board, game.size, 'groupmove', game.gameId)
  );

  await ctx.answerCbQuery();
});

bot.action(/^group_rematch_(.+)$/, async (ctx) => {
  ensureUser(ctx.from);

  const gameId = ctx.match[1];
  const game = groupGames.get(gameId);

  if (!game || game.type !== 'finished') {
    await ctx.answerCbQuery(t(ctx.from.id, 'noActiveGame'));
    return;
  }

  if (![game.playerX.id, game.playerO.id].includes(ctx.from.id)) {
    await ctx.answerCbQuery(t(ctx.from.id, 'notYourGame'));
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

    await ctx.editMessageText(
      `${t(ctx.from.id, 'rematchAccepted')}\n\n${t(ctx.from.id, 'joinedGame', getDisplayName(game.playerX), getDisplayName(game.playerO), getDisplayName(game.playerX), game.size, game.gameId)}`,
      boardKeyboard(game.board, game.size, 'groupmove', game.gameId)
    );

    await ctx.answerCbQuery();
    return;
  }

  await ctx.answerCbQuery(t(ctx.from.id, 'rematchWaiting'));
});

// ==============================
// MENTION BASED INVITE
// ==============================

bot.on('text', async (ctx, next) => {
  try {
    ensureUser(ctx.from);

    const text = ctx.message.text || '';
    if (!text.startsWith('/groupgame')) return next();

    if (!['group', 'supergroup'].includes(ctx.chat.type)) {
      return;
    }

    const parts = text.trim().split(/\s+/);
    const mention = parts[1];

    if (!mention || !mention.startsWith('@')) {
      return;
    }

    const chatId = ctx.chat.id;
    const myGames = findUserGroupGamesInChat(chatId, ctx.from.id);
    if (myGames.some(g => g.type === 'pending' || g.type === 'active')) {
      await ctx.reply(t(ctx.from.id, 'gameAlreadyExists'));
      return;
    }

    await ctx.reply(
      t(ctx.from.id, 'selectGroupBoard'),
      Markup.inlineKeyboard([
        [
          Markup.button.callback(`3x3 | ${mention}`, `size_group_invite_3_${mention.slice(1)}`),
          Markup.button.callback(`4x4 | ${mention}`, `size_group_invite_4_${mention.slice(1)}`)
        ],
        [
          Markup.button.callback(`5x5 | ${mention}`, `size_group_invite_5_${mention.slice(1)}`)
        ],
        [
          Markup.button.callback(t(ctx.from.id, 'backMenu'), 'back_menu')
        ]
      ])
    );
  } catch (e) {
    console.error(e);
  }
});

bot.action(/^size_group_invite_(3|4|5)_(.+)$/, async (ctx) => {
  ensureUser(ctx.from);

  const size = Number(ctx.match[1]);
  const username = ctx.match[2];
  const chatId = ctx.chat.id;

  if (!['group', 'supergroup'].includes(ctx.chat.type)) {
    await ctx.answerCbQuery(t(ctx.from.id, 'onlyGroups'));
    return;
  }

  const myGames = findUserGroupGamesInChat(chatId, ctx.from.id);
  if (myGames.some(g => g.type === 'pending' || g.type === 'active')) {
    await ctx.answerCbQuery(t(ctx.from.id, 'gameAlreadyExists'));
    return;
  }

  const gameId = generateGameId(chatId);

  groupGames.set(gameId, {
    gameId,
    chatId,
    type: 'pending',
    size,
    board: createBoard(size),
    playerX: ctx.from,
    playerO: null,
    invitedUserId: null,
    invitedUsername: username.toLowerCase(),
    turn: 'X',
    gameOver: false,
    rematch: null
  });

  await ctx.editMessageText(
    t(ctx.from.id, 'invitedText', getDisplayName(ctx.from), '@' + username, size, gameId),
    Markup.inlineKeyboard([
      [Markup.button.callback(t(ctx.from.id, 'join'), `group_join_invited_${gameId}`)],
      [Markup.button.callback(t(ctx.from.id, 'backMenu'), 'back_menu')]
    ])
  );

  await ctx.answerCbQuery();
});

bot.action(/^group_join_invited_(.+)$/, async (ctx) => {
  ensureUser(ctx.from);

  const gameId = ctx.match[1];
  const game = groupGames.get(gameId);

  if (!game) {
    await ctx.answerCbQuery(t(ctx.from.id, 'noActiveGame'));
    return;
  }

  if (game.type !== 'pending') {
    await ctx.answerCbQuery(t(ctx.from.id, 'gameAlreadyExists'));
    return;
  }

  if (game.playerX.id === ctx.from.id) {
    await ctx.answerCbQuery(t(ctx.from.id, 'selfJoinError'));
    return;
  }

  const currentUsername = (ctx.from.username || '').toLowerCase();
  if (game.invitedUsername && currentUsername !== game.invitedUsername) {
    await ctx.answerCbQuery(t(ctx.from.id, 'onlyInvitedCanJoin'));
    return;
  }

  game.playerO = ctx.from;
  game.type = 'active';
  game.turn = 'X';
  game.rematch = null;

  await ctx.editMessageText(
    t(ctx.from.id, 'joinedGame', getDisplayName(game.playerX), getDisplayName(game.playerO), getDisplayName(game.playerX), game.size, game.gameId),
    boardKeyboard(game.board, game.size, 'groupmove', game.gameId)
  );

  await ctx.answerCbQuery();
});

// ==============================
// IGNORE
// ==============================

bot.action('ignore', async (ctx) => {
  await ctx.answerCbQuery();
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

bot.launch();
console.log('✅ Bot çalışıyor');

process.once('SIGINT', () => bot.stop('SIGINT'));
process.once('SIGTERM', () => bot.stop('SIGTERM'));
