const video = document.querySelector("#video");
const startBtn = document.querySelector("#startBtn");
const stopBtn = document.querySelector("#stopBtn");
const container = document.querySelector(".home-container");

const resultDisplay = document.querySelector("#result-box"); //ASL prediction is loaded here
const box = document.querySelector(".result")
const frameBuffer = [];

//start webcam
startBtn.addEventListener("click", () => {
    navigator.mediaDevices
    .getUserMedia({ video: true })
    .then(function (stream) {
        console.log("Camera access granted.");
        video.srcObject = stream;
        video.play();
        container.style.display = "flex";
        captureInterval = setInterval(() => captureAndSendFrames(video), 1500);
    })
    .catch(function (error) {
        console.error("Error accessing camera:", error);
    });
});

// end webcam
stopBtn.addEventListener("click", () => {
    const video = document.querySelector('video');
    const mediaStream = video.srcObject;
    const tracks = mediaStream.getTracks();
    tracks[0].stop();
    tracks.forEach(track => track.stop())

    if (captureInterval) {
        clearInterval(captureInterval);
        captureInterval = null;
    }

});

// take frames and send a group of frames to detector
function captureAndSendFrames(videoElement) {
    if (!videoElement.videoWidth || !videoElement.videoHeight) {
        console.warn("Video not ready yet.");
        return;
    }

    const canvas = document.createElement('canvas');
    canvas.width = videoElement.videoWidth;
    canvas.height = videoElement.videoHeight;
    const ctx = canvas.getContext('2d');
    ctx.drawImage(videoElement, 0, 0);

    const base64Image = canvas.toDataURL('image/jpeg');

    fetch('/predict-sign', {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json'
        },
        body: JSON.stringify({ image: base64Image })
    })
    .then(res => res.json())
    .then(data => {
        if (data.prediction && data.confidence > 0.5) {
            console.log(data)
            resultDisplay.innerHTML = `<span style="font-size: 8rem;">${data.prediction}</span>`;
        } else {
            resultDisplay.innerHTML = '<span>Waiting for stable sign...</span>';
        }
    })
    .catch(err => {
        console.error("Can't detect sign", err);
        resultDisplay.innerHTML = "Sign detection failed.";
    });
}

//create a new piece of music
startSongBtn.addEventListener("click", () => {

}