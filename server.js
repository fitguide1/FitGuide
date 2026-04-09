// server.js
const express = require('express');
const cors    = require('cors');
const path    = require('path');
const Stripe = require("stripe");

const app  = express();
const PORT = 3000;

const stripe = new Stripe(process.env.price_1TK7dcEdYyHE5Z2pC9Tp1Sbv);

// ── Middleware ──────────────────────────────────────
app.use(cors());
app.use(express.json());

// ── Serve FitGuide.html at the root ────────────────
app.use(express.static(path.join(__dirname)));
app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'FitGuide.html'));
});

// ── POST /api/chat ──────────────────────────────────
// ── POST /create-checkout-session ───────────────────
app.post('/create-checkout-session', async (req, res) => {
  try {
    const session = await stripe.checkout.sessions.create({
      payment_method_types: ['card'],
      mode: 'subscription',
      line_items: [
        {
          price: 'price_XXXXXXXX', // 🔥 REPLACE WITH YOUR STRIPE PRICE ID
          quantity: 1,
        },
      ],
      success_url: 'http://localhost:3000/success',
      cancel_url: 'http://localhost:3000/cancel',
    });

    res.json({ url: session.url });

  } catch (err) {
    console.error('Stripe error:', err);
    res.status(500).json({ error: 'Stripe error' });
  }
});

app.post('/api/chat', async (req, res) => {
  const { message } = req.body;
  console.log('>> /api/chat hit. Message length:', message?.length);

  if (!message) {
    return res.status(400).json({ error: 'No message provided.' });
  }

  if (!process.env.GROQ_API_KEY) {
    console.error('ERROR: GROQ_API_KEY is not set in .env');
    return res.status(500).json({ error: 'GROQ_API_KEY is missing from .env file.' });
  }

  const prompt = `You are a sports scientist. Analyze this workout and return ONLY a JSON object, no other text.
Use specific clinical language with actual numbers (e.g. "3-6 cm vertical jump increase", "5-10% sprint improvement").
JSON structure:
{"archetypeIcon":"<emoji>","archetypeTitle":"<The X Athlete>","archetypeDesc":"<2 sentences>","statPills":["<label>","<label>","<label>"],"timeline":[{"period":"Weeks 1-2","emoji":"<emoji>","description":"<text>"},{"period":"Weeks 3-4","emoji":"<emoji>","description":"<text>"},{"period":"Weeks 6-8","emoji":"<emoji>","description":"<text>"},{"period":"Weeks 10-14","emoji":"<emoji>","description":"<text>"},{"period":"Month 4+","emoji":"<emoji>","description":"<text>"}],"metrics":[{"icon":"<emoji>","name":"<metric>","detail":"<specific improvement with units>","tag":"<tag>"},{"icon":"<emoji>","name":"<metric>","detail":"<text>","tag":"<tag>"},{"icon":"<emoji>","name":"<metric>","detail":"<text>","tag":"<tag>"},{"icon":"<emoji>","name":"<metric>","detail":"<text>","tag":"<tag>"}],"sports":["<emoji sport>","<emoji sport>","<emoji sport>","<emoji sport>"]}
Workout: ${message}`;

  try {
    console.log('>> Calling Groq API...');

    const groqRes = await fetch('https://api.groq.com/openai/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${process.env.GROQ_API_KEY}`
      },
      body: JSON.stringify({
        model: 'llama-3.3-70b-versatile',
        max_tokens: 1000,
        messages: [{ role: 'user', content: prompt }]
      })
    });

    console.log('>> Groq response status:', groqRes.status);

    if (!groqRes.ok) {
      const err = await groqRes.text();
      console.error('>> Groq error body:', err);
      return res.status(502).json({ error: 'Groq API error', detail: err });
    }

    const data  = await groqRes.json();
    const text  = data.choices?.[0]?.message?.content || '';
    console.log('>> Groq raw response:', text.substring(0, 200));

    const clean  = text.replace(/```json|```/g, '').trim();
    const parsed = JSON.parse(clean);

    console.log('>> Success — sending result to frontend');
    res.json(parsed);

  } catch (err) {
    console.error('>> Server catch error:', err.message);
    res.status(500).json({ error: err.message });
  }
});

// ── Start ───────────────────────────────────────────
app.listen(PORT, () => {
  console.log(`FitGuide backend running at http://localhost:${PORT}`);
  console.log(`GROQ_API_KEY loaded: ${process.env.GROQ_API_KEY ? 'YES' : 'NO — check your .env file!'}`);
});
