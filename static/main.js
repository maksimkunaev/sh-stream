const stopElem = document.querySelector('.end-stream');
const startElem = document.querySelector('.start-stream');
const video = document.querySelector('video');
const canvas = document.querySelector('canvas');

class Main {
  constructor(width, height, canvas, video) {
    this.height = height;
    this.width = width;
    this.count = 0;
    this.canvas = canvas;
    this.video = video;
    this.delay = 200;
    this.stream = null;
    this.current = null;
    this.previous = null;
    this.treshhold = 5;
    this.lastActivityTime = null;
    this.isCurrentActvity = false;
    this.activityDelay = 3 * 1000;
    this.isSendingActive = false;
    this.interval = null;

    this.startTime = Date.now();
    this.startAfter = 5 * 1000;

    this.mediaRecorder = null;

    this.conn = io(location.origin);
    this.initWS();
  }

  get COMMANDS() {
    return {
      send_capture: chatId => {
        if (!(this.stream && this.stream.active)) {
          this.sendMessage(chatId, 'Stream is inactive');
        } else {
          this.sendPicture(chatId);
        }
      },
      start_stream: () => this.startStream(),
      stop_stream: () => this.stopStream(),
    };
  }

  initWS() {
    this.conn.on('connect', msg => {
      console.log('Connected to the signaling server');
    });

    this.conn.on('message', async msg => {
      let data = {};

      try {
        data = JSON.parse(msg);
      } catch (e) {
        console.log(e);
      }

      if (Object.keys(this.COMMANDS).indexOf(data.command) > -1) {
        console.log('Received command', data.command);
        this.COMMANDS[data.command](data.chatId);
      }
    });
    this.conn.send(JSON.stringify({ data: 'hi from cliet' }));

    this.conn.on('error', msg => {
      showAlert(msg);
    });
  }

  getStream() {
    const constraints = {
      audio: true,
      video: {
        facingMode: 'user',
      },
    };

    return navigator.mediaDevices.getUserMedia(constraints);
  }

  get screeCapture() {
    const { canvas, width, height } = this;
    const context = canvas.getContext('2d');
    context.drawImage(this.video, 0, 0, width, height);
    return canvas.toDataURL('image/png');
  }

  get isSystemStarted() {
    return Date.now() - this.startTime > this.startAfter;
  }

  async startStream() {
    const stream = await this.getStream();

    const { video } = this;

    video.srcObject = stream;
    video.onloadedmetadata = function (e) {
      video.volume = 0;
      video.play();
    };

    this.interval = setInterval(() => this.checkActivity(), this.delay);
    this.startTime = Date.now();

    this.stream = stream;
  }

  stopStream() {
    this.count = 0;

    const { stream } = this;
    const tracks = stream.getTracks();

    tracks.forEach(function (track) {
      track.stop();
    });

    this.video.srcObject = null;

    clearInterval(this.interval);
  }

  async startRecording() {
    const options = { mimeType: 'video/webm' };

    this.mediaRecorder = new MediaRecorder(this.video.srcObject, options);

    const ondataavailable = event => {
      if (this.isSendingActive) {
        postBlob(event);
      }
    };
    this.mediaRecorder.ondataavailable = ondataavailable;
    this.mediaRecorder.start(1000);

    fetch('/start-stream', { method: 'POST' });

    this.sendMessage(null, 'Detected unusual activity.');
    this.sendPicture(null);
    this.isSendingActive = true;
  }

  get mediaRecorerStatus() {
    return this.mediaRecorder && this.mediaRecorder.state;
  }

  async stopRecording() {
    this.isSendingActive = false;

    if (this.mediaRecorerStatus !== 'inactive') {
      this.mediaRecorder.stop();
    }

    fetch('/end-stream', { method: 'POST' });
  }

  async checkActivity() {
    this.count += 1;
    const {
      canvas,
      isSystemStarted,
      width,
      height,
      current,
      previous,
      lastActivityTime,
      treshhold,
      activityDelay,
    } = this;
    const context = canvas.getContext('2d');

    canvas.width = width;
    canvas.height = height;

    context.drawImage(this.video, 0, 0, width, height);
    const data = canvas.toDataURL('image/png');

    this.current = data;
    if (!previous) this.previous = this.current;

    const diff = await pixelmatch(this.previous, this.current);
    // visualize(diff);

    if (diff > treshhold && isSystemStarted) {
      this.lastActivityTime = Date.now();
      console.log('Updating activity time', Date.now());
    }

    if (diff > treshhold && isSystemStarted && !this.isCurrentActvity) {
      this.isCurrentActvity = true;
      console.log('There is a new activity!');
    }

    if (
      this.isCurrentActvity &&
      diff < treshhold &&
      Date.now() - this.lastActivityTime > activityDelay
    ) {
      this.isCurrentActvity = false;
      console.log('No more activity in last', activityDelay);
    }

    if (this.isSendingActive && !this.isCurrentActvity) {
      this.stopRecording();
    }

    if (this.isCurrentActvity && !this.isSendingActive) {
      this.startRecording();
    }

    this.previous = this.current;
  }

  sendMessage(chatId, message = '') {
    this.conn.send(
      JSON.stringify({
        on_command: 'send_message',
        message,
        chatId,
      })
    );
  }

  sendPicture(chatId) {
    this.conn.send(
      JSON.stringify({
        on_command: 'send_capture',
        data: this.screeCapture,
        chatId,
      })
    );
  }
}

const instanse = new Main(300, 300, canvas, video);

startElem.addEventListener('click', e => {
  e.preventDefault();
  instanse.startStream();
});

stopElem.addEventListener('click', e => {
  e.preventDefault();
  instanse.stopStream();
});

function postBlob(event) {
  if (event.data && event.data.size > 0) {
    sendBlobAsBase64(event.data);
  }
}

function sendBlobAsBase64(blob) {
  const reader = new FileReader();

  reader.addEventListener('load', e => {
    const dataUrl = reader.result;
    const base64EncodedData = dataUrl.split(';base64,')[1];

    sendDataToBackend(base64EncodedData);
  });

  reader.readAsDataURL(blob);
}

function sendDataToBackend(base64EncodedData) {
  const body = JSON.stringify({
    data: base64EncodedData,
  });
  fetch('/chunk', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body,
  }).then(res => {
    return res.json();
  });
}

async function pixelmatch(img1, img2) {
  return new Promise((resolve, reject) => {
    resemble(img1)
      .compareTo(img2)
      .onComplete(data => {
        resolve(data.misMatchPercentage);
      });
  });
}

function visualize(percent) {
  const str = new Array(Math.round(percent / 5)).fill('.').join('');
  console.log(`${percent} ${str}`);
}
