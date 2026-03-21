require('dotenv').config();
const { Telegraf, Markup } = require('telegraf');

const bot = new Telegraf(process.env.BOT_TOKEN);

// Kullanıcı bazlı oyunları hafızada tutuyoruz
const games = new Map();

function createEmptyBoard() {
  return Array(9).fill('');
}

function checkWinner(board) {
  const wins = [
    [0, 1, 2],
    [3, 4, 5],
    [6, 7, 8],
    [0, 3, 6],
    [1, 4, 7],
    [2, 5, 8],
    [0, 4, 8],
    [2, 4, 6],
  ];

  for (const [a, b, c] of wins) {
    if (board[a] && board[a] === board[b] && board[a] === board[c]) {
      return board[a];
    }
  }

  if (board.every(cell => cell !== '')) {
    return 'draw';
  }

  return null;
}

function getBoardKeyboard(board, gameOver = false) {
  const buttons = [];
  for (let row = 0; row < 3; row++) {
    const rowButtons = [];
    for (let col = 0; col < 3; col++) {
      const index = row * 3 + col;
      const cell = board[index] || ' ';
      rowButtons.push(
        Markup.button.callback(cell, gameOver ? 'ignore' : `move_${index}`)
      );
    }
    buttons.push(rowButtons);
  }

  if (gameOver) {
    buttons.push([Markup.button.callback('Yeni Oyun', 'new_game')]);
  }

  return Markup.inlineKeyboard(buttons);
}

function botMove(board) {
  const emptyIndexes = board
    .map((cell, index) => (cell === '' ? index : null))
    .filter(index => index !== null);

  if (emptyIndexes.length === 0) return board;

  const randomIndex = emptyIndexes[Math.floor(Math.random() * emptyIndexes.length)];
  board[randomIndex] = 'O';
  return board;
}

bot.start(async (ctx) => {
  await ctx.reply(
    'Salam! Mən XO botuyam.\nYeni oyuna başlamaq üçün /newgame yaz.'
  );
});

bot.command('newgame', async (ctx) => {
  const userId = ctx.from.id;

  const board = createEmptyBoard();
  games.set(userId, { board, gameOver: false });

  await ctx.reply(
    'Yeni XO oyunu başladı! Sən X-sən.',
    getBoardKeyboard(board)
  );
});

bot.action('new_game', async (ctx) => {
  const userId = ctx.from.id;

  const board = createEmptyBoard();
  games.set(userId, { board, gameOver: false });

  await ctx.editMessageText(
    'Yeni XO oyunu başladı! Sən X-sən.',
    getBoardKeyboard(board)
  );
});

bot.action(/^move_(\d+)$/, async (ctx) => {
  const userId = ctx.from.id;
  const game = games.get(userId);

  if (!game || game.gameOver) {
    return ctx.answerCbQuery('Aktiv oyun yoxdur. /newgame yaz.');
  }

  const index = Number(ctx.match[1]);

  if (game.board[index] !== '') {
    return ctx.answerCbQuery('Bu xana artıq doludur.');
  }

  game.board[index] = 'X';

  let result = checkWinner(game.board);
  if (result) {
    game.gameOver = true;

    let text = '';
    if (result === 'X') text = 'Təbriklər, qazandın!';
    else if (result === 'O') text = 'Bot qazandı!';
    else text = 'Heç-heçə!';

    await ctx.editMessageText(text, getBoardKeyboard(game.board, true));
    return ctx.answerCbQuery();
  }

  botMove(game.board);

  result = checkWinner(game.board);
  if (result) {
    game.gameOver = true;

    let text = '';
    if (result === 'X') text = 'Təbriklər, qazandın!';
    else if (result === 'O') text = 'Bot qazandı!';
    else text = 'Heç-heçə!';

    await ctx.editMessageText(text, getBoardKeyboard(game.board, true));
    return ctx.answerCbQuery();
  }

  await ctx.editMessageText(
    'Sənin növbəndir:',
    getBoardKeyboard(game.board)
  );
  await ctx.answerCbQuery();
});

bot.action('ignore', async (ctx) => {
  await ctx.answerCbQuery();
});

bot.launch();
console.log('Bot işləyir...');
