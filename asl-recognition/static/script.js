const video = document.querySelector("#video");
const startBtn = document.querySelector("#startBtn");
const stopBtn = document.querySelector("#stopBtn");
const container = document.querySelector(".home-container");

const resultDisplay = document.querySelector("#result-box"); //ASL prediction is loaded here
const box = document.querySelector(".result")
const frameBuffer = [];

let logging = false
const startGenBtn = document.querySelector("#startGenBtn");
const endGenBtn = document.querySelector("#endGenBtn");
let notes = [];

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
    logging = true;
    notes = [] //new creation session
    startGenBtn.disabled = true;
    stopGenBtn.disabled = false;
    console.log("Song creation starting...")
});

// stop note generation
endGenBtn.addEventListener("click", () => { 
    logging = false;
    startGenBtn.disabled = false;
    topGenBtn.disabled = true;
    console.log("Song creation done. Generating MIDI file...")

    fetch('/predict-sign', {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json'
        },
        body: JSON.stringify({ prediction: notes.join(' ') })
    })
    .then(data => {
        const container = document.createElement('div');
        container.id = "sheetMusic";
        document.body.appendChild(container);
    
        const VF = Vex.Flow;
        const renderer = new VF.Renderer(container, VF.Renderer.Backends.SVG);
    
        renderer.resize(500, 200);
        const context = renderer.getContext();
        const stave = new VF.Stave(10, 40, 400);
        stave.addClef("treble").setContext(context).draw();
    
        const notes = data.prediction.split(' ').map(letter => {
            return new VF.StaveNote({ 
                clef: "treble", 
                keys: [`${letter.toLowerCase()}/4`],  // example: 'c/4'
                duration: "q"
            });
        });
    
        const voice = new VF.Voice({ num_beats: notes.length,  beat_value: 4 });
        voice.addTickables(notes);
    
        const formatter = new VF.Formatter().joinVoices([voice]).format([voice], 400);
        voice.draw(context, stave);
    });
});

// constantly log the newly signed note
function handlePrediction(prediction) {
    if (logging) {
        fetch('/log_sign', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({ sign: prediction })
        });

        currentNotes.push(prediction);
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
