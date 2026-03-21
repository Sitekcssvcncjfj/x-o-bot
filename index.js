const { Telegraf, Markup } = require('telegraf');
const fs = require('fs');
const path = require('path');

const BOT_TOKEN = process.env.BOT_TOKEN || '8722669683:AAHTNuh4soLWzGZmiywLzu9UwjRMsJZPgzQ';
const DATA_DIR = process.env.DATA_DIR || path.join(__dirname, 'data');
const DATA_FILE = path.join(DATA_DIR, 'db.json');

const bot = new Telegraf(BOT_TOKEN);

if (!fs.existsSync(DATA_DIR)) {
  fs.mkdirSync(DATA_DIR, { recursive: true });
}

if (!fs.existsSync(DATA_FILE)) {
  fs.writeFileSync(
    DATA_FILE,
    JSON.stringify({ users: {} }, null, 2)
  );
}

function loadDB() {
  try {
    return JSON.parse(fs.readFileSync(DATA_FILE, 'utf8'));
  } catch (e) {
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
    .map((u) => ({
      ...u,
      totalWins: u.wins + u.multiplayerWins,
      totalLosses: u.losses + u.multiplayerLosses,
      totalDraws: u.draws + u.multiplayerDraws,
      points: (u.wins + u.multiplayerWins) * 3 + (u.draws + u.multiplayerDraws)
    }))
    .sort((a, b) => b.points - a.points);
}

const texts = {
  tr: {
    start:
`Merhaba! Ben XO botuyum.

Komutlar:
/newgame - Botla yeni oyun
/groupgame - Grupta 2 oyunculu oyun
/stats - İstatistiklerin
/top - Liderlik tablosu
/language - Dil seç`,
    chooseDifficulty: 'Zorluk seç:',
    gameStarted: 'Oyun başladı! Sen X’sin.',
    yourTurn: 'Senin sıran:',
    noActiveGame: 'Aktif oyun yok.',
    cellBusy: 'Bu hücre dolu.',
    youWin: '🎉 Tebrikler, kazandın!',
    botWin: '🤖 Bot kazandı!',
    draw: '🤝 Berabere!',
    newGame: '🔄 Yeni Oyun',
    easy: '🟢 Kolay',
    medium: '🟡 Orta',
    hard: '🔴 Zor',
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
    topTitle: '🏆 Liderlik Tablosu',
    languageChoose: 'Dil seç:',
    langSetTr: 'Dil Türkçe olarak ayarlandı.',
    langSetEn: 'Language set to English.',
    onlyGroups: 'Bu komut sadece gruplarda kullanılabilir.',
    groupGameCreated: (name) =>
`🎮 ${name} bir oyun başlattı!
Katılmak için aşağıdaki butona bas.`,
    join: '✅ Katıl',
    gameAlreadyExists: 'Bu grupta zaten aktif veya bekleyen bir oyun var.',
    joinedGame: (xName, oName, turnName) =>
`👥 2 Oyunculu XO başladı!

❌ X: ${xName}
⭕ O: ${oName}

İlk sıra: ${turnName}`,
    notYourTurn: 'Sıra sende değil.',
    notYourGame: 'Bu oyunda değilsin.',
    playerXWin: (name) => `🎉 ${name} kazandı! (X)`,
    playerOWin: (name) => `🎉 ${name} kazandı! (O)`,
    gameDraw: '🤝 Oyun berabere bitti!',
    turnText: (name, symbol) => `Sıra: ${name} (${symbol})`,
    leaderboardEmpty: 'Henüz veri yok.'
  },
  en: {
    start:
`Hello! I am XO bot.

Commands:
/newgame - New game vs bot
/groupgame - Create 2-player game in group
/stats - Your stats
/top - Leaderboard
/language - Choose language`,
    chooseDifficulty: 'Choose difficulty:',
    gameStarted: 'Game started! You are X.',
    yourTurn: 'Your turn:',
    noActiveGame: 'No active game.',
    cellBusy: 'This cell is already occupied.',
    youWin: '🎉 Congratulations, you won!',
    botWin: '🤖 Bot won!',
    draw: '🤝 Draw!',
    newGame: '🔄 New Game',
    easy: '🟢 Easy',
    medium: '🟡 Medium',
    hard: '🔴 Hard',
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
    topTitle: '🏆 Leaderboard',
    languageChoose: 'Choose language:',
    langSetTr: 'Dil Türkçe olarak ayarlandı.',
    langSetEn: 'Language set to English.',
    onlyGroups: 'This command can only be used in groups.',
    groupGameCreated: (name) =>
`🎮 ${name} started a game!
Press the button below to join.`,
    join: '✅ Join',
    gameAlreadyExists: 'There is already an active or pending game in this group.',
    joinedGame: (xName, oName, turnName) =>
`👥 Multiplayer XO started!

❌ X: ${xName}
⭕ O: ${oName}

First turn: ${turnName}`,
    notYourTurn: 'It is not your turn.',
    notYourGame: 'You are not part of this game.',
    playerXWin: (name) => `🎉 ${name} won! (X)`,
    playerOWin: (name) => `🎉 ${name} won! (O)`,
    gameDraw: '🤝 The game ended in a draw!',
    turnText: (name, symbol) => `Turn: ${name} (${symbol})`,
    leaderboardEmpty: 'No data yet.'
  }
};

function t(userId, key, ...args) {
  const user = getUser(userId);
  const lang = user?.language || 'tr';
  const value = texts[lang][key];
  return typeof value === 'function' ? value(...args) : value;
}

const singleGames = new Map();
const groupGames = new Map();

function checkWinner(board) {
  const wins = [
    [0, 1, 2],
    [3, 4, 5],
    [6, 7, 8],
    [0, 3, 6],
    [1, 4, 7],
    [2, 5, 8],
    [0, 4, 8],
    [2, 4, 6]
  ];

  for (const [a, b, c] of wins) {
    if (board[a] && board[a] === board[b] && board[a] === board[c]) {
      return board[a];
    }
  }

  if (board.every((cell) => cell !== '')) return 'draw';
  return null;
}

function aiEasy(board) {
  const empty = board.map((c, i) => c === '' ? i : null).filter((v) => v !== null);
  return empty[Math.floor(Math.random() * empty.length)];
}

function aiMedium(board) {
  for (let i = 0; i < 9; i++) {
    if (board[i] === '') {
      const test = [...board];
      test[i] = 'O';
      if (checkWinner(test) === 'O') return i;
    }
  }

  for (let i = 0; i < 9; i++) {
    if (board[i] === '') {
      const test = [...board];
      test[i] = 'X';
      if (checkWinner(test) === 'X') return i;
    }
  }

  if (board[4] === '') return 4;

  const corners = [0, 2, 6, 8].filter((i) => board[i] === '');
  if (corners.length) {
    return corners[Math.floor(Math.random() * corners.length)];
  }

  return aiEasy(board);
}

function aiHard(board) {
  function minimax(b, depth, isMax) {
    const result = checkWinner(b);

    if (result === 'O') return 10 - depth;
    if (result === 'X') return depth - 10;
    if (result === 'draw') return 0;

    if (isMax) {
      let best = -Infinity;
      for (let i = 0; i < 9; i++) {
        if (b[i] === '') {
          b[i] = 'O';
          best = Math.max(best, minimax(b, depth + 1, false));
          b[i] = '';
        }
      }
      return best;
    } else {
      let best = Infinity;
      for (let i = 0; i < 9; i++) {
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

  for (let i = 0; i < 9; i++) {
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

const aiMap = {
  easy: aiEasy,
  medium: aiMedium,
  hard: aiHard
};

function singleDifficultyKeyboard(userId) {
  const user = getUser(userId);
  const lang = user?.language || 'tr';

  return Markup.inlineKeyboard([
    [
      Markup.button.callback(texts[lang].easy, 'diff_easy'),
      Markup.button.callback(texts[lang].medium, 'diff_medium'),
      Markup.button.callback(texts[lang].hard, 'diff_hard')
    ]
  ]);
}

function boardKeyboard(board, prefix, gameOver = false, extraRows = []) {
  const rows = [];

  for (let r = 0; r < 3; r++) {
    const row = [];
    for (let c = 0; c < 3; c++) {
      const i = r * 3 + c;
      row.push(
        Markup.button.callback(
          board[i] || ' ',
          gameOver ? 'ignore' : `${prefix}_${i}`
        )
      );
    }
    rows.push(row);
  }

  for (const row of extraRows) {
    rows.push(row);
  }

  return Markup.inlineKeyboard(rows);
}

function languageKeyboard() {
  return Markup.inlineKeyboard([
    [
      Markup.button.callback('🇹🇷 Türkçe', 'lang_tr'),
      Markup.button.callback('🇬🇧 English', 'lang_en')
    ]
  ]);
}

function groupJoinKeyboard(userId) {
  const user = getUser(userId);
  const lang = user?.language || 'tr';

  return Markup.inlineKeyboard([
    [Markup.button.callback(texts[lang].join, 'group_join')]
  ]);
}

function getDisplayName(user) {
  if (!user) return 'User';
  return user.username ? `@${user.username}` : (user.first_name || 'User');
}

function getCurrentPlayerName(game) {
  return game.turn === 'X'
    ? getDisplayName(game.playerX)
    : getDisplayName(game.playerO);
}

function getCurrentPlayerId(game) {
  return game.turn === 'X' ? game.playerX.id : game.playerO.id;
}

function buildLeaderboardText(requesterId) {
  const list = getLeaderboard();
  if (!list.length) return t(requesterId, 'leaderboardEmpty');

  let text = `${t(requesterId, 'topTitle')}\n\n`;

  list.slice(0, 10).forEach((u, index) => {
    const name = u.username ? `@${u.username}` : u.name;
    text += `${index + 1}. ${name} — ${u.points} puan\n`;
    text += `   🏆 ${u.totalWins} | ❌ ${u.totalLosses} | 🤝 ${u.totalDraws}\n`;
  });

  return text;
}

bot.start(async (ctx) => {
  ensureUser(ctx.from);
  await ctx.reply(t(ctx.from.id, 'start'));
});

bot.command('language', async (ctx) => {
  ensureUser(ctx.from);
  await ctx.reply(t(ctx.from.id, 'languageChoose'), languageKeyboard());
});

bot.command('stats', async (ctx) => {
  ensureUser(ctx.from);
  const user = getUser(ctx.from.id);
  await ctx.reply(t(ctx.from.id, 'stats', user));
});

bot.command('top', async (ctx) => {
  ensureUser(ctx.from);
  await ctx.reply(buildLeaderboardText(ctx.from.id));
});

bot.command('newgame', async (ctx) => {
  ensureUser(ctx.from);
  await ctx.reply(t(ctx.from.id, 'chooseDifficulty'), singleDifficultyKeyboard(ctx.from.id));
});

bot.command('groupgame', async (ctx) => {
  ensureUser(ctx.from);

  if (!['group', 'supergroup'].includes(ctx.chat.type)) {
    return ctx.reply(t(ctx.from.id, 'onlyGroups'));
  }

  const chatId = ctx.chat.id;

  if (groupGames.has(chatId)) {
    return ctx.reply(t(ctx.from.id, 'gameAlreadyExists'));
  }

  const creator = ctx.from;

  await ctx.reply(
    t(ctx.from.id, 'groupGameCreated', getDisplayName(creator)),
    groupJoinKeyboard(ctx.from.id)
  );

  groupGames.set(chatId, {
    type: 'pending',
    chatId,
    board: Array(9).fill(''),
    playerX: creator,
    playerO: null,
    turn: 'X',
    gameOver: false
  });
});

bot.action('lang_tr', async (ctx) => {
  ensureUser(ctx.from);
  setLanguage(ctx.from.id, 'tr');
  await ctx.editMessageText(texts.tr.langSetTr);
  await ctx.answerCbQuery();
});

bot.action('lang_en', async (ctx) => {
  ensureUser(ctx.from);
  setLanguage(ctx.from.id, 'en');
  await ctx.editMessageText(texts.en.langSetEn);
  await ctx.answerCbQuery();
});

bot.action(/^diff_(easy|medium|hard)$/, async (ctx) => {
  ensureUser(ctx.from);
  const difficulty = ctx.match[1];
  const userId = ctx.from.id;

  singleGames.set(userId, {
    board: Array(9).fill(''),
    difficulty,
    gameOver: false
  });

  await ctx.editMessageText(
    t(userId, 'gameStarted'),
    boardKeyboard(Array(9).fill(''), 'singlemove')
  );

  await ctx.answerCbQuery();
});

bot.action(/^singlemove_(\d+)$/, async (ctx) => {
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

  let result = checkWinner(game.board);

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
      text,
      boardKeyboard(
        game.board,
        'singlemove',
        true,
        [[Markup.button.callback(t(userId, 'newGame'), 'single_newgame')]]
      )
    );
    await ctx.answerCbQuery();
    return;
  }

  const move = aiMap[game.difficulty](game.board);
  game.board[move] = 'O';

  result = checkWinner(game.board);

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
      text,
      boardKeyboard(
        game.board,
        'singlemove',
        true,
        [[Markup.button.callback(t(userId, 'newGame'), 'single_newgame')]]
      )
    );
    await ctx.answerCbQuery();
    return;
  }

  await ctx.editMessageText(
    t(userId, 'yourTurn'),
    boardKeyboard(game.board, 'singlemove')
  );
  await ctx.answerCbQuery();
});

bot.action('single_newgame', async (ctx) => {
  ensureUser(ctx.from);
  await ctx.editMessageText(
    t(ctx.from.id, 'chooseDifficulty'),
    singleDifficultyKeyboard(ctx.from.id)
  );
  await ctx.answerCbQuery();
});

bot.action('group_join', async (ctx) => {
  ensureUser(ctx.from);

  const chatId = ctx.chat.id;
  const game = groupGames.get(chatId);

  if (!game) {
    await ctx.answerCbQuery(t(ctx.from.id, 'noActiveGame'));
    return;
  }

  if (game.type !== 'pending') {
    await ctx.answerCbQuery(t(ctx.from.id, 'gameAlreadyExists'));
    return;
  }

  if (game.playerX.id === ctx.from.id) {
    await ctx.answerCbQuery('Kendi oyununa katılamazsın.');
    return;
  }

  game.playerO = ctx.from;
  game.type = 'active';
  game.turn = 'X';

  const xName = getDisplayName(game.playerX);
  const oName = getDisplayName(game.playerO);
  const turnName = getCurrentPlayerName(game);

  await ctx.editMessageText(
    t(game.playerX.id, 'joinedGame', xName, oName, turnName),
    boardKeyboard(game.board, 'groupmove')
  );

  await ctx.answerCbQuery();
});

bot.action(/^groupmove_(\d+)$/, async (ctx) => {
  ensureUser(ctx.from);

  const chatId = ctx.chat.id;
  const game = groupGames.get(chatId);

  if (!game || game.type !== 'active' || game.gameOver) {
    await ctx.answerCbQuery(t(ctx.from.id, 'noActiveGame'));
    return;
  }

  const playerIds = [game.playerX.id, game.playerO.id];
  if (!playerIds.includes(ctx.from.id)) {
    await ctx.answerCbQuery(t(ctx.from.id, 'notYourGame'));
    return;
  }

  const currentPlayerId = getCurrentPlayerId(game);
  if (ctx.from.id !== currentPlayerId) {
    await ctx.answerCbQuery(t(ctx.from.id, 'notYourTurn'));
    return;
  }

  const index = Number(ctx.match[1]);
  if (game.board[index] !== '') {
    await ctx.answerCbQuery(t(ctx.from.id, 'cellBusy'));
    return;
  }

  game.board[index] = game.turn;

  let result = checkWinner(game.board);

  if (result) {
    game.gameOver = true;

    if (result === 'X') {
      addMultiResult(game.playerX.id, 'win');
      addMultiResult(game.playerO.id, 'loss');

      await ctx.editMessageText(
        t(game.playerX.id, 'playerXWin', getDisplayName(game.playerX)),
        boardKeyboard(game.board, 'groupmove', true)
      );
    } else if (result === 'O') {
      addMultiResult(game.playerO.id, 'win');
      addMultiResult(game.playerX.id, 'loss');

      await ctx.editMessageText(
        t(game.playerO.id, 'playerOWin', getDisplayName(game.playerO)),
        boardKeyboard(game.board, 'groupmove', true)
      );
    } else {
      addMultiResult(game.playerX.id, 'draw');
      addMultiResult(game.playerO.id, 'draw');

      await ctx.editMessageText(
        t(game.playerX.id, 'gameDraw'),
        boardKeyboard(game.board, 'groupmove', true)
      );
    }

    groupGames.delete(chatId);
    await ctx.answerCbQuery();
    return;
  }

  game.turn = game.turn === 'X' ? 'O' : 'X';

  await ctx.editMessageText(
    t(ctx.from.id, 'turnText', getCurrentPlayerName(game), game.turn),
    boardKeyboard(game.board, 'groupmove')
  );

  await ctx.answerCbQuery();
});

bot.action('ignore', async (ctx) => {
  await ctx.answerCbQuery();
});

bot.catch((err) => {
  console.error('Bot error:', err);
});

bot.launch();
console.log('✅ Bot çalışıyor');

process.once('SIGINT', () => bot.stop('SIGINT'));
process.once('SIGTERM', () => bot.stop('SIGTERM'));
