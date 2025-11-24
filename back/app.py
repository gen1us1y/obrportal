# app.py
import os
import sys
import sqlite3
import numpy as np
import re
import threading
from flask import Flask, request, jsonify
from flask_cors import CORS
from sentence_transformers import SentenceTransformer
from sklearn.metrics.pairwise import cosine_similarity

app = Flask(__name__)
CORS(app)

DATABASE = 'database.db'
MODEL_PATH = "./models/all-MiniLM-L6-v2"

# === 1. ПРЕДОБРАБОТКА (для русского технического языка) ===
def preprocess(text: str) -> str:
    if not text:
        return ""
    text = text.lower().strip()
    text = re.sub(r'[^\w\s]', ' ', text)
    text = re.sub(r'\s+', ' ', text)
    # 🔧 Добавлены замены для программирования
    for ru, en in {
        # Общие
        'список': 'list', 'массив': 'array', 'цикл': 'loop', 'функция': 'function',
        'переменная': 'variable', 'строка': 'string', 'число': 'number',
        'возвращает': 'returns', 'проверяет': 'checks', 'значение': 'value',
        'параметр': 'parameter', 'аргумент': 'argument', 'метод': 'method',
        # Циклы
        'перебирает': 'iterates', 'проходит': 'iterates', 'выполняет': 'executes',
        'элементы': 'elements', 'итерация': 'iteration', 'счётчик': 'counter',
        'условие': 'condition', 'тело цикла': 'loop body',
        # Ошибки
        'стрелочк': 'arrow', 'типа': 'like', 'как бы': 'kind of',
    }.items():
        text = text.replace(ru, en)
    return text

# === 2. ЖЁСТКАЯ ЗАГРУЗКА МОДЕЛИ (без fallback) ===
print("🔍 Загрузка модели из ./models/all-MiniLM-L6-v2...")
model = SentenceTransformer(MODEL_PATH)
print("✅ Модель успешно загружена")

# === 3. КЭШ (опционально, для скорости) ===
embedding_cache = {}
cache_lock = threading.Lock()

def get_embeddings(question_id, etalons):
    with cache_lock:
        if question_id not in embedding_cache:
            texts = [preprocess(e) for e in etalons]
            embedding_cache[question_id] = model.encode(texts, convert_to_numpy=True)
        return embedding_cache[question_id]

# === 4. БД ===
def init_db():
    conn = sqlite3.connect(DATABASE)
    cursor = conn.cursor()
    cursor.execute('''
        CREATE TABLE IF NOT EXISTS answers (
            id INTEGER PRIMARY KEY,
            question_id INTEGER UNIQUE,
            question_text TEXT,
            answer_25 TEXT,
            answer_50 TEXT,
            answer_75 TEXT,
            answer_100 TEXT
        )
    ''')
    conn.commit()
    conn.close()

# === 5. ОЦЕНКА ===
def evaluate_answer_logic(student_answer, etalons, question_id):
    original_answer = student_answer.strip().lower()
    
    # 🔴 Стоп-слова
    stop_phrases = ['стрелочк', 'типа', 'как бы', 'вот это', 'на глаз']
    has_stop = any(phrase in original_answer for phrase in stop_phrases)

    student_emb = model.encode([preprocess(student_answer)], convert_to_numpy=True)
    etalons_emb = get_embeddings(question_id, etalons)
    sims = cosine_similarity(student_emb, etalons_emb)[0]  # [sim25, sim50, sim75, sim100]

    # 🎯 Берём НАИЛУЧШЕЕ совпадение — и смотрим, с каким эталоном
    best_sim = max(sims)
    best_idx = int(np.argmax(sims))  # 0=25, 1=50, 2=75, 3=100

    # Пороги — теперь НЕ на индекс, а на уровень сходства + эталон
    if best_idx == 3 and best_sim >= 0.78:   # 100
        score = 100
    elif best_idx == 2 and best_sim >= 0.63: # 75 ← снижено с 0.65
        score = 75
    elif best_idx == 1 and best_sim >= 0.53: # 50 ← снижено с 0.55
        score = 50
    elif best_idx == 0 and best_sim >= 0.45: # 25
        score = 25
    else:
        score = 0

    # 🔽 Коррекция на стоп-слова
    if has_stop:
        score = min(score, 25)
        if score == 25 and best_sim < 0.50:
            score = 0

    return score

# === 6. ЭНДПОИНТЫ ===
@app.route('/questions', methods=['GET'])
def get_questions():
    conn = sqlite3.connect(DATABASE)
    cursor = conn.cursor()
    cursor.execute("SELECT question_id, question_text FROM answers")
    rows = cursor.fetchall()
    conn.close()
    return jsonify([{'id': r[0], 'text': r[1]} for r in rows])

@app.route('/evaluate', methods=['POST'])
def evaluate_answer():
    data = request.json
    question_id = int(data['question_id'])
    user_answer = data['answer']

    conn = sqlite3.connect(DATABASE)
    cursor = conn.cursor()
    cursor.execute('SELECT answer_25, answer_50, answer_75, answer_100 FROM answers WHERE question_id = ?', (question_id,))
    row = cursor.fetchone()
    conn.close()

    if not row:
        return jsonify({'error': 'Question not found'}), 404

    score = evaluate_answer_logic(user_answer, row, question_id)
    return jsonify({'score': score})

# === 7. СТАРТ ===
if __name__ == '__main__':
    init_db()
    print("\n🚀 Сервер запущен. Только нейросеть. Никаких компромиссов.")
    print(f"   Модель: {MODEL_PATH}")
    print("   API: http://localhost:5000/evaluate")
    app.run(host='0.0.0.0', port=5000, threaded=True)