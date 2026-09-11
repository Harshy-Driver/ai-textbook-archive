import { useState, useRef, useEffect } from "react";
import { useQuery, useMutation } from "convex/react";
import { api } from "@/convex/_generated/api";
import { AppLayout } from "@/components/AppLayout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Send, User, Bot, ArrowLeft } from "lucide-react";
import { useParams, Link } from "react-router";
import { motion } from "framer-motion";
import type { Id } from "@/convex/_generated/dataModel";

export default function Chat() {
  const { lessonId } = useParams<{ lessonId: string }>();
  const messages = useQuery(
    api.chat.listMessages,
    lessonId ? { lessonId: lessonId as Id<"lessons"> } : "skip"
  );
  const sendMessage = useMutation(api.chat.send);
  const addAssistantMessage = useMutation(api.chat.addAssistantMessage);
  const lesson = useQuery(
    api.lessons.get,
    lessonId ? { lessonId: lessonId as Id<"lessons"> } : "skip"
  );

  const [input, setInput] = useState("");
  const [sending, setSending] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  const handleSend = async () => {
    if (!input.trim() || !lessonId) return;
    const userMessage = input.trim();
    setInput("");
    setSending(true);

    try {
      await sendMessage({
        lessonId: lessonId as Id<"lessons">,
        content: userMessage,
      });

      // Generate AI response (in production this would call an AI API)
      const response = generateAIResponse(userMessage, lesson?.title || "this lesson");
      await addAssistantMessage({
        lessonId: lessonId as Id<"lessons">,
        content: response,
      });
    } catch (e) {
      console.error(e);
    } finally {
      setSending(false);
    }
  };

  const generateAIResponse = (userMsg: string, lessonTitle: string): string => {
    const lower = userMsg.toLowerCase();
    if (lower.includes("explain") || lower.includes("what is") || lower.includes("what are")) {
      return `Great question! Let me explain the key concepts of "${lessonTitle}":\n\nThis lesson covers fundamental topics that build on each other. Based on your uploaded textbook pages, here are the main points:\n\n1. **Core Definition**: The lesson introduces key terminology that forms the foundation for understanding the topic.\n\n2. **Key Principles**: There are several important principles you need to understand, each building on the previous one.\n\n3. **Applications**: These concepts have real-world applications that are commonly tested in exams.\n\nWould you like me to go deeper into any specific part of this lesson?`;
    }
    if (lower.includes("example")) {
      return `Here's an example based on "${lessonTitle}":\n\nImagine you're observing a real-world scenario related to this topic. The key principle applies when specific conditions are met.\n\nFor instance, consider a situation where the variables in this lesson are at play. By applying the formula or concept from your textbook, you can determine the outcome.\n\nStep 1: Identify what's given\nStep 2: Apply the relevant formula/concept\nStep 3: Calculate or determine the result\n\nDoes this help? Would you like more examples?`;
    }
    if (lower.includes("formula")) {
      return `Let me explain the key formulas from "${lessonTitle}":\n\nThe main formula in this lesson relates the key variables together. Each variable has specific units and represents a physical quantity.\n\n**Formula**: The relationship is expressed as an equation that connects the measurable quantities.\n\n**Variables**: Each symbol represents a specific physical quantity with standard units.\n\n**When to use**: Apply this formula when you're given or need to find values related to these quantities.\n\nWould you like me to walk through a calculation using this formula?`;
    }
    if (lower.includes("quiz") || lower.includes("test")) {
      return `I'd be happy to test your understanding! 🎯\n\nBased on "${lessonTitle}", here's a quick question:\n\n**Question**: Which of the following statements about this topic is correct?\n\nA) A commonly mistaken concept\nB) The correct understanding based on the lesson\nC) An unrelated concept\nD) An outdated understanding\n\nCan you think about which answer is correct? Take your time and try to recall the key points from the lesson!`;
    }
    return `I'm here to help you study "${lessonTitle}"! 😊\n\nBased on your uploaded textbook pages, I can help you with:\n\n• **Explaining concepts** - "Explain this lesson"\n• **Providing examples** - "Give me an example"\n• **Formula explanations** - "I don't understand this formula"\n• **Quick quizzes** - "Test me"\n• **Key terms** - "What are the key terms?"\n• **Study tips** - "How should I study this?"\n\nWhat would you like to know about this lesson?`;
  };

  if (!lessonId) {
    return (
      <AppLayout>
        <div className="p-4 sm:p-6 lg:p-8 max-w-3xl mx-auto">
          <h1 className="font-serif-vintage text-2xl font-bold text-foreground mb-4">
            AI Study Tutor
          </h1>
          <p className="text-sm text-muted-foreground mb-4">
            Select a lesson to start chatting
          </p>
          <Link to="/study">
            <Button variant="outline" className="gap-2">
              <ArrowLeft className="h-4 w-4" />
              Go to Study
            </Button>
          </Link>
        </div>
      </AppLayout>
    );
  }

  return (
    <AppLayout>
      <div className="flex flex-col h-[calc(100vh-5rem)] lg:h-screen max-w-3xl mx-auto">
        {/* Header */}
        <div className="px-4 py-3 border-b border-border bg-card/80 backdrop-blur-sm">
          <div className="flex items-center gap-3">
            <Link to={lessonId ? `/study/${lessonId}` : "/study"}>
              <Button variant="ghost" size="icon" className="h-8 w-8">
                <ArrowLeft className="h-4 w-4" />
              </Button>
            </Link>
            <div>
              <h2 className="font-medium text-sm text-foreground">
                Ask AI About This Lesson
              </h2>
              <p className="text-xs text-muted-foreground">
                {lesson?.title || "Loading..."}
              </p>
            </div>
          </div>
        </div>

        {/* Messages */}
        <div className="flex-1 overflow-y-auto px-4 py-4 space-y-4">
          {/* Welcome message */}
          {(!messages || messages.length === 0) && (
            <motion.div
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              className="text-center py-8"
            >
              <div className="w-12 h-12 rounded-full bg-primary/10 flex items-center justify-center mx-auto mb-3">
                <Bot className="h-6 w-6 text-primary" />
              </div>
              <h3 className="font-serif-vintage font-bold text-foreground mb-1">
                AI Study Tutor
              </h3>
              <p className="text-sm text-muted-foreground mb-4">
                Ask me anything about this lesson
              </p>
              <div className="flex flex-wrap gap-2 justify-center">
                {["Explain this lesson", "Give me an example", "Test me"].map((q) => (
                  <button
                    key={q}
                    onClick={() => { setInput(q); }}
                    className="px-3 py-1.5 rounded-full bg-secondary text-xs font-medium text-foreground hover:bg-primary/10 transition-colors"
                  >
                    {q}
                  </button>
                ))}
              </div>
            </motion.div>
          )}

          {messages?.map((msg) => (
            <motion.div
              key={msg._id}
              initial={{ opacity: 0, y: 5 }}
              animate={{ opacity: 1, y: 0 }}
              className={`flex gap-2.5 ${msg.role === "user" ? "justify-end" : "justify-start"}`}
            >
              {msg.role === "assistant" && (
                <div className="w-7 h-7 rounded-full bg-primary/10 flex items-center justify-center shrink-0 mt-0.5">
                  <Bot className="h-3.5 w-3.5 text-primary" />
                </div>
              )}
              <div
                className={`max-w-[80%] rounded-2xl px-4 py-2.5 text-sm ${
                  msg.role === "user"
                    ? "bg-primary text-primary-foreground rounded-br-md"
                    : "bg-secondary text-foreground rounded-bl-md"
                }`}
              >
                <div className="whitespace-pre-wrap leading-relaxed">{msg.content}</div>
              </div>
              {msg.role === "user" && (
                <div className="w-7 h-7 rounded-full bg-secondary flex items-center justify-center shrink-0 mt-0.5">
                  <User className="h-3.5 w-3.5" />
                </div>
              )}
            </motion.div>
          ))}

          {sending && (
            <div className="flex gap-2.5">
              <div className="w-7 h-7 rounded-full bg-primary/10 flex items-center justify-center shrink-0">
                <Bot className="h-3.5 w-3.5 text-primary" />
              </div>
              <div className="bg-secondary rounded-2xl rounded-bl-md px-4 py-3">
                <div className="flex gap-1">
                  <span className="w-1.5 h-1.5 rounded-full bg-muted-foreground animate-bounce" style={{ animationDelay: "0ms" }} />
                  <span className="w-1.5 h-1.5 rounded-full bg-muted-foreground animate-bounce" style={{ animationDelay: "150ms" }} />
                  <span className="w-1.5 h-1.5 rounded-full bg-muted-foreground animate-bounce" style={{ animationDelay: "300ms" }} />
                </div>
              </div>
            </div>
          )}
          <div ref={messagesEndRef} />
        </div>

        {/* Input */}
        <div className="px-4 py-3 border-t border-border bg-card/80 backdrop-blur-sm">
          <form
            onSubmit={(e) => { e.preventDefault(); handleSend(); }}
            className="flex gap-2"
          >
            <Input
              value={input}
              onChange={(e) => setInput(e.target.value)}
              placeholder="Ask about this lesson..."
              disabled={sending}
              className="flex-1"
              onKeyDown={(e) => {
                if (e.key === "Enter" && !e.shiftKey) {
                  e.preventDefault();
                  handleSend();
                }
              }}
            />
            <Button type="submit" size="icon" disabled={!input.trim() || sending}>
              <Send className="h-4 w-4" />
            </Button>
          </form>
        </div>
      </div>
    </AppLayout>
  );
}
