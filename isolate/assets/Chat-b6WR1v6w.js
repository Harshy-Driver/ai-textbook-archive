import{j as e,m as f}from"./framer-motion-Bw1wQKg3.js";import{h as S,r as i,L as g}from"./react-vendor-Bw4YA5fN.js";import{c as k,d as b,b as l,a as j}from"./index-DhDYKlZH.js";import{A as v,U as M}from"./AppLayout-B83RHrQV.js";import{B as u}from"./button-ChgbMwU4.js";import{I as E}from"./input-BFPjFjpQ.js";import{A as w}from"./arrow-left-C0i7GFrr.js";import"./radix-ui-Df10XL9U.js";import"./logo-aTet4jo7.js";import"./charts-TRXDlP8y.js";import"./graduation-cap-xPKTjNRx.js";import"./circle-question-mark-qs7AeHdz.js";const L=[["path",{d:"M12 8V4H8",key:"hb8ula"}],["rect",{width:"16",height:"12",x:"4",y:"8",rx:"2",key:"enze0r"}],["path",{d:"M2 14h2",key:"vft8re"}],["path",{d:"M20 14h2",key:"4cs60a"}],["path",{d:"M15 13v2",key:"1xurst"}],["path",{d:"M9 13v2",key:"rq6x2g"}]],m=k("bot",L);const T=[["path",{d:"M14.536 21.686a.5.5 0 0 0 .937-.024l6.5-19a.496.496 0 0 0-.635-.635l-19 6.5a.5.5 0 0 0-.024.937l7.93 3.18a2 2 0 0 1 1.112 1.11z",key:"1ffxy3"}],["path",{d:"m21.854 2.147-10.94 10.939",key:"12cjpa"}]],q=k("send",T);function P(){const{lessonId:t}=S(),r=b(l.chat.listMessages,t?{lessonId:t}:"skip"),N=j(l.chat.send),A=j(l.chat.addAssistantMessage),h=b(l.lessons.get,t?{lessonId:t}:"skip"),[o,d]=i.useState(""),[c,p]=i.useState(!1),x=i.useRef(null);i.useEffect(()=>{x.current?.scrollIntoView({behavior:"smooth"})},[r]);const y=async()=>{if(!o.trim()||!t)return;const s=o.trim();d(""),p(!0);try{await N({lessonId:t,content:s});const a=I(s,h?.title||"this lesson");await A({lessonId:t,content:a})}catch(a){console.error(a)}finally{p(!1)}},I=(s,a)=>{const n=s.toLowerCase();return n.includes("explain")||n.includes("what is")||n.includes("what are")?`Great question! Let me explain the key concepts of "${a}":

This lesson covers fundamental topics that build on each other. Based on your uploaded textbook pages, here are the main points:

1. **Core Definition**: The lesson introduces key terminology that forms the foundation for understanding the topic.

2. **Key Principles**: There are several important principles you need to understand, each building on the previous one.

3. **Applications**: These concepts have real-world applications that are commonly tested in exams.

Would you like me to go deeper into any specific part of this lesson?`:n.includes("example")?`Here's an example based on "${a}":

Imagine you're observing a real-world scenario related to this topic. The key principle applies when specific conditions are met.

For instance, consider a situation where the variables in this lesson are at play. By applying the formula or concept from your textbook, you can determine the outcome.

Step 1: Identify what's given
Step 2: Apply the relevant formula/concept
Step 3: Calculate or determine the result

Does this help? Would you like more examples?`:n.includes("formula")?`Let me explain the key formulas from "${a}":

The main formula in this lesson relates the key variables together. Each variable has specific units and represents a physical quantity.

**Formula**: The relationship is expressed as an equation that connects the measurable quantities.

**Variables**: Each symbol represents a specific physical quantity with standard units.

**When to use**: Apply this formula when you're given or need to find values related to these quantities.

Would you like me to walk through a calculation using this formula?`:n.includes("quiz")||n.includes("test")?`I'd be happy to test your understanding! 🎯

Based on "${a}", here's a quick question:

**Question**: Which of the following statements about this topic is correct?

A) A commonly mistaken concept
B) The correct understanding based on the lesson
C) An unrelated concept
D) An outdated understanding

Can you think about which answer is correct? Take your time and try to recall the key points from the lesson!`:`I'm here to help you study "${a}"! 😊

Based on your uploaded textbook pages, I can help you with:

• **Explaining concepts** - "Explain this lesson"
• **Providing examples** - "Give me an example"
• **Formula explanations** - "I don't understand this formula"
• **Quick quizzes** - "Test me"
• **Key terms** - "What are the key terms?"
• **Study tips** - "How should I study this?"

What would you like to know about this lesson?`};return t?e.jsx(v,{children:e.jsxs("div",{className:"flex flex-col h-[calc(100vh-5rem)] lg:h-screen max-w-3xl mx-auto",children:[e.jsx("div",{className:"px-4 py-3 border-b border-border bg-card/80 backdrop-blur-sm",children:e.jsxs("div",{className:"flex items-center gap-3",children:[e.jsx(g,{to:t?`/study/${t}`:"/study",children:e.jsx(u,{variant:"ghost",size:"icon",className:"h-8 w-8",children:e.jsx(w,{className:"h-4 w-4"})})}),e.jsxs("div",{children:[e.jsx("h2",{className:"font-medium text-sm text-foreground",children:"Ask AI About This Lesson"}),e.jsx("p",{className:"text-xs text-muted-foreground",children:h?.title||"Loading..."})]})]})}),e.jsxs("div",{className:"flex-1 overflow-y-auto px-4 py-4 space-y-4",children:[(!r||r.length===0)&&e.jsxs(f.div,{initial:{opacity:0,y:10},animate:{opacity:1,y:0},className:"text-center py-8",children:[e.jsx("div",{className:"w-12 h-12 rounded-full bg-primary/10 flex items-center justify-center mx-auto mb-3",children:e.jsx(m,{className:"h-6 w-6 text-primary"})}),e.jsx("h3",{className:"font-serif-vintage font-bold text-foreground mb-1",children:"AI Study Tutor"}),e.jsx("p",{className:"text-sm text-muted-foreground mb-4",children:"Ask me anything about this lesson"}),e.jsx("div",{className:"flex flex-wrap gap-2 justify-center",children:["Explain this lesson","Give me an example","Test me"].map(s=>e.jsx("button",{onClick:()=>{d(s)},className:"px-3 py-1.5 rounded-full bg-secondary text-xs font-medium text-foreground hover:bg-primary/10 transition-colors",children:s},s))})]}),r?.map(s=>e.jsxs(f.div,{initial:{opacity:0,y:5},animate:{opacity:1,y:0},className:`flex gap-2.5 ${s.role==="user"?"justify-end":"justify-start"}`,children:[s.role==="assistant"&&e.jsx("div",{className:"w-7 h-7 rounded-full bg-primary/10 flex items-center justify-center shrink-0 mt-0.5",children:e.jsx(m,{className:"h-3.5 w-3.5 text-primary"})}),e.jsx("div",{className:`max-w-[80%] rounded-2xl px-4 py-2.5 text-sm ${s.role==="user"?"bg-primary text-primary-foreground rounded-br-md":"bg-secondary text-foreground rounded-bl-md"}`,children:e.jsx("div",{className:"whitespace-pre-wrap leading-relaxed",children:s.content})}),s.role==="user"&&e.jsx("div",{className:"w-7 h-7 rounded-full bg-secondary flex items-center justify-center shrink-0 mt-0.5",children:e.jsx(M,{className:"h-3.5 w-3.5"})})]},s._id)),c&&e.jsxs("div",{className:"flex gap-2.5",children:[e.jsx("div",{className:"w-7 h-7 rounded-full bg-primary/10 flex items-center justify-center shrink-0",children:e.jsx(m,{className:"h-3.5 w-3.5 text-primary"})}),e.jsx("div",{className:"bg-secondary rounded-2xl rounded-bl-md px-4 py-3",children:e.jsxs("div",{className:"flex gap-1",children:[e.jsx("span",{className:"w-1.5 h-1.5 rounded-full bg-muted-foreground animate-bounce",style:{animationDelay:"0ms"}}),e.jsx("span",{className:"w-1.5 h-1.5 rounded-full bg-muted-foreground animate-bounce",style:{animationDelay:"150ms"}}),e.jsx("span",{className:"w-1.5 h-1.5 rounded-full bg-muted-foreground animate-bounce",style:{animationDelay:"300ms"}})]})})]}),e.jsx("div",{ref:x})]}),e.jsx("div",{className:"px-4 py-3 border-t border-border bg-card/80 backdrop-blur-sm",children:e.jsxs("form",{onSubmit:s=>{s.preventDefault(),y()},className:"flex gap-2",children:[e.jsx(E,{value:o,onChange:s=>d(s.target.value),placeholder:"Ask about this lesson...",disabled:c,className:"flex-1",onKeyDown:s=>{s.key==="Enter"&&!s.shiftKey&&(s.preventDefault(),y())}}),e.jsx(u,{type:"submit",size:"icon",disabled:!o.trim()||c,children:e.jsx(q,{className:"h-4 w-4"})})]})})]})}):e.jsx(v,{children:e.jsxs("div",{className:"p-4 sm:p-6 lg:p-8 max-w-3xl mx-auto",children:[e.jsx("h1",{className:"font-serif-vintage text-2xl font-bold text-foreground mb-4",children:"AI Study Tutor"}),e.jsx("p",{className:"text-sm text-muted-foreground mb-4",children:"Select a lesson to start chatting"}),e.jsx(g,{to:"/study",children:e.jsxs(u,{variant:"outline",className:"gap-2",children:[e.jsx(w,{className:"h-4 w-4"}),"Go to Study"]})})]})})}export{P as default};
