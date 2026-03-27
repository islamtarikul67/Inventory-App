import express from 'express';
import { createServer as createViteServer } from 'vite';
import path from 'path';
import dotenv from 'dotenv';

dotenv.config();

const app = express();
const PORT = 3000;

app.use(express.json());

app.post('/api/chat', async (req, res) => {
  const { messages } = req.body;

  const invoke_url = "https://integrate.api.nvidia.com/v1/chat/completions";
  const stream = true;

  const headers = {
    "Authorization": `Bearer ${process.env.NVIDIA_API_KEY || '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'}`,
    "Accept": "text/event-stream",
    "Content-Type": "application/json"
  };

  const payload = {
    "model": "qwen/qwen3.5-122b-a10b",
    "messages": messages,
    "max_tokens": 16384,
    "temperature": 0.60,
    "top_p": 0.95,
    "stream": stream,
    "chat_template_kwargs": {"enable_thinking": true},
  };

  try {
    const response = await fetch(invoke_url, {
      method: 'POST',
      headers: headers,
      body: JSON.stringify(payload)
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error('NVIDIA API Error:', response.status, errorText);
      return res.status(response.status).json({ error: 'Failed to fetch from NVIDIA API' });
    }

    res.setHeader('Content-Type', 'text/event-stream');
    res.setHeader('Cache-Control', 'no-cache');
    res.setHeader('Connection', 'keep-alive');

    if (response.body) {
      const reader = response.body.getReader();
      const decoder = new TextDecoder('utf-8');
      
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        res.write(decoder.decode(value, { stream: true }));
      }
      res.end();
    } else {
      res.end();
    }
  } catch (error) {
    console.error('Error calling NVIDIA API:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

async function startServer() {
  if (process.env.NODE_ENV !== 'production') {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), 'dist');
    app.use(express.static(distPath));
    app.get('*', (req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`Server running on http://localhost:${PORT}`);
  });
}

startServer();
