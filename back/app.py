from flask import Flask, request, jsonify
from difflib import SequenceMatcher
import sqlite3
from flask_cors import CORS  # 👈 импортируем

app = Flask(__name__)
CORS(app)  # 👈 разрешаем CORS для всех маршрутов

DATABASE = 'database.db'

def init_db():
    conn = sqlite3.connect(DATABASE)
    cursor = conn.cursor()
    cursor.execute('''
        CREATE TABLE IF NOT EXISTS answers (
            id INTEGER PRIMARY KEY,
            question_id INTEGER,
            question_text TEXT,
            answer_25 TEXT,
            answer_50 TEXT,
            answer_75 TEXT,
            answer_100 TEXT
        )
    ''')
    conn.commit()
    conn.close()

def get_similarity(a, b):
    return SequenceMatcher(None, a, b).ratio()

@app.route('/questions', methods=['GET'])
def get_questions():
    conn = sqlite3.connect(DATABASE)
    cursor = conn.cursor()
    cursor.execute("SELECT question_id, question_text FROM answers")
    rows = cursor.fetchall()
    conn.close()
    return jsonify([{'id': r[0], 'text': r[1]} for r in rows])

def evaluate_answer_logic(student_answer, etalon_25, etalon_50, etalon_75, etalon_100, min_length=15, min_threshold=0.2):
    # Проверка длины
    if len(student_answer.strip()) < min_length:
        return 0  # 👈 теперь 0, а не 25

    # Сравниваем с эталонами
    etalons = [
        (25, etalon_25),
        (50, etalon_50),
        (75, etalon_75),
        (100, etalon_100)
    ]

    scores = [(score, get_similarity(student_answer, et)) for score, et in etalons]

    # Находим максимальную схожесть
    best_score, best_similarity = max(scores, key=lambda x: x[1])

    # Если схожесть ниже порога — ставим 0
    if best_similarity < min_threshold:
        return 0

    return best_score

@app.route('/evaluate', methods=['POST'])
def evaluate_answer():
    try:
        data = request.json
        question_id = data['question_id']
        user_answer = data['answer']

        conn = sqlite3.connect(DATABASE)
        cursor = conn.cursor()
        cursor.execute('''
            SELECT answer_25, answer_50, answer_75, answer_100 FROM answers WHERE question_id = ?
        ''', (question_id,))
        row = cursor.fetchone()
        conn.close()

        if not row:
            return jsonify({'error': 'Question not found'}), 404

        # Вызываем функцию проверки
        score = evaluate_answer_logic(user_answer, *row, min_length=10, min_threshold=0.5)
        return jsonify({'score': score})

    except Exception as e:
        return jsonify({'error': str(e)}), 500

if __name__ == '__main__':
    init_db()
    app.run(debug=True, port=5000)