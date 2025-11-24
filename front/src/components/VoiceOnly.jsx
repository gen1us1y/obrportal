// src/components/VoiceOnlyForm.jsx
import React, { useState, useEffect, useRef } from 'react';
import axios from 'axios';

const VoiceOnlyForm = () => {
  const [questions, setQuestions] = useState([]);
  const [selectedQuestion, setSelectedQuestion] = useState(null);
  const [score, setScore] = useState(null);
  const [isListening, setIsListening] = useState(false);
  const [transcript, setTranscript] = useState('');
  const [error, setError] = useState(null);

  const recognitionRef = useRef(null);
  const isRecognitionInitialized = useRef(false);

  // Загружаем вопросы один раз
  useEffect(() => {
    axios.get('http://localhost:5000/questions')
      .then(res => {
        setQuestions(res.data);
        if (res.data.length > 0) {
          setSelectedQuestion(res.data[0]);
        }
      })
      .catch(() => setError('Не удалось загрузить вопросы'));
  }, []);

  // 🔧 ЛЕНИВАЯ ИНИЦИАЛИЗАЦИЯ recognition — при первом клике
  const initRecognition = () => {
    if (isRecognitionInitialized.current || recognitionRef.current) return;

    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!SpeechRecognition) {
      setError('Голос не поддерживается');
      return;
    }

    const recognition = new SpeechRecognition();
    recognition.lang = 'ru-RU';
    recognition.continuous = false;
    recognition.interimResults = false;

    recognition.onstart = () => setIsListening(true);
    recognition.onend = () => setIsListening(false);

    recognition.onresult = async (event) => {
      const text = event.results[0][0].transcript.trim();
      setTranscript(text);

      if (selectedQuestion?.id && text) {
        try {
          const res = await axios.post('http://localhost:5000/evaluate', {
            question_id: selectedQuestion.id,
            answer: text
          });
          setScore(res.data.score);
        } catch (err) {
          setError('Ошибка сервера');
        }
      }
    };

    recognition.onerror = (event) => {
      setIsListening(false);
      if (event.error === 'not-allowed') {
        setError('Разрешите микрофон: настройки → конфиденциальность → микрофон');
      } else if (event.error === 'network') {
        setError('Сеть недоступна');
      } else {
        setError(`Голос: ${event.error}`);
      }
      console.error('SpeechRecognition error:', event.error);
    };

    recognitionRef.current = recognition;
    isRecognitionInitialized.current = true;
  };

  // 🔘 Обработчик КНОПКИ — синхронный, доверенный
  const handleMicClick = () => {
    setError(null);
    initRecognition();

    if (!recognitionRef.current) {
      setError('Не удалось инициализировать микрофон');
      return;
    }

    if (isListening) {
      // Остановка
      try {
        recognitionRef.current.stop();
      } catch (e) {
        setIsListening(false);
      }
      return;
    }

    // 🔥 СТАРТ — строго здесь, в onClick
    try {
      recognitionRef.current.start();
    } catch (err) {
      if (err.name === 'NotAllowedError') {
        setError('Нажмите 🔒 в адресной строке → разрешите микрофон');
      } else {
        setError(`Микрофон: ${err.message}`);
      }
      console.error('start() error:', err);
      setIsListening(false);
    }
  };

  const nextQuestion = () => {
    if (!questions.length) return;
    const i = questions.findIndex(q => q.id === selectedQuestion?.id);
    const next = questions[(i + 1) % questions.length];
    setSelectedQuestion(next);
    setScore(null);
    setTranscript('');
  };

  const getScoreColor = () => {
    if (score === 100) return '#27ae60';
    if (score >= 75) return '#2ecc71';
    if (score >= 50) return '#f39c12';
    if (score >= 25) return '#e74c3c';
    return '#95a5a6';
  };

  return (
    <div style={{
      maxWidth: '600px',
      margin: '20px auto',
      padding: '0 16px',
      textAlign: 'center'
    }}>
      <h1 style={{ margin: '20px 0', color: '#2c3e50', fontSize: '28px' }}>
        🎓 Голосовой тест
      </h1>

      {selectedQuestion ? (
        <div style={{
          background: '#fff',
          borderRadius: '16px',
          padding: '24px',
          marginBottom: '30px',
          boxShadow: '0 4px 20px rgba(0,0,0,0.08)',
          fontSize: '20px',
          lineHeight: 1.5
        }}>
          {selectedQuestion.text}
        </div>
      ) : (
        <div>Загрузка...</div>
      )}

      {/* 🎤 КНОПКА — синхронный onClick */}
      <button
        onClick={handleMicClick}
        style={{
          width: '140px',
          height: '140px',
          borderRadius: '50%',
          background: isListening ? '#e74c3c' : '#2ecc71',
          border: 'none',
          color: 'white',
          fontSize: '48px',
          cursor: 'pointer',
          boxShadow: '0 6px 20px rgba(0,0,0,0.2)',
          transition: 'all 0.2s',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          margin: '0 auto 24px',
          outline: 'none'
        }}
        aria-label={isListening ? 'Остановить запись' : 'Начать диктовку'}
      >
        {isListening ? '⏹️' : '🎤'}
      </button>

      {/* Статус */}
      <div style={{ minHeight: '28px', marginBottom: '20px' }}>
        {error && (
          <div style={{ 
            color: '#e74c3c', 
            fontWeight: 500,
            background: '#fdf2f2',
            padding: '8px 16px',
            borderRadius: '8px',
            display: 'inline-block'
          }}>
            {error}
          </div>
        )}
        {isListening && (
          <div style={{ 
            color: '#2980b9', 
            fontWeight: 500 
          }}>
            🎙️ Говорите... (пауза → оценка)
          </div>
        )}
        {transcript && !isListening && score === null && (
          <div style={{ 
            color: '#7f8c8d',
            fontStyle: 'italic'
          }}>
            «{transcript}»
          </div>
        )}
      </div>

      {/* Балл */}
      {score !== null && (
        <>
          <div style={{
            fontSize: window.innerWidth > 500 ? '72px' : '56px',
            fontWeight: 'bold',
            color: getScoreColor(),
            marginBottom: '20px',
            transition: 'color 0.5s'
          }}>
            {score}
          </div>
          <button
            onClick={nextQuestion}
            style={{
              background: '#3498db',
              color: 'white',
              border: 'none',
              padding: '14px 36px',
              borderRadius: '12px',
              fontSize: '18px',
              fontWeight: 600,
              cursor: 'pointer',
              boxShadow: '0 4px 10px rgba(52,152,219,0.3)'
            }}
          >
            ➡️ Следующий
          </button>
        </>
      )}

      <div style={{ 
        fontSize: '13px', 
        color: '#95a5a6', 
        marginTop: '30px',
        lineHeight: 1.4
      }}>
        Работает в Chrome, Edge, Яндекс.Браузер<br />
        В первый раз может потребоваться разрешить микрофон
      </div>
    </div>
  );
};

export default VoiceOnlyForm;