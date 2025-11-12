import React, { useState, useEffect } from 'react';
import axios from 'axios';

const QuestionForm = () => {
  const [questions, setQuestions] = useState([]);
  const [selectedQuestion, setSelectedQuestion] = useState('');
  const [userAnswer, setUserAnswer] = useState('');
  const [score, setScore] = useState(null);

  useEffect(() => {
    axios.get('http://localhost:5000/questions')
      .then(res => setQuestions(res.data));
  }, []);

  const handleSubmit = (e) => {
    e.preventDefault();
    axios.post('http://localhost:5000/evaluate', {
      question_id: selectedQuestion,
      answer: userAnswer
    })
    .then(res => setScore(res.data.score))
    .catch(err => console.error(err));
  };

  return (
    <div>
      <h2>Образовательный портал</h2>
      <form onSubmit={handleSubmit}>
        <label>
          Выберите вопрос:
          <select value={selectedQuestion} onChange={(e) => setSelectedQuestion(e.target.value)}>
            <option value="">--</option>
            {questions.map(q => (
              <option key={q.id} value={q.id}>{q.text}</option>
            ))}
          </select>
        </label>
        <br />
        <textarea
          value={userAnswer}
          onChange={(e) => setUserAnswer(e.target.value)}
          placeholder="Введите ваш ответ здесь..."
          rows="5"
          cols="50"
        />
        <br />
        <button type="submit">Отправить</button>
      </form>
      {score !== null && <h3>Ваш балл: {score}</h3>}
    </div>
  );
};

export default QuestionForm;