const TelegramBot = require('node-telegram-bot-api');
const TOKEN = process.env.BOT_TOKEN;
const bot = new TelegramBot(TOKEN, { polling: true });
const fs = require('fs');
const path = require('path');
const { COMMANDS } = require('./constants.js');
const staticFolder = './videos/';

const text_code = COMMANDS.reduce((acc, command) => {
	return {
		...acc,
		[command.text]: command.code,
	};
}, {});

function splitArrayIntoChunksOfLen(arr, len) {
	let chunks = [],
		i = 0,
		n = arr.length;

	while (i < n) {
		chunks.push(arr.slice(i, (i += len)));
	}
	return chunks;
}

const mappedCommands = COMMANDS.map(command => ({
	...command,
	callback_data: command.code,
}));
const keyboard_commands = splitArrayIntoChunksOfLen(mappedCommands, 2);

let replyOptions = {
	reply_markup: {
		resize_keyboard: true,
		one_time_keyboard: false,
		keyboard: keyboard_commands,
	},
};

const initBot = ({ onTextCommand, saveChatId }) => {
	bot.on('message', (msg, match) => {
		const chatId = msg.chat.id;
		const text = msg.text;

		saveChatId(chatId);

		const COMMAND = text_code[text];

		if (COMMAND) {
			return onTextCommand(chatId, COMMAND, bot);
		}

		bot.sendMessage(
			chatId,
			'Please select one of available options',
			replyOptions
		);
	});

	return bot;
};
module.exports = {
	initBot,
};
