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

actions = np.array(['a', 'b', 'c', 'd', 'e', 'f', 'g', 'h', 'i', 'j', 'k', 'l', 'm', 'n', 'o', 'p', 'r', 's', 't', 'u', 'w', 'y', 'z'])
noteLetters = np.array(['a', 'b', 'c', 'd', 'e', 'f', 'g'])

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
mpHands = mp.solutions.hands

holistic_model = mpHolistic.Holistic(
    min_detection_confidence=0.5,
    min_tracking_confidence=0.5
)

@app.route('/', methods=["GET", "POST"])
def home():
    return render_template("index.html")

# endpoint that uses Jan's methods to detect signs
@app.route('/predict-sign', methods=['POST'])
def predict_sign():
    data = request.get_json()
    image_data = data['image'].split(',')[1]
    image_bytes = base64.b64decode(image_data)
    image = Image.open(io.BytesIO(image_bytes))
    image = cv2.cvtColor(np.array(image), cv2.COLOR_RGB2BGR)

    image, results = mediapipeDetection(image, holistic_model)
    keypoints = extractKeypoints(results)

    global sequence
    sequence.append(keypoints)
    sequence = sequence[-30:]

    if len(sequence) == 30:
        res = model.predict(tf.expand_dims(sequence, axis=0))[0]
        
        # Get full prediction
        full_prediction = actions[np.argmax(res)]
        confidence = float(np.max(res))

        # Only allow if it's a note letter
        if full_prediction in noteLetters:
            return jsonify({ "prediction": full_prediction, "confidence": confidence })
        else:
            return jsonify({ "prediction": "", "confidence": 0.0 })

    return jsonify({ "prediction": "", "confidence": 0.0 })

logged_signs = []

# endpoints for creating music staff
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
    # We just return the list of signs/letters
    return jsonify({'notes': logged_signs})

if __name__ == '__main__':
    app.run(debug=True)