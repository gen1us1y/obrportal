// src/components/QuestionForm.jsx
import React, { useState, useEffect, useRef } from 'react';
import axios from 'axios';

const QuestionForm = () => {
  const [questions, setQuestions] = useState([]);
  const [selectedQuestion, setSelectedQuestion] = useState('');
  const [userAnswer, setUserAnswer] = useState('');
  const [score, setScore] = useState(null);
  const [isListening, setIsListening] = useState(false);
  const [error, setError] = useState(null);

  const recognitionRef = useRef(null);

  useEffect(() => {
    // Загрузка вопросов
    axios.get('http://localhost:5000/questions')
      .then(res => setQuestions(res.data))
      .catch(err => setError('Не удалось загрузить вопросы'));

    // Инициализация SpeechRecognition
    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (SpeechRecognition) {
      const recognition = new SpeechRecognition();
      recognition.lang = 'ru-RU';
      recognition.continuous = false;
      recognition.interimResults = false;

      recognition.onstart = () => setIsListening(true);
      recognition.onend = () => setIsListening(false);

      recognition.onresult = (event) => {
        const transcript = event.results[0][0].transcript;
        setUserAnswer(prev => prev + (prev ? ' ' : '') + transcript);
      };

      recognition.onerror = (event) => {
        console.error('Голосовой ввод ошибка:', event.error);
        setIsListening(false);
        if (event.error === 'not-allowed') {
          setError('Разрешите микрофон в настройках браузера');
        }
      };

      recognitionRef.current = recognition;
    } else {
      console.warn('Web Speech API не поддерживается в этом браузере');
    }

    return () => {
      if (recognitionRef.current) {
        recognitionRef.current.stop();
      }
    };
  }, []);

  const startListening = () => {
    if (recognitionRef.current) {
      setError(null);
      recognitionRef.current.start();
    } else {
      setError('Голосовой ввод не поддерживается');
    }
  };

  const stopListening = () => {
    if (recognitionRef.current) {
      recognitionRef.current.stop();
    }
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    if (!selectedQuestion || !userAnswer.trim()) {
      alert('Выберите вопрос и введите/продиктуйте ответ');
      return;
    }

    setScore(null);
    setError(null);

    axios.post('http://localhost:5000/evaluate', {
      question_id: parseInt(selectedQuestion, 10),
      answer: userAnswer
    })
    .then(res => setScore(res.data.score))
    .catch(err => {
      console.error('Ошибка оценки:', err);
      setError('Ошибка сервера. Проверьте backend.');
    });
  };

  const getScoreClass = () => {
    if (score === 100) return 'score-100';
    if (score >= 75) return 'score-75';
    if (score >= 50) return 'score-50';
    if (score >= 25) return 'score-25';
    return 'score-0';
  };

  return (
    <div>
      <h2>🎓 Образовательный портал</h2>
      
      {error && (
        <div style={{ 
          background: '#ffebee', 
          color: '#c62828', 
          padding: '12px', 
          borderRadius: '8px', 
          marginBottom: '20px',
          textAlign: 'center'
        }}>
          {error}
        </div>
      )}

      <form onSubmit={handleSubmit}>
        <label>
          📝 Выберите вопрос:
          <select 
            value={selectedQuestion} 
            onChange={(e) => setSelectedQuestion(e.target.value)}
            required
          >
            <option value="">— Выберите —</option>
            {questions.map(q => (
              <option key={q.id} value={q.id}>{q.text}</option>
            ))}
          </select>
        </label>

        <label style={{ marginTop: '20px', display: 'block' }}>
          💬 Ваш ответ:
          <div style={{ display: 'flex', gap: '8px', marginTop: '8px' }}>
            <textarea
              value={userAnswer}
              onChange={(e) => setUserAnswer(e.target.value)}
              placeholder="Напишите или нажмите 🎤 и диктуйте"
              rows="5"
              style={{ flex: 1 }}
            />
            <button
              type="button"
              onClick={isListening ? stopListening : startListening}
              style={{
                width: '50px',
                height: '50px',
                borderRadius: '50%',
                background: isListening ? '#e74c3c' : '#2ecc71',
                color: 'white',
                border: 'none',
                fontSize: '20px',
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center'
              }}
              title={isListening ? 'Остановить запись' : 'Начать диктовку'}
            >
              🎤
            </button>
          </div>
          <div style={{ fontSize: '14px', color: '#7f8c8d', marginTop: '6px' }}>
            {isListening ? '🎙️ Говорите...' : 'Поддерживается в Chrome, Edge, Яндекс.Браузер'}
          </div>
        </label>

        <button 
          type="submit" 
          style={{ 
            marginTop: '20px', 
            background: '#3498db',
            color: 'white',
            border: 'none',
            padding: '12px 24px',
            borderRadius: '8px',
            fontSize: '16px',
            cursor: 'pointer'
          }}
        >
          Проверить ответ
        </button>
      </form>

      {score !== null && (
        <div className={`score-display ${getScoreClass()}`} style={{ marginTop: '24px' }}>
          🎯 Ваш балл: <strong>{score}</strong> / 100
        </div>
      )}
    </div>
  );
};

export default QuestionForm;