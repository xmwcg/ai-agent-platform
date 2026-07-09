import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import {
  Card, Typography, Radio, Checkbox, Input, Button, Space, Progress,
  message, Result, Tag, Divider, Spin
} from 'antd';
import {
  ArrowLeftOutlined, CheckCircleOutlined, CloseCircleOutlined,
  ClockCircleOutlined, TrophyOutlined
} from '@ant-design/icons';
// apiClient 预留（后续对接后端 API）
// import apiClient from '@/services/api';

const { Title, Paragraph, Text } = Typography;
const { TextArea } = Input;

interface Question {
  _id?: string;
  type: 'single' | 'multiple' | 'truefalse' | 'fillblank' | 'code';
  question: string;
  options?: string[];
  correctAnswer?: any;
  explanation?: string;
  points: number;
}

interface Quiz {
  _id?: string;
  title: string;
  description?: string;
  questions: Question[];
  timeLimit?: number; // 分钟
  passingScore: number;
}

export default function QuizPage() {
  const { courseId, chapterIdx } = useParams<{ courseId: string; chapterIdx: string }>();
  const navigate = useNavigate();

  const [quiz, setQuiz] = useState<Quiz | null>(null);
  const [loading, setLoading] = useState(true);
  const [answers, setAnswers] = useState<Record<number, any>>({});
  const [submitted, setSubmitted] = useState(false);
  const [score, setScore] = useState(0);
  const [results, setResults] = useState<{ correct: boolean; explanation?: string }[]>([]);
  const [timeLeft, setTimeLeft] = useState(0); // 秒

  // 加载测验（模拟数据）
  const loadQuiz = () => {
    setLoading(true);
    setTimeout(() => {
      setQuiz({
        title: '第1章测验：Linux 基础',
        description: '测试你对 Linux 基础知识的掌握程度，共 5 题，限时 10 分钟。',
        timeLimit: 10,
        passingScore: 60,
        questions: [
          {
            type: 'single',
            question: 'Linux 内核的创始人是谁？',
            options: ['Linus Torvalds', 'Richard Stallman', 'Andrew Tanenbaum', 'Ken Thompson'],
            correctAnswer: 0,
            explanation: 'Linus Torvalds 在 1991 年发布了 Linux 内核。',
            points: 20
          },
          {
            type: 'multiple',
            question: '以下哪些是 Linux 常见的包管理器？（多选）',
            options: ['apt', 'yum', 'npm', 'dnf'],
            correctAnswer: [0, 1, 3],
            explanation: 'apt (Debian/Ubuntu)、yum/dnf (RHEL/CentOS) 是常见包管理器；npm 是 Node.js 的包管理器。',
            points: 25
          },
          {
            type: 'truefalse',
            question: 'Linux 中 rm -rf / 命令可以安全执行。',
            options: ['正确', '错误'],
            correctAnswer: 1,
            explanation: 'rm -rf / 会删除根目录下所有文件，极其危险！',
            points: 15
          },
          {
            type: 'fillblank',
            question: '在 Linux 中，切换用户的命令是 ______。',
            correctAnswer: 'su',
            explanation: 'su (switch user) 命令用于切换用户，su - 可切换环境变量。',
            points: 20
          },
          {
            type: 'code',
            question: '写出 Linux 命令：将文件 test.txt 的权限设置为「所有者读写执行，组用户读执行，其他用户读执行」。',
            correctAnswer: 'chmod 755 test.txt',
            explanation: '7=rwx, 5=rx, 5=rx，所以 chmod 755 test.txt。',
            points: 20
          }
        ]
      });
      setTimeLeft(10 * 60); // 10 分钟
      setLoading(false);
    }, 500);
  };

  useEffect(() => { loadQuiz(); }, [courseId, chapterIdx]);

  // 倒计时
  useEffect(() => {
    if (timeLeft <= 0 || submitted) return;
    const timer = setInterval(() => {
      setTimeLeft(t => {
        if (t <= 1) {
          clearInterval(timer);
          handleSubmit(); // 自动提交
          return 0;
        }
        return t - 1;
      });
    }, 1000);
    return () => clearInterval(timer);
  }, [timeLeft, submitted]);

  const handleAnswerChange = (qIdx: number, value: any) => {
    setAnswers(prev => ({ ...prev, [qIdx]: value }));
  };

  const handleSubmit = () => {
    if (!quiz) return;
    // 计算得分
    let totalScore = 0;
    const newResults: { correct: boolean; explanation?: string }[] = [];
    quiz.questions.forEach((q, idx) => {
      const userAns = answers[idx];
      let correct = false;
      if (q.type === 'single' || q.type === 'truefalse') {
        correct = userAns === q.correctAnswer;
      } else if (q.type === 'multiple') {
        const correctSet = new Set(q.correctAnswer);
        const userSet = new Set(userAns || []);
        correct = correctSet.size === userSet.size && [...correctSet].every(v => userSet.has(v));
      } else if (q.type === 'fillblank') {
        correct = userAns?.trim().toLowerCase() === q.correctAnswer?.toLowerCase();
      } else if (q.type === 'code') {
        // 代码题简单判断：包含关键词即算对
        correct = userAns?.includes(q.correctAnswer) || false;
      }
      if (correct) totalScore += q.points;
      newResults.push({ correct, explanation: q.explanation });
    });
    setScore(totalScore);
    setResults(newResults);
    setSubmitted(true);
    message.success(`提交成功！得分：${totalScore} 分`);
  };

  const formatTime = (s: number) => {
    const m = Math.floor(s / 60);
    const sec = s % 60;
    return `${m.toString().padStart(2, '0')}:${sec.toString().padStart(2, '0')}`;
  };

  if (loading) {
    return (
      <Card>
        <div style={{ textAlign: 'center', padding: 100 }}>
          <Spin size="large" /><p>加载测验中...</p>
        </div>
      </Card>
    );
  }

  if (!quiz) {
    return (
      <Card>
        <Title level={3}>测验未找到</Title>
        <Button onClick={() => navigate(-1)}>返回</Button>
      </Card>
    );
  }

  // 结果页
  if (submitted) {
    const passed = score >= quiz.passingScore;
    return (
      <div>
        <Card style={{ marginBottom: 16 }}>
          <Result
            status={passed ? 'success' : 'error'}
            title={passed ? '🎉 恭喜通过！' : '😅 未通过'}
            subTitle={`得分：${score} / 100（及格线：${quiz.passingScore} 分）`}
            extra={[
              <Button key="retry" onClick={() => { setSubmitted(false); setAnswers({}); setResults([]); setTimeLeft((quiz.timeLimit || 10) * 60); }}>重新答题</Button>,
              <Button key="back" type="primary" onClick={() => navigate(-1)}>返回课程</Button>
            ]}
          />
          <Progress
            percent={score}
            status={passed ? 'success' : 'exception'}
            style={{ margin: '16px 0' }}
          />
        </Card>

        {/* 逐题解析 */}
        <Card title="逐题解析">
          {quiz.questions.map((q, idx) => (
            <div key={idx} style={{ marginBottom: 24, paddingBottom: 16, borderBottom: '1px solid #f0f0f0' }}>
              <Space size={8} style={{ marginBottom: 8 }}>
                {results[idx]?.correct ? (
                  <CheckCircleOutlined style={{ color: '#52c41a', fontSize: 18 }} />
                ) : (
                  <CloseCircleOutlined style={{ color: '#ff4d4f', fontSize: 18 }} />
                )}
                <Text strong>第 {idx + 1} 题（{q.points} 分）</Text>
                <Tag color={results[idx]?.correct ? 'green' : 'red'}>
                  {results[idx]?.correct ? '正确' : '错误'}
                </Tag>
              </Space>
              <Paragraph style={{ margin: '8px 0', fontWeight: 500 }}>{q.question}</Paragraph>
              {q.options && (
                <div style={{ marginLeft: 24 }}>
                  {q.options.map((opt, oIdx) => {
                    const isCorrect = Array.isArray(q.correctAnswer)
                      ? q.correctAnswer.includes(oIdx)
                      : q.correctAnswer === oIdx;
                    return (
                      <div key={oIdx} style={{
                        padding: '4px 8px',
                        borderRadius: 4,
                        background: isCorrect ? '#f6ffed' : (answers[idx] === oIdx && !isCorrect ? '#fff2f0' : 'transparent'),
                        marginBottom: 4
                      }}>
                        <Text>{String.fromCharCode(65 + oIdx)}. {opt}</Text>
                        {isCorrect && <CheckCircleOutlined style={{ color: '#52c41a', marginLeft: 8 }} />}
                      </div>
                    );
                  })}
                </div>
              )}
              {q.type === 'fillblank' && (
                <div style={{ marginLeft: 24 }}>
                  <Text type="secondary">你的答案：</Text>
                  <Text strong style={{ marginLeft: 8 }}>{answers[idx] || '（未作答）'}</Text>
                  <Text type="success" style={{ marginLeft: 16 }}>正确答案：{q.correctAnswer}</Text>
                </div>
              )}
              {q.explanation && (
                <div style={{ marginTop: 8, padding: 8, background: '#fafafa', borderRadius: 4 }}>
                  <TrophyOutlined style={{ color: '#faad14', marginRight: 8 }} />
                  <Text type="secondary">{q.explanation}</Text>
                </div>
              )}
            </div>
          ))}
        </Card>
      </div>
    );
  }

  // 作答页
  return (
    <div>
      {/* 顶部信息栏 */}
      <Card style={{ marginBottom: 16 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <Space>
            <Button icon={<ArrowLeftOutlined />} onClick={() => navigate(-1)}>返回</Button>
            <Title level={4} style={{ margin: 0 }}>{quiz.title}</Title>
            <Tag color="blue">{quiz.questions.length} 题</Tag>
          </Space>
          <Space>
            <ClockCircleOutlined style={{ color: timeLeft < 60 ? '#ff4d4f' : '#1890ff', fontSize: 18 }} />
            <Text strong style={{ color: timeLeft < 60 ? '#ff4d4f' : undefined, fontSize: 16 }}>
              {formatTime(timeLeft)}
            </Text>
            <Tag color={timeLeft < 60 ? 'red' : 'blue'}>
              {timeLeft < 60 ? '即将超时' : '答题中'}
            </Tag>
          </Space>
        </div>
        {quiz.description && (
          <Paragraph type="secondary" style={{ marginTop: 8, marginBottom: 0 }}>
            {quiz.description}
          </Paragraph>
        )}
      </Card>

      {/* 题目列表 */}
      <div style={{ display: 'flex', gap: 16 }}>
        {/* 主答题区 */}
        <div style={{ flex: 1 }}>
          {quiz.questions.map((q, idx) => (
            <Card
              key={idx}
              title={
                <Space>
                  <Tag color="blue">{idx + 1}</Tag>
                  <Text strong>{q.type === 'single' ? '单选题' : q.type === 'multiple' ? '多选题' : q.type === 'truefalse' ? '判断题' : q.type === 'fillblank' ? '填空题' : '代码题'}</Text>
                  <Tag>{q.points} 分</Tag>
                </Space>
              }
              style={{ marginBottom: 16 }}
            >
              <Paragraph strong style={{ fontSize: 16 }}>{q.question}</Paragraph>

              {/* 单选题 */}
              {q.type === 'single' && (
                <Radio.Group
                  value={answers[idx]}
                  onChange={e => handleAnswerChange(idx, e.target.value)}
                  style={{ width: '100%' }}
                >
                  {q.options?.map((opt, oIdx) => (
                    <Radio key={oIdx} value={oIdx} style={{ display: 'block', padding: '8px 0', borderBottom: '1px solid #fafafa' }}>
                      {String.fromCharCode(65 + oIdx)}. {opt}
                    </Radio>
                  ))}
                </Radio.Group>
              )}

              {/* 多选题 */}
              {q.type === 'multiple' && (
                <Checkbox.Group
                  value={answers[idx] || []}
                  onChange={val => handleAnswerChange(idx, val)}
                  style={{ width: '100%' }}
                >
                  {q.options?.map((opt, oIdx) => (
                    <Checkbox key={oIdx} value={oIdx} style={{ display: 'block', padding: '8px 0' }}>
                      {String.fromCharCode(65 + oIdx)}. {opt}
                    </Checkbox>
                  ))}
                </Checkbox.Group>
              )}

              {/* 判断题 */}
              {q.type === 'truefalse' && (
                <Radio.Group
                  value={answers[idx]}
                  onChange={e => handleAnswerChange(idx, e.target.value)}
                  style={{ width: '100%' }}
                >
                  {q.options?.map((opt, oIdx) => (
                    <Radio key={oIdx} value={oIdx} style={{ display: 'block', padding: '8px 0' }}>
                      {opt}
                    </Radio>
                  ))}
                </Radio.Group>
              )}

              {/* 填空题 */}
              {q.type === 'fillblank' && (
                <Input
                  placeholder="请输入答案..."
                  value={answers[idx] || ''}
                  onChange={e => handleAnswerChange(idx, e.target.value)}
                  size="large"
                  style={{ maxWidth: 400 }}
                />
              )}

              {/* 代码题 */}
              {q.type === 'code' && (
                <div>
                  <TextArea
                    placeholder="在此输入你的代码或命令..."
                    value={answers[idx] || ''}
                    onChange={e => handleAnswerChange(idx, e.target.value)}
                    rows={4}
                    style={{ fontFamily: 'monospace', fontSize: 14 }}
                  />
                  <Button
                    type="link"
                    size="small"
                    style={{ marginTop: 4 }}
                    onClick={() => message.info('AI 提示：注意命令格式和参数顺序')}
                  >
                    💡 需要提示？
                  </Button>
                </div>
              )}
            </Card>
          ))}

          {/* 提交按钮 */}
          <div style={{ textAlign: 'center', margin: '24px 0' }}>
            <Button
              type="primary"
              size="large"
              onClick={handleSubmit}
              disabled={Object.keys(answers).length < quiz.questions.length}
              style={{ width: 200 }}
            >
              提交答卷（{Object.keys(answers).length}/{quiz.questions.length}）
            </Button>
            <br />
            <Text type="secondary" style={{ marginTop: 8, display: 'inline-block' }}>
              还有 {quiz.questions.length - Object.keys(answers).length} 题未作答
            </Text>
          </div>
        </div>

        {/* 右侧答题卡 */}
        <div style={{ width: 200 }}>
          <Card title="答题卡" size="small">
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4 }}>
              {quiz.questions.map((_, idx) => (
                <div
                  key={idx}
                  onClick={() => document.getElementById(`question-${idx}`)?.scrollIntoView({ behavior: 'smooth' })}
                  style={{
                    width: 36, height: 36,
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    borderRadius: 4, cursor: 'pointer',
                    background: answers[idx] !== undefined ? '#1890ff' : '#f5f5f5',
                    color: answers[idx] !== undefined ? '#fff' : '#666',
                    fontWeight: 'bold'
                  }}
                >
                  {idx + 1}
                </div>
              ))}
            </div>
            <Divider style={{ margin: '12px 0' }} />
            <div style={{ fontSize: 12 }}>
              <div><span style={{ display: 'inline-block', width: 12, height: 12, background: '#1890ff', borderRadius: 2, marginRight: 4 }} /> 已作答</div>
              <div><span style={{ display: 'inline-block', width: 12, height: 12, background: '#f5f5f5', borderRadius: 2, marginRight: 4 }} /> 未作答</div>
            </div>
          </Card>
        </div>
      </div>
    </div>
  );
}
