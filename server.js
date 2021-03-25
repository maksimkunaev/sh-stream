const fs = require('fs');
const path = require('path');
const express = require('express');
const bodyParser = require('body-parser');
const app = express();
const httpServer = require('http').createServer(app);
const { SocketService } = require('./socket-service.js');
const { BotService } = require('./telegram-bot-service.js');
const { bot_plugins, client_plugings } = require('./plugins.js');
const PORT = process.env.PORT || 8000;

app.use(express.static('static'));
app.get('/', (req, res) => {
  const htmlPath = path.join(__dirname, '/static/index.html');
  res.sendFile(htmlPath);
});

app.use(bodyParser.urlencoded({ extended: true }));
app.use(bodyParser.json({ limit: '50MB', type: 'application/json' }));

let fileStream = null;

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
    if (fileStream) fileStream.end();
    fileStream = null;

    return res.json({ success: true });
  } catch (error) {
    console.log(error);
    return res.json({ success: false });
  }
});

httpServer.listen(PORT);

const wsInstanse = new SocketService(require('socket.io')(httpServer));
const botInstanse = new BotService();

botInstanse.set_plugins(wsInstanse, bot_plugins);
wsInstanse.set_plugins(botInstanse, client_plugings);
