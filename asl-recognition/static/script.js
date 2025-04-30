const video = document.querySelector("#video");
const startBtn = document.querySelector("#startBtn");
const stopBtn = document.querySelector("#stopBtn");
const container = document.querySelector(".home-container");
const staffStart = document.querySelector("#staffStart");
const stopStaff = document.querySelector("#staffEnd");

const resultDisplay = document.querySelector("#result-box"); //ASL prediction is loaded here
const box = document.querySelector(".result")
const frameBuffer = [];
let logging = false;
let currentNotes = []; // live notes array
let loggedNotes = [];

// ------------- Staff Note Logging
let currentPrediction = '';
const logNoteBtn = document.getElementById("logNoteBtn");
const deleteNoteBtn = document.getElementById("deleteNoteBtn");
const canvas = document.getElementById("musicStaff");
const renderer = new Vex.Flow.Renderer(canvas, Vex.Flow.Renderer.Backends.CANVAS);
const context = renderer.getContext();

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
            currentPrediction = data.prediction;
            resultDisplay.innerHTML = `<span style="font-size: 8rem;">${data.prediction}</span>`;
            //resultDisplay.innerHTML = `<span id="result-box" style="font-size: 8rem;">${data.prediction}</span>`;

        } else {
            resultDisplay.innerHTML = '<span>Waiting for stable sign...</span>';
        }
    })
    .catch(err => {
        console.error("Can't detect sign", err);
        resultDisplay.innerHTML = "Sign detection failed.";
    });
}

staffStart.addEventListener("click", () => {
    fetch('/start_logging', { method: 'POST' });
    logging = true;
});

stopStaff.addEventListener('click', () => {
    logging = false;
});

function handlePrediction(prediction) {
    if (logging) {
        fetch('/log_sign', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({ sign: prediction })
        });

        // Update the frontend notes array
        currentNotes.push(prediction);

        // Re-render the music after adding a new note
        renderSheetMusic(currentNotes);
    }
}

function renderSheetMusic(noteLetters) {
    document.getElementById('sheetMusicContainer').innerHTML = ""; // Clear previous music

    const VF = Vex.Flow;
    const div = document.getElementById('sheetMusicContainer');
    const renderer = new VF.Renderer(div, VF.Renderer.Backends.SVG);

    renderer.resize(500, 200);
    const context = renderer.getContext();
    const stave = new VF.Stave(10, 40, 400);

    stave.addClef("treble").setContext(context).draw();

    const notes = noteLetters.map(letter => {
        const note = letter.toLowerCase();
        return new VF.StaveNote({ 
            clef: "treble", 
            keys: [`${note}/4`], 
            duration: "q"
        });
    });

    const voice = new VF.Voice({ num_beats: notes.length, beat_value: 4 });
    voice.addTickables(notes);

    new VF.Formatter().joinVoices([voice]).format([voice], 400);
    voice.draw(context, stave);
}

// ----------------- Logging and Displaying Notes
function drawStaff() {
    context.clearRect(0, 0, canvas.width, canvas.height);
    const stave = new Vex.Flow.Stave(10, 40, 400);
    stave.addClef("treble").setContext(context).draw();

    const notes = loggedNotes.map(letter => {
        const pitchMap = { 'a': 'A/4', 'b': 'B/4', 'c': 'C/5', 'd': 'D/5', 'e': 'E/5', 'f': 'F/5', 'g': 'G/5' };
        return new Vex.Flow.StaveNote({ clef: "treble", keys: [pitchMap[letter]], duration: "q" });
    });

    const voice = new Vex.Flow.Voice({ num_beats: notes.length || 1, beat_value: 4 });
    voice.addTickables(notes.length > 0 ? notes : [
        new Vex.Flow.StaveNote({ clef: "treble", keys: ["b/4"], duration: "qr" })
    ]);

    new Vex.Flow.Formatter().joinVoices([voice]).format([voice], 400);
    voice.draw(context, stave);
}

drawStaff();

// Log the current prediction when button is clicked
logNoteBtn.addEventListener('click', () => {
    if (currentPrediction && ['a', 'b', 'c', 'd', 'e', 'f', 'g'].includes(currentPrediction.toLowerCase())) {
        loggedNotes.push(currentPrediction.toLowerCase());
        drawStaff();
    }
});

// Delete the last logged note
deleteNoteBtn.addEventListener('click', () => {
    loggedNotes.pop();
    drawStaff();
});

document.getElementById("staffCtrls").style.display = "none";