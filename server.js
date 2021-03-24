const fs = require('fs');
const path = require('path');
const express = require('express');
const bodyParser = require('body-parser');
const app = express();
const httpServer = require('http').createServer(app);
const { initBot } = require('./telegram-bot.js');
let participantId = null;

app.use(express.static('static'));
app.get('/', (req, res) => {
  const htmlPath = path.join(__dirname, '/static/index.html');
  res.sendFile(htmlPath);
});

app.use(bodyParser.urlencoded({ extended: true }));
app.use(bodyParser.json({ limit: '50MB', type: 'application/json' }));

fileStream = null;

app.post('/start-stream', (req, res) => {
  try {
    const filename = `./videos/${Date.now()}.webm`;
    fileStream = fs.createWriteStream(filename, { flags: 'a' });

    return res.json({ success: true });
  } catch (error) {
    console.log(error);
    return res.json({ success: false });
  }
});

app.post('/chunk', (req, res) => {
  try {
    const { data } = req.body;
    const dataBuffer = Buffer.from(data, 'base64');

    if (fileStream) {
      fileStream.write(dataBuffer);
    }
    return res.json({ success: true });
  } catch (error) {
    console.log(error);
    return res.json({ success: false });
  }
});

app.post('/end-stream', (req, res) => {
  try {
    fileStream.end();
    fileStream = null;

    return res.json({ success: true });
  } catch (error) {
    console.log(error);
    return res.json({ success: false });
  }
});

httpServer.listen(9090);

const io = require('socket.io')(httpServer);
ws(io);

function ws(io) {
  io.on('connection', async connection => {
    const botHandlers = {
      onTextCommand: async (chatId, command, bot) => {
        const from_bot_handlers = {
          send_capture: sendCommandToClient,
          start_stream: sendCommandToClient,
          stop_stream: sendCommandToClient,
          send_video: sendVideoToBot,
        };

        from_bot_handlers[command](bot, chatId, connection, command);
      },
      saveChatId: chatId => (participantId = chatId),
    };

    const bot = initBot(botHandlers);

    connection.on('message', function (msg) {
      let data;

      try {
        data = JSON.parse(msg);
      } catch (e) {
        console.log('Invalid JSON');
        data = {};
      }

      if (data.on_command) {
        const from_client_handlers = {
          send_capture: sendImageToBot,
          start_activity: sendImageToBot,
          send_message: sendMessageToBot,
        };

        const chatId = data.chatId || participantId;

        if (chatId) {
          from_client_handlers[data.on_command](bot, chatId, data);
        }
      }
    });
  });
}

function sendCommandToClient(bot, chatId, socket, command) {
  socket.emit('message', JSON.stringify({ command, chatId }));
}

function sendVideoToBot(bot, chatId) {
  const staticFolder = path.join(__dirname, `./videos`);

  const list = fs
    .readdirSync(staticFolder)
    .filter(filePath => filePath.indexOf('.webm') > -1)
    .map(filePath => {
      const videoPath = path.join(__dirname, `./videos/${filePath}`);
      const stats = fs.statSync(videoPath);

      return {
        path: filePath,
        mtime: stats.mtime,
      };
    })
    .sort((itemA, itemB) => itemB.mtime - itemA.mtime);

  const latestPath = list[0].path; // from latest

  const videoPath = path.join(__dirname, `./videos/${latestPath}`);
  return bot.sendVideo(chatId, videoPath);
}

function sendImageToBot(bot, chatId, data) {
  const imagePath = 'capture.png';
  const base64Data = data.data.replace(/^data:image\/png;base64,/, '');
  fs.writeFileSync(imagePath, base64Data, 'base64');

  bot.sendPhoto(chatId, imagePath);
}

function sendMessageToBot(bot, chatId, data) {
  bot.sendMessage(chatId, data.message);
}
