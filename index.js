require('dotenv').config();
const { Telegraf, Markup } = require('telegraf');

const bot = new Telegraf(process.env.BOT_TOKEN);
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
    [2, 4, 6]
  ];

  for (const [a, b, c] of wins) {
    if (board[a] && board[a] === board[b] && board[a] === board[c]) {
      return board[a];
    }
  }

  if (board.every(cell => cell !== '')) return 'draw';
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
  const empty = board
    .map((cell, index) => (cell === '' ? index : null))
    .filter(v => v !== null);

  if (!empty.length) return;

  const move = empty[Math.floor(Math.random() * empty.length)];
  board[move] = 'O';
}

bot.start((ctx) => {
  ctx.reply('Salam! Yeni oyun üçün /newgame yaz.');
});

bot.command('newgame', (ctx) => {
  const userId = ctx.from.id;
  const board = createEmptyBoard();

  games.set(userId, { board, gameOver: false });

  ctx.reply('Yeni XO oyunu başladı! Sən X-sən.', getBoardKeyboard(board));
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
    await ctx.answerCbQuery('Aktiv oyun yoxdur. /newgame yaz.');
    return;
  }

  const index = Number(ctx.match[1]);

  if (game.board[index] !== '') {
    await ctx.answerCbQuery('Bu xana doludur.');
    return;
  }

  game.board[index] = 'X';

  let result = checkWinner(game.board);
  if (result) {
    game.gameOver = true;
    let text = result === 'X' ? 'Təbriklər, qazandın!' : result === 'O' ? 'Bot qazandı!' : 'Heç-heçə!';
    await ctx.editMessageText(text, getBoardKeyboard(game.board, true));
    await ctx.answerCbQuery();
    return;
  }

  botMove(game.board);

  result = checkWinner(game.board);
  if (result) {
    game.gameOver = true;
    let text = result === 'X' ? 'Təbriklər, qazandın!' : result === 'O' ? 'Bot qazandı!' : 'Heç-heçə!';
    await ctx.editMessageText(text, getBoardKeyboard(game.board, true));
    await ctx.answerCbQuery();
    return;
  }

  await ctx.editMessageText('Sənin növbəndir:', getBoardKeyboard(game.board));
  await ctx.answerCbQuery();
});

bot.action('ignore', async (ctx) => {
  await ctx.answerCbQuery();
});

bot.launch();
console.log('Bot işləyir...');
