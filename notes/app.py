from flask import Flask, render_template, request, redirect, url_for, flash, session, jsonify
import requests

app = Flask(__name__)

@app.route('/', methods=["POST"])
def home():
    return render_template("index.html")