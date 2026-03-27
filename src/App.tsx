import React, { useState, useRef, useEffect } from 'react';
import { Send, User, Bot, Loader2, Sparkles } from 'lucide-react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { cn } from './lib/utils';

type Message = {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  isThinking?: boolean;
};

export default function App() {
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!input.trim() || isLoading) return;

    const userMessage: Message = {
      id: Date.now().toString(),
      role: 'user',
      content: input.trim(),
    };

    setMessages((prev) => [...prev, userMessage]);
    setInput('');
    setIsLoading(true);

    const assistantMessageId = (Date.now() + 1).toString();
    setMessages((prev) => [
      ...prev,
      { id: assistantMessageId, role: 'assistant', content: '', isThinking: true },
    ]);

    try {
      const response = await fetch('/api/chat', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          messages: [...messages, userMessage].map(({ role, content }) => ({ role, content })),
        }),
      });

      if (!response.ok) {
        throw new Error('Failed to fetch response');
      }

      if (!response.body) throw new Error('No response body');

      const reader = response.body.getReader();
      const decoder = new TextDecoder('utf-8');
      let done = false;
      let assistantContent = '';
      let buffer = '';

      setMessages((prev) =>
        prev.map((msg) =>
          msg.id === assistantMessageId ? { ...msg, isThinking: false } : msg
        )
      );

      while (!done) {
        const { value, done: readerDone } = await reader.read();
        done = readerDone;
        if (value) {
          buffer += decoder.decode(value, { stream: true });
          const lines = buffer.split('\n');
          buffer = lines.pop() || ''; // Keep the last incomplete line in the buffer
          
          for (const line of lines) {
            const trimmedLine = line.trim();
            if (trimmedLine.startsWith('data: ') && trimmedLine !== 'data: [DONE]') {
              try {
                const data = JSON.parse(trimmedLine.slice(6));
                if (data.choices && data.choices[0].delta && data.choices[0].delta.content) {
                  assistantContent += data.choices[0].delta.content;
                  setMessages((prev) =>
                    prev.map((msg) =>
                      msg.id === assistantMessageId
                        ? { ...msg, content: assistantContent }
                        : msg
                    )
                  );
                }
              } catch (e) {
                console.error('Error parsing stream data:', e, trimmedLine);
              }
            }
          }
        }
      }
    } catch (error) {
      console.error('Chat error:', error);
      setMessages((prev) => [
        ...prev,
        {
          id: Date.now().toString(),
          role: 'assistant',
          content: 'Sorry, I encountered an error while processing your request.',
        },
      ]);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="flex flex-col h-screen bg-neutral-50 dark:bg-neutral-900 text-neutral-900 dark:text-neutral-100 font-sans">
      {/* Header */}
      <header className="flex items-center justify-between px-6 py-4 bg-white dark:bg-neutral-950 border-b border-neutral-200 dark:border-neutral-800 shadow-sm z-10">
        <div className="flex items-center gap-2">
          <div className="p-2 bg-blue-600 rounded-lg">
            <Sparkles className="w-5 h-5 text-white" />
          </div>
          <h1 className="text-xl font-semibold tracking-tight">Qwen 3.5 Chat</h1>
        </div>
        <div className="text-xs font-medium px-2.5 py-1 rounded-full bg-neutral-100 dark:bg-neutral-800 text-neutral-500 dark:text-neutral-400">
          Powered by NVIDIA API
        </div>
      </header>

      {/* Chat Area */}
      <main className="flex-1 overflow-y-auto p-4 sm:p-6">
        <div className="max-w-3xl mx-auto space-y-6">
          {messages.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-[60vh] text-center space-y-4">
              <div className="w-16 h-16 bg-blue-100 dark:bg-blue-900/30 rounded-full flex items-center justify-center mb-4">
                <Bot className="w-8 h-8 text-blue-600 dark:text-blue-400" />
              </div>
              <h2 className="text-2xl font-semibold">How can I help you today?</h2>
              <p className="text-neutral-500 dark:text-neutral-400 max-w-md">
                I'm Qwen 3.5 (122B), an advanced AI model. Ask me anything, from coding and writing to complex problem-solving.
              </p>
            </div>
          ) : (
            messages.map((message) => (
              <div
                key={message.id}
                className={cn(
                  "flex gap-4 p-4 rounded-2xl",
                  message.role === 'user' 
                    ? "bg-white dark:bg-neutral-800 border border-neutral-200 dark:border-neutral-700 ml-auto max-w-[85%]" 
                    : "bg-transparent max-w-full"
                )}
              >
                <div className={cn(
                  "flex-shrink-0 w-8 h-8 rounded-full flex items-center justify-center mt-1",
                  message.role === 'user' 
                    ? "bg-neutral-200 dark:bg-neutral-700 text-neutral-600 dark:text-neutral-300" 
                    : "bg-blue-600 text-white"
                )}>
                  {message.role === 'user' ? <User className="w-5 h-5" /> : <Bot className="w-5 h-5" />}
                </div>
                
                <div className="flex-1 min-w-0">
                  <div className="font-medium text-sm mb-1 text-neutral-500 dark:text-neutral-400">
                    {message.role === 'user' ? 'You' : 'Qwen 3.5'}
                  </div>
                  
                  {message.isThinking ? (
                    <div className="flex items-center gap-2 text-neutral-500 dark:text-neutral-400 py-2">
                      <Loader2 className="w-4 h-4 animate-spin" />
                      <span className="text-sm">Thinking...</span>
                    </div>
                  ) : (
                    <div className="prose prose-neutral dark:prose-invert max-w-none prose-p:leading-relaxed prose-pre:bg-neutral-900 prose-pre:text-neutral-100 prose-pre:border prose-pre:border-neutral-800">
                      <ReactMarkdown remarkPlugins={[remarkGfm]}>
                        {message.content}
                      </ReactMarkdown>
                    </div>
                  )}
                </div>
              </div>
            ))
          )}
          <div ref={messagesEndRef} />
        </div>
      </main>

      {/* Input Area */}
      <footer className="bg-white dark:bg-neutral-950 border-t border-neutral-200 dark:border-neutral-800 p-4">
        <div className="max-w-3xl mx-auto">
          <form 
            onSubmit={handleSubmit}
            className="relative flex items-end gap-2 bg-neutral-100 dark:bg-neutral-900 rounded-3xl p-2 border border-neutral-200 dark:border-neutral-800 focus-within:ring-2 focus-within:ring-blue-500/50 focus-within:border-blue-500 transition-all"
          >
            <textarea
              value={input}
              onChange={(e) => {
                setInput(e.target.value);
                e.target.style.height = 'auto';
                e.target.style.height = `${Math.min(e.target.scrollHeight, 128)}px`;
              }}
              onKeyDown={(e) => {
                if (e.key === 'Enter' && !e.shiftKey) {
                  e.preventDefault();
                  handleSubmit(e);
                  e.currentTarget.style.height = 'auto';
                }
              }}
              placeholder="Message Qwen..."
              className="flex-1 max-h-32 min-h-[44px] bg-transparent border-0 focus:ring-0 resize-none py-3 px-4 text-base"
              rows={1}
              style={{ height: 'auto' }}
            />
            <button
              type="submit"
              disabled={!input.trim() || isLoading}
              className="flex-shrink-0 w-10 h-10 rounded-full bg-blue-600 hover:bg-blue-700 disabled:bg-neutral-300 disabled:dark:bg-neutral-700 disabled:text-neutral-500 text-white flex items-center justify-center transition-colors mb-1 mr-1"
            >
              <Send className="w-5 h-5 ml-0.5" />
            </button>
          </form>
          <div className="text-center mt-3 text-xs text-neutral-500 dark:text-neutral-400">
            AI can make mistakes. Consider verifying important information.
          </div>
        </div>
      </footer>
    </div>
  );
}
