// server.js
const express = require('express');
const cors    = require('cors');
const path    = require('path');

const app  = express();
const PORT = process.env.PORT || 3000;

app.use(cors());
app.use(express.json());
app.use(express.static(path.join(__dirname)));
app.get('/', (req, res) => res.sendFile(path.join(__dirname, 'FitGuide.html')));

app.post('/api/chat', async (req, res) => {
  const { message } = req.body;
  if (!message) return res.status(400).json({ error: 'No message provided.' });
  if (!process.env.GROQ_API_KEY) return res.status(500).json({ error: 'GROQ_API_KEY not set in .env' });

  const prompt = `You are a sports scientist. Analyze this workout and return ONLY a JSON object, no other text.
Use specific clinical language with actual numbers (e.g. "3-6 cm vertical jump increase", "5-10% sprint improvement").
JSON structure:
{"archetypeIcon":"<single emoji>","archetypeTitle":"<The X Athlete>","archetypeDesc":"<2 sentences>","statPills":["<label>","<label>","<label>"],"timeline":[{"period":"Weeks 1-2","emoji":"<emoji>","description":"<text>"},{"period":"Weeks 3-4","emoji":"<emoji>","description":"<text>"},{"period":"Weeks 6-8","emoji":"<emoji>","description":"<text>"},{"period":"Weeks 10-14","emoji":"<emoji>","description":"<text>"},{"period":"Month 4+","emoji":"<emoji>","description":"<text>"}],"metrics":[{"icon":"<emoji>","name":"<metric>","detail":"<specific improvement with units>","tag":"<tag>"},{"icon":"<emoji>","name":"<metric>","detail":"<text>","tag":"<tag>"},{"icon":"<emoji>","name":"<metric>","detail":"<text>","tag":"<tag>"},{"icon":"<emoji>","name":"<metric>","detail":"<text>","tag":"<tag>"}],"sports":["<emoji sport>","<emoji sport>","<emoji sport>","<emoji sport>"]}
Workout: ${message}`;

  try {
    console.log('>> /api/chat — analyzing workout');
    const groqRes = await fetch('https://api.groq.com/openai/v1/chat/completions', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${process.env.GROQ_API_KEY}` },
      body: JSON.stringify({ model: 'llama-3.3-70b-versatile', max_tokens: 1000, messages: [{ role: 'user', content: prompt }] })
    });

    if (!groqRes.ok) {
      const err = await groqRes.text();
      console.error('Groq error:', err);
      return res.status(502).json({ error: 'Groq API error', detail: err });
    }

    const data   = await groqRes.json();
    const text   = data.choices?.[0]?.message?.content || '';
    const clean  = text.replace(/```json|```/g, '').trim();
    const parsed = JSON.parse(clean);
    console.log('>> Success');
    res.json(parsed);

  } catch (err) {
    console.error('Server error:', err.message);
    res.status(500).json({ error: err.message });
  }
});

app.listen(PORT, () => {
  console.log(`FitGuide running at http://localhost:${PORT}`);
  console.log(`GROQ_API_KEY: ${process.env.GROQ_API_KEY ? 'SET ✓' : 'MISSING ✗'}`);
});
