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
@app.route('/predict-sign', methods=['POST'])
def predict_sign():
    data = request.get_json()
    image_data = data['image'].split(',')[1]
    image_bytes = base64.b64decode(image_data)
    image = Image.open(io.BytesIO(image_bytes))
    image = cv2.cvtColor(np.array(image), cv2.COLOR_RGB2BGR)

    with mpHolistic.Holistic(min_detection_confidence=0.5, min_tracking_confidence=0.5) as holistic:
        image, results = mediapipeDetection(image, holistic)
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

if __name__ == '__main__':
    app.run(debug=True)