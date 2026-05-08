require('dotenv').config();
const express = require('express');
const cors = require('cors');
const path = require('path');
const { saveSearch, getHistory, getSearchById } = require('./database');

const app = express();
app.use(cors());
app.use(express.json());
app.use(express.static(path.join(__dirname, '../public')));

const OPENROUTER_API_KEY = process.env.OPENROUTER_API_KEY;

const MODELS = [
  "google/gemini-2.0-flash-001",
  "meta-llama/llama-3.3-70b-instruct",
  "mistralai/mistral-7b-instruct"
];

async function callOpenRouter(prompt) {
  for (const model of MODELS) {
    try {
      const res = await fetch("https://openrouter.ai/api/v1/chat/completions", {
        method: "POST",
        headers: {
          "Authorization": `Bearer ${OPENROUTER_API_KEY}`,
          "Content-Type": "application/json",
          "HTTP-Referer": "https://govfundnavigator.in",
          "X-Title": "GovFund Navigator"
        },
        body: JSON.stringify({
          model,
          messages: [{ role: "user", content: prompt }],
          temperature: 0.3
        })
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = await res.json();
      const text = data.choices[0].message.content.trim();
      return text.replace(/```json|```/g, "").trim();
    } catch (err) {
      console.warn(`Model ${model} failed:`, err.message);
    }
  }
  throw new Error("All models failed");
}

// AGENT 1
async function agent1(biz) {
  const prompt = `
You are a government funding eligibility expert for India.
Analyze this business and give an eligibility score out of 100 for Indian government funding schemes.

Business Details:
- Name: ${biz.name}
- Type: ${biz.type}
- State: ${biz.state}
- Annual Revenue: ${biz.revenue}
- Years in Operation: ${biz.age}
- Sector: ${biz.sector}
- Description: ${biz.desc}

Respond ONLY in this exact JSON format, no extra text:
{
  "score": <number 0-100>,
  "summary": "<2 sentence summary>",
  "strengths": ["<s1>", "<s2>", "<s3>"],
  "gaps": ["<g1>", "<g2>"]
}`;
  const raw = await callOpenRouter(prompt);
  return JSON.parse(raw);
}

// AGENT 2
async function agent2(biz, a1) {
  const prompt = `
You are an expert in Indian government funding schemes (central and state level).
Recommend the top 5 most relevant government schemes for this business.

Business Details:
- Name: ${biz.name}
- Type: ${biz.type}
- State: ${biz.state}
- Revenue: ${biz.revenue}
- Age: ${biz.age}
- Sector: ${biz.sector}
- Description: ${biz.desc}

Agent 1 Score: ${a1.score}/100
Strengths: ${a1.strengths.join(", ")}
Gaps: ${a1.gaps.join(", ")}

Respond ONLY in this exact JSON format, no extra text:
{
  "schemes": [
    {
      "name": "<Official scheme name>",
      "ministry": "<Ministry>",
      "benefit": "<What they get e.g. 35% subsidy up to ₹10L>",
      "matchScore": <60-99>,
      "description": "<2 sentences why this matches>",
      "documents": ["<doc1>", "<doc2>", "<doc3>", "<doc4>", "<doc5>"],
      "deadline": "<Ongoing / Month Year>",
      "applyUrl": "<https://official gov url>"
    }
  ]
}

Use REAL Indian government schemes like PMEGP, Mudra, Startup India, WEP, NABARD, PM FME, TUFS, TIDE 2.0, Stand-Up India, state schemes for ${biz.state}.`;
  const raw = await callOpenRouter(prompt);
  return JSON.parse(raw);
}

// MAIN ANALYZE ENDPOINT
app.post('/api/analyze', async (req, res) => {
  const biz = req.body;
  try {
    const a1 = await agent1(biz);
    const a2 = await agent2(biz, a1);

    saveSearch({
      business_name: biz.name || "Unnamed",
      business_type: biz.type,
      state: biz.state,
      sector: biz.sector,
      score: a1.score,
      schemes: a2.schemes
    });

    res.json({ agent1: a1, agent2: a2 });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: err.message });
  }
});

// HISTORY ENDPOINT
app.get('/api/history', (req, res) => {
  res.json(getHistory());
});

// SINGLE SEARCH ENDPOINT
app.get('/api/history/:id', (req, res) => {
  const row = getSearchById(req.params.id);
  if (!row) return res.status(404).json({ error: "Not found" });
  row.schemes = JSON.parse(row.schemes_json);
  res.json(row);
});

app.listen(3000, () => console.log('GovFund Navigator running on http://localhost:3000'));