const { Telegraf, Markup } = require('telegraf');

// ==============================
// BURAYA BOT TOKENINI YAZ
const BOT_TOKEN = "8722669683:AAHTNuh4soLWzGZmiywLzu9UwjRMsJZPgzQ";
// ==============================

const bot = new Telegraf(BOT_TOKEN);
const games = new Map();
const stats = new Map();

// ========== AI MOTORLARI ==========

function aiEasy(board) {
  // Kolay: tamamen rastgele
  const empty = board.map((c,i) => c == '' ? i : null).filter(v => v != null);
  return empty[Math.floor(Math.random() * empty.length)];
}

function aiMedium(board) {
  // Orta: kazan, engelle, rastgele

  // 1. Eğer kazanabiliyorsan hemen kazan
  for(let i = 0; i < 9; i++) {
    if(board[i] == '') {
      const test = [...board];
      test[i] = 'O';
      if(checkWinner(test) == 'O') return i;
    }
  }

  // 2. Eğer rakip kazanacaksa hemen engelle
  for(let i = 0; i < 9; i++) {
    if(board[i] == '') {
      const test = [...board];
      test[i] = 'X';
      if(checkWinner(test) == 'X') return i;
    }
  }

  // 3. Rastgele hamle
  const empty = board.map((c,i) => c == '' ? i : null).filter(v => v != null);
  return empty[Math.floor(Math.random() * empty.length)];
}

function aiHard(board) {
  // Zor: Tam minimax algoritması. Asla yenilmez.

  function minimax(board, depth, isMax) {
    const res = checkWinner(board);
    if(res == 'O') return 10 - depth;
    if(res == 'X') return depth - 10;
    if(res == 'draw') return 0;

    if(isMax) {
      let best = -1000;
      for(let i = 0; i < 9; i++) {
        if(board[i] == '') {
          board[i] = 'O';
          best = Math.max(best, minimax(board, depth+1, false));
          board[i] = '';
        }
      }
      return best;
    } else {
      let best = 1000;
      for(let i = 0; i < 9; i++) {
        if(board[i] == '') {
          board[i] = 'X';
          best = Math.min(best, minimax(board, depth+1, true));
          board[i] = '';
        }
      }
      return best;
    }
  }

  let bestMove = -1;
  let bestScore = -1000;

  for(let i = 0; i < 9; i++) {
    if(board[i] == '') {
      board[i] = 'O';
      const score = minimax(board, 0, false);
      board[i] = '';

      if(score > bestScore) {
        bestScore = score;
        bestMove = i;
      }
    }
  }

  return bestMove;
}

const ai = {
  easy: aiEasy,
  medium: aiMedium,
  hard: aiHard
}

// ========== OYUN FONKSIYONLARI ==========

function checkWinner(board) {
  const wins = [[0,1,2],[3,4,5],[6,7,8],[0,3,6],[1,4,7],[2,5,8],[0,4,8],[2,4,6]];
  for(const [a,b,c] of wins) {
    if(board[a] && board[a] == board[b] && board[a] == board[c]) return board[a];
  }
  return board.every(c => c != '') ? 'draw' : null;
}

function getBoardKeyboard(board, gameOver = false) {
  const buttons = [];
  for(let row = 0; row < 3; row++) {
    const rowButtons = [];
    for(let col = 0; col < 3; col++) {
      const i = row * 3 + col;
      rowButtons.push(Markup.button.callback(board[i] || ' ', gameOver ? 'ignore' : `move_${i}`))
    }
    buttons.push(rowButtons);
  }

  if(gameOver) {
    buttons.push([Markup.button.callback('🔄 Yeni Oyun', 'newgame')])
  }

  return Markup.inlineKeyboard(buttons);
}

function difficultyKeyboard() {
  return Markup.inlineKeyboard([
    [
      Markup.button.callback('🟢 Kolay', 'diff_easy'),
      Markup.button.callback('🟡 Orta', 'diff_medium'),
      Markup.button.callback('🔴 Zor', 'diff_hard')
    ]
  ])
}

// ========== BOT KOMUTLARI ==========

bot.start(ctx => {
  ctx.reply(`Salam! Mən XO botuyam.

Özelliklərim:
✅ 3 zorluk seviyəsi
✅ Skor sistemi

Yeni oyuna başlamaq üçün /newgame yaz.`)
})

bot.command('newgame', ctx => {
  ctx.reply('Zorluk seviyəsini seç:', difficultyKeyboard())
})

bot.command('stats', ctx => {
  const s = stats.get(ctx.from.id) || {wins:0, losses:0, draws:0};
  ctx.reply(`📊 Sənin istatistiklərin:

🏆 Qalibiyyət: ${s.wins}
❌ Məğlubiyyət: ${s.losses}
⚖️ Heç-heçə: ${s.draws}`)
})

// ========== ACTIONLAR ==========

bot.action('newgame', ctx => {
  ctx.editMessageText('Zorluk seviyəsini seç:', difficultyKeyboard())
})

bot.action(/^diff_(.*)$/, ctx => {
  const diff = ctx.match[1];
  const userId = ctx.from.id;

  const game = {
    board: Array(9).fill(''),
    difficulty: diff,
    gameOver: false
  }

  games.set(userId, game);

  ctx.editMessageText('Oyun başladı! Sən X-sən.', getBoardKeyboard(game.board))
})

bot.action(/^move_(\d+)$/, async ctx => {
  const userId = ctx.from.id;
  const game = games.get(userId);

  if(!game || game.gameOver) return ctx.answerCbQuery('Aktiv oyun yoxdur');

  const index = Number(ctx.match[1]);

  if(game.board[index] != '') return ctx.answerCbQuery('Bu xana doludur');

  // Oyuncu hamlesi
  game.board[index] = 'X';

  let result = checkWinner(game.board);

  if(result) {
    game.gameOver = true;
    let s = stats.get(userId) || {wins:0, losses:0, draws:0};

    let text = '';
    if(result == 'X') {
      text = '🎉 Təbriklər, qazandın!'
      s.wins++;
    } else if(result == 'O') {
      text = '😔 Bot qazandı!'
      s.losses++;
    } else {
      text = '⚖️ Heç-heçə!'
      s.draws++;
    }

    stats.set(userId, s);
    await ctx.editMessageText(text, getBoardKeyboard(game.board, true));
    return ctx.answerCbQuery();
  }

  // Bot hamlesi
  const botMoveIndex = ai[game.difficulty](game.board);
  game.board[botMoveIndex] = 'O';

  result = checkWinner(game.board);

  if(result) {
    game.gameOver = true;
    let s = stats.get(userId) || {wins:0, losses:0, draws:0};

    let text = '';
    if(result == 'X') {
      text = '🎉 Təbriklər, qazandın!'
      s.wins++;
    } else if(result == 'O') {
      text = '😔 Bot qazandı!'
      s.losses++;
    } else {
      text = '⚖️ Heç-heçə!'
      s.draws++;
    }

    stats.set(userId, s);
    await ctx.editMessageText(text, getBoardKeyboard(game.board, true));
    return ctx.answerCbQuery();
  }

  await ctx.editMessageText('Sənin növbəndir:', getBoardKeyboard(game.board));
  ctx.answerCbQuery();
})

bot.action('ignore', ctx => ctx.answerCbQuery())

// ========== BOTU BASLAT ==========

bot.launch();
console.log('✅ Bot işləyir');
