const videoElem = document.querySelector('#video');
const startBtnElem = document.querySelector('#start');
const stopBtnElem = document.querySelector('#stop');

startBtnElem.addEventListener('click', startSharing);
stopBtnElem.addEventListener('click', stopSharing);

const socket = io();

let displayStream;
let recorder;

socket.on('init', captureVideo);

async function captureVideo() {
  try {
    const initiator = !!navigator.mediaDevices.getDisplayMedia;
    if (navigator.mediaDevices.getDisplayMedia) {
      displayStream = await navigator.mediaDevices.getDisplayMedia({
        video: true,
      });
      videoElem.srcObject = displayStream;

      recorder = new MediaRecorder(displayStream);
      recorder.ondataavailable = (e) => {
        console.log(e);
        videoElem.src = URL.createObjectURL(e.data);
        socket.emit('save', e.data);
      };
      recorder.start();
    }

    const peer = new SimplePeer({
      initiator,
      stream: displayStream,
      config: {
        iceServers: [
          {
            url: 'stun:stunserver.example.org',
            // username: '',
            // credential: '',
          },
        ],
      },
    });

    peer.on('signal', (data) => {
      socket.emit('offer', data);
    });

    socket.on('offer', (data) => {
      peer.signal(data);
    });

    peer.on('stream', (stream) => {
      videoElem.srcObject = stream;
      videoElem.play();
    });
  } catch (error) {
    console.log(error);
  }
}

function startSharing() {
  socket.emit('init');
}

function stopSharing() {
  if (!displayStream) {
    return;
  }

  displayStream.getTracks().forEach((track) => track.stop());
  recorder.stop();

  videoElem.srcObject = null;
}
