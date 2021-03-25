const fs = require('fs');
const path = require('path');

const bot_plugins = {
	send_capture: {
		text: 'Screenshot',
		handler: sendCommandToClient,
	},
	send_video: {
		text: 'Last video',
		handler: sendVideoToBot,
	},
	start_stream: {
		text: 'Start',
		handler: sendCommandToClient,
	},
	stop_stream: {
		text: 'Stop',
		handler: sendCommandToClient,
	},
};

const client_plugings = {
	send_capture: {
		handler: sendCaptureToBot,
	},
	start_activity: {
		handler: sendCaptureToBot,
	},
	send_message: {
		handler: sendMessageToBot,
	},
};

function sendCaptureToBot(botService, wsServise, chatId, data) {
	const imagePath = 'capture.png';
	const base64Data = data.data.replace(/^data:image\/png;base64,/, '');
	fs.writeFileSync(imagePath, base64Data, 'base64');

	botService.sendPhoto(chatId, imagePath);
}

function sendMessageToBot(botService, wsServise, chatId, data) {
	console.log('sendMessageToBot', botService, wsServise, chatId, data);
	botService.sendMessage(chatId, data.message);
}

function sendCommandToClient(wsServise, botService, chatId, command) {
	const { wsClients } = wsServise;

	for (const key in wsClients) {
		wsClient = wsClients[key];
		wsClient.emit('message', JSON.stringify({ chatId, command }));
	}
}

function sendVideoToBot(wsServise, botService, chatId, command) {
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

	return botService.sendVideo(chatId, videoPath);
}

module.exports = {
	bot_plugins,
	client_plugings,
};
