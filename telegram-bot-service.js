const TelegramBot = require('node-telegram-bot-api');
const TOKEN = process.env.BOT_TOKEN;

class BotService {
	constructor() {
		const bot = new TelegramBot(TOKEN, { polling: true });

		this.bot = bot;
		this.participantId = null;
		this.from_bot_handlers = [];
		this.bot.on('message', (msg, match) => this.on_message(msg, match));
	}

	set_plugins(wsInstanse, from_bot_handlers) {
		this.wsInstanse = wsInstanse;
		this.from_bot_handlers = from_bot_handlers;
	}

	on_message(msg, match) {
		const chatId = msg.chat.id;
		const text = msg.text;

		this.participantId = chatId;
		const command = this.text_code[text];

		if (command) {
			return this.from_bot_handlers[command].handler(
				this.wsInstanse,
				this.bot,
				chatId,
				command
			);
		}

		this.bot.sendMessage(
			chatId,
			'Please select one of available options',
			this.reply_options
		);
	}

	get text_code() {
		const mapObject = {};
		for (var key in from_bot_handlers) {
			mapObject[from_bot_handlers[key].text] = key;
		}

		return mapObject;
	}

	get reply_options() {
		const mappedCommands = Object.keys(from_bot_handlers).map(item => ({
			text: from_bot_handlers[item].text,
		}));

		const keyboard_commands = splitArrayIntoChunksOfLen(mappedCommands, 2);

		return {
			reply_markup: {
				resize_keyboard: true,
				one_time_keyboard: true,
				keyboard: keyboard_commands,
			},
		};
	}
}

module.exports = {
	BotService,
};

function splitArrayIntoChunksOfLen(arr, len) {
	let chunks = [],
		i = 0,
		n = arr.length;

	while (i < n) {
		chunks.push(arr.slice(i, (i += len)));
	}
	return chunks;
}
