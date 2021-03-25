class SocketService {
  constructor(io) {
    this.wsClients = {};
    this.from_client_handlers = [];

    io.on('connection', connection => {
      this.wsClients[connection.id] = connection;

      connection.on('message', msg => this.onMessage(msg));
      connection.on('disconnect', () => {
        delete this.wsClients[connection.id];
      });
    });
  }

  set_plugins(botInstanse, from_client_handlers) {
    this.botInstanse = botInstanse;
    this.from_client_handlers = from_client_handlers;
  }

  onMessage(msg) {
    let data;

    try {
      data = JSON.parse(msg);
    } catch (e) {
      console.log('Invalid JSON');
      data = {};
    }

    if (data.on_command) {
      const chatId = data.chatId || this.botInstanse.participantId;

      if (chatId) {
        this.from_client_handlers[data.on_command].handler(
          this.botInstanse.bot,
          this.wsClients,
          chatId,
          data
        );
      }
    }
  }
}

module.exports = {
  SocketService,
};
