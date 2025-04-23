const video = document.querySelector("#video");
const startBtn = document.querySelector("#startBtn");
const stopBtn = document.querySelector("#stopBtn");
const container = document.querySelector(".home-container");

const resultDisplay = document.querySelector("#result-box");
const box = document.querySelector(".result")

//start webcam
startBtn.addEventListener("click", () => {
    const constraints = { video: true };
    navigator.mediaDevices
    .getUserMedia(constraints)
    .then(function (stream) {
        console.log("Camera access granted.");
        video.srcObject = stream;
        video.play();
        container.style.display = "flex";
        captureInterval = setInterval(() => captureAndSendImage(video), 5000);
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

// 

function captureAndSendImage(videoElement) {
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

    fetch('/submit-video', {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json'
        },
        body: JSON.stringify({ image: base64Image })
    })
    .then(res => res.json())
    .then(data => {
        if (data.emotion && data.emoji) {
            console.log(data)
            console.log("ResultDisplay exists:", resultDisplay);
            console.log("Emotion Detected:", data.emotion);
            resultDisplay.innerHTML = ` <span style="font-size: 8rem;">${data.emoji}</span>`;
        } else {
            resultDisplay.innerHTML = `Could not detect emotion 😕`;
        }
    })
    .catch(err => {
        console.error('Emotion detection failed', err);
        resultDisplay.innerHTML = `Error detecting emotion 😕`;
    });
}

// send image to deepface server and update our site
async function sendImageToServer(base64Image) {
    const response = await fetch("/submit-video", {
      method: "POST",
      headers: {
        "Content-Type": "application/json"
      },
      body: JSON.stringify({ image: base64Image })
    });
  
    const data = await response.json();
    console.log("Detected Emotion:", data.emotion, "Emoji:", data.emoji);
  
    // Update the emoji in the DOM
    const resultDisplay = document.getElementById("result-box");
    if (resultDisplay) {
        resultDisplay.textContent = data.emoji;
    }
}