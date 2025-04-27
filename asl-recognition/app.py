from flask import Flask, render_template, request, redirect, url_for, flash, session, jsonify
import numpy as np
import cv2
import requests
import mediapipe as mp
import tensorflow as tf
from tensorflow.keras import Input
from tensorflow.keras.models import Sequential
from tensorflow.keras.layers import LSTM, Dense
from SignLanguageRecognition.signLanguageRecognizer import signLanguageRecognizerMethod
from SignLanguageRecognition.signLanguageRecognizer import extractKeypoints, mediapipeDetection, drawLandmarks
import mediapipe as mp
import base64
from PIL import Image
import io
import os
from music21 import stream, note

app = Flask(__name__)

"""
Credit: Jan Binkowski

I adapted Jan's SignLanguageRecognition package source code to
make a web-app friendly Flask version of the code.

You can find the GitHub repository here: https://github.com/JanBinkowski/SignLanguageRecognition/tree/master
And the PyPi link here: https://pypi.org/project/SignLanguageRecognition/
"""

BASE_DIR = os.path.dirname(os.path.abspath(__file__))
weights_path = os.path.join(BASE_DIR, 'action.h5')

mp_hands = mp.solutions.hands


actions = np.array(['A', 'B', 'C', 'D', 'E', 'F', 'G', 'h', 'i', 'j', 'k', 'l', 'm', 'n', 'o', 'p', 'r', 's', 't', 'u', 'w', 'y', 'z'])

signEquivs = { #ASL to musical note equivalencies (treble clef ver)
    "a":"A",
    "b":"B",
    "c":"C",
    "d":"D",
    "e":"E",
    "f":"F",
    "g":"G"
}

logged_signs = []

model = Sequential([
    Input(shape=(30, 126)),
    LSTM(64, return_sequences=True, activation='relu'),
    LSTM(128, return_sequences=True, activation='relu'),
    LSTM(64, return_sequences=False, activation='relu'),
    Dense(64, activation='relu'),
    Dense(32, activation='relu'),
    Dense(actions.shape[0], activation='softmax')
])
model.load_weights(weights_path)

sequence = []
mpHolistic = mp.solutions.holistic

@app.route('/', methods=["GET", "POST"])
def home():
    return render_template("index.html")

# endpoint that uses Jan's methods to detect signs
@app.route('/predict-sign', methods=["POST"])
def predict_sign():
    data = request.get_json()
    image_data = data['image'].split(',')[1]
    image_bytes = base64.b64decode(image_data)
    image = Image.open(io.BytesIO(image_bytes))
    image = cv2.cvtColor(np.array(image), cv2.COLOR_RGB2BGR)

    with mp_hands.Hands(static_image_mode=False,
                        max_num_hands=1,
                        min_detection_confidence=0.5,
                        min_tracking_confidence=0.5) as hands:

        image_rgb = cv2.cvtColor(image, cv2.COLOR_BGR2RGB)
        results = hands.process(image_rgb)
        keypoints = extractKeypoints(results)

        global sequence
        sequence.append(keypoints)
        sequence = sequence[-30:]

        if len(sequence) == 30:
            res = model.predict(tf.expand_dims(sequence, axis=0))[0]
            prediction = actions[np.argmax(res)]
            confidence = float(np.max(res))
            return jsonify({ "prediction": prediction, "confidence": confidence })

    return jsonify({ "prediction": "", "confidence": 0.0 })


# method that generates the staff displayed on the webpage
def generate_sheet_music(notes):
    s = stream.Stream()
    for letter in notes:
        if letter in signEquivs:
            n = note.Note(signEquivs[letter])
            n.quarterLength = 1  # default duration
            s.append(n)
    s.write('musicxml.png', fp='static/sheet_music.png')  # output for display

# method that creates a midi file that will be played
def generate_midi(notes):
    s = stream.Stream()
    for letter in notes:
        if letter in signEquivs:
            n = note.Note(signEquivs[letter])
            n.quarterLength = 1
            s.append(n)
    s.write('midi', fp='static/generated_song.mid')


# end point that creates song using the detected notes
@app.route('/generate-song', methods=['POST'])
def generate_song():
    data = request.get_json()
    letters = data.get('prediction', '')
    letters = letters.split()

    generate_sheet_music(letters)
    generate_midi(letters)
    
    return jsonify({
        "midi_url": url_for('static', filename='generated_song.mid'),
        "sheet_url": url_for('static', filename='sheet_music.png')
    })

@app.route('/start_logging', methods=['POST'])
def start_logging():
    global logged_signs
    logged_signs = []  # Reset
    return jsonify({'message': 'Logging started'})

@app.route('/log_sign', methods=['POST'])
def log_sign():
    data = request.get_json()
    sign = data.get('sign')

    if sign:
        logged_signs.append(sign)
        return jsonify({'message': f'Sign {sign} logged successfully'})
    else:
        return jsonify({'error': 'No sign provided'}), 400

@app.route('/generate_music', methods=['GET'])
def generate_music():
    #return the list of signs/letters
    return jsonify({'notes': logged_signs})


if __name__ == '__main__':
    app.run(debug=True)