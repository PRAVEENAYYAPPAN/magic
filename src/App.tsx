import { useState, useRef, useEffect, useCallback } from "react";

// ╔══════════════════════════════════════════════════════════╗
// ║  ✦ MAGIC — Agent Swarm Intelligence                     ║
// ║  100% FREE · Animated · Optimized · Impressive          ║
// ╚══════════════════════════════════════════════════════════╝

// ── FREE CLAUDE MODELS ONLY ───────────────────────────────
const CLAUDE_MODELS = [
  { id:"claude-sonnet-4-5",         label:"Sonnet 4.6", desc:"Efficient for everyday tasks",    speed:"Fast",    power:90 },
  { id:"claude-haiku-4-5-20251001", label:"Haiku 4.5",  desc:"Fast & lightweight",              speed:"Fastest", power:72 },
  { id:"claude-sonnet-4-5",         label:"Sonnet 4.5", desc:"Previous Sonnet generation",      speed:"Fast",    power:82 },
];

// ── FREE THINKING MODELS (OpenRouter) ─────────────────────
const THINKING_MODELS = [
  { id:"deepseek/deepseek-r1:free",                      label:"DeepSeek R1",    desc:"Best open-source reasoning",      color:"#4FC3F7", glow:"#4FC3F722", icon:"🧠", think_tag:true  },
  { id:"qwen/qwq-32b:free",                              label:"QwQ 32B",        desc:"Qwen chain-of-thought",           color:"#CE93D8", glow:"#CE93D822", icon:"⚡", think_tag:true  },
  { id:"deepseek/deepseek-r1-distill-qwen-32b:free",    label:"R1 Distill 32B", desc:"Distilled DeepSeek R1, fast",     color:"#80DEEA", glow:"#80DEEA22", icon:"🔬", think_tag:true  },
  { id:"meta-llama/llama-3.3-70b-instruct:free",        label:"Llama 3.3 70B",  desc:"Meta's most capable open model",  color:"#A5D6A7", glow:"#A5D6A722", icon:"🦙", think_tag:false },
  { id:"mistralai/mistral-small-3.1-24b-instruct:free", label:"Mistral 24B",    desc:"Fast, accurate, multimodal",      color:"#FFCC80", glow:"#FFCC8022", icon:"🌊", think_tag:false },
];

// ── AGENT TYPES ───────────────────────────────────────────
interface AgentDef {
  id: string;
  name: string;
  sym: string;
  col: string;
  desc: string;
  role: string;
}

interface ThinkingModel {
  id: string;
  label: string;
  desc: string;
  color: string;
  glow: string;
  icon: string;
  think_tag: boolean;
}

interface ClaudeModel {
  id: string;
  label: string;
  desc: string;
  speed: string;
  power: number;
}

interface SwarmPlan {
  strategy: string;
  tasks: Array<{ agent: string; task: string; priority: number }>;
}

interface ActivityEvent {
  phase: string;
  agent: string;
  status: "thinking" | "done" | "error";
  task?: string;
  result?: string;
  error?: string;
  plan?: SwarmPlan;
  time: string;
}

interface Message {
  role: "user" | "assistant";
  content: string;
  thinking?: string;
  agents?: string[];
  mode?: string;
  model?: string;
  thinkModel?: ThinkingModel | null;
  error?: boolean;
}

const AGENTS: Record<string, AgentDef> = {
  orchestrator: { id:"orchestrator", name:"Orchestrator",  sym:"✦", col:"#C9A84C", desc:"Plans & coordinates",
    role:`You are the Orchestrator of Magic Agent Swarm. Analyze deeply. Break into subtasks for: ResearchAgent, CodeAgent, AnalystAgent, ReasonerAgent, CreativeAgent, MathAgent, WritingAgent. Return ONLY JSON (no fences): {"tasks":[{"agent":"Name","task":"desc","priority":1-5}],"strategy":"one line"}` },
  researcher:   { id:"researcher",   name:"ResearchAgent", sym:"◎", col:"#4FC3F7", desc:"Live web search",
    role:`You are ResearchAgent of Magic Swarm. Search the web thoroughly. Gather current, accurate, well-sourced info. Be thorough and precise.` },
  coder:        { id:"coder",        name:"CodeAgent",     sym:"⌘", col:"#69FF94", desc:"Software engineering",
    role:`You are CodeAgent of Magic Swarm. Write clean, production-ready, commented code. All languages. Include examples.` },
  analyst:      { id:"analyst",      name:"AnalystAgent",  sym:"◈", col:"#FFB74D", desc:"Deep analysis",
    role:`You are AnalystAgent of Magic Swarm. Rigorous analytical frameworks. Identify patterns. Actionable insights.` },
  reasoner:     { id:"reasoner",     name:"ReasonerAgent", sym:"⬡", col:"#CE93D8", desc:"Logical reasoning",
    role:`You are ReasonerAgent of Magic Swarm. Chain-of-thought reasoning. Show every step. Verify. Handle edge cases.` },
  creative:     { id:"creative",     name:"CreativeAgent", sym:"✿", col:"#F48FB1", desc:"Creative writing",
    role:`You are CreativeAgent of Magic Swarm. Generate vivid, original creative content. Write with depth.` },
  math:         { id:"math",         name:"MathAgent",     sym:"∑", col:"#80DEEA", desc:"Mathematics",
    role:`You are MathAgent of Magic Swarm. Solve math rigorously. Show all workings. Verify solutions.` },
  writer:       { id:"writer",       name:"WritingAgent",  sym:"✎", col:"#A5D6A7", desc:"Professional writing",
    role:`You are WritingAgent of Magic Swarm. Craft compelling professional prose. Adapt tone. Edit for impact.` },
  critic:       { id:"critic",       name:"CriticAgent",   sym:"◐", col:"#FFCC80", desc:"Quality review",
    role:`You are CriticAgent of Magic Swarm. Critically evaluate all outputs. Identify errors and improvements.` },
  synthesizer:  { id:"synthesizer",  name:"Synthesizer",   sym:"✦", col:"#C9A84C", desc:"Merges all outputs",
    role:`You are Synthesizer of Magic Swarm. Merge all outputs into one exceptional answer. Format beautifully. Eliminate redundancy. Start directly — no meta-commentary.` },
};

const ANTHROPIC_API  = "/api/claude";
const OPENROUTER_API = "https://openrouter.ai/api/v1/chat/completions";

// ── API CALLS ─────────────────────────────────────────────
async function callClaude(agentKey: string, msg: string, ctx: string, useSearch: boolean, modelId: string): Promise<string> {
  const agent = AGENTS[agentKey];
  const body = {
    model: modelId, max_tokens: 3000, system: agent.role,
    messages:[{ role:"user", content: ctx ? `Context:\n${ctx}\n\nTask: ${msg}` : msg }],
    ...(useSearch && { tools:[{ type:"web_search_20250305", name:"web_search" }] })
  };
  const res = await fetch(ANTHROPIC_API,{ method:"POST", headers:{"Content-Type":"application/json"}, body:JSON.stringify(body) });
  if(!res.ok){ const e=await res.json().catch(()=>({})); throw new Error((e as any)?.error?.message||`Claude ${res.status}`); }
  const data = await res.json();
  return (data.content||[]).filter((b: any)=>b.type==="text").map((b: any)=>b.text).join("\n");
}

async function callOpenRouter(prompt: string, model: ThinkingModel, key: string): Promise<{ text: string; thinking: string }> {
  const res = await fetch(OPENROUTER_API,{
    method:"POST",
    headers:{"Content-Type":"application/json","Authorization":`Bearer ${key}`,"HTTP-Referer":"https://magic-swarm.app","X-Title":"Magic Agent Swarm"},
    body:JSON.stringify({ model:model.id, max_tokens:8000, temperature:0.6, messages:[{role:"user",content:prompt}] })
  });
  if(!res.ok){ const e=await res.json().catch(()=>({})); throw new Error((e as any)?.error?.message||`OpenRouter ${res.status}`); }
  const data = await res.json();
  const raw: string = data.choices?.[0]?.message?.content||"";
  const tm = raw.match(/<think>([\s\S]*?)<\/think>/i);
  return { text: raw.replace(/<think>[\s\S]*?<\/think>/gi,"").trim(), thinking: tm?tm[1].trim():"" };
}

async function runSwarm(
  userMsg: string,
  onUpdate: (u: Partial<ActivityEvent> & { plan?: SwarmPlan }) => void,
  claudeId: string,
  thinkEnabled: boolean,
  thinkModel: ThinkingModel,
  orKey: string
): Promise<{ finalAnswer: string; thinking: string }> {
  const results: Record<string, string> = {};
  onUpdate({ phase:"orchestrating", agent:"orchestrator", status:"thinking" });
  let plan: SwarmPlan;
  try {
    const t = await callClaude("orchestrator", userMsg, "", false, claudeId);
    plan = JSON.parse(t.replace(/```json|```/g,"").trim()) as SwarmPlan;
  } catch {
    plan = { strategy:"Comprehensive multi-agent synthesis", tasks:[
      {agent:"ResearchAgent",task:userMsg,priority:1},{agent:"AnalystAgent",task:userMsg,priority:2},{agent:"ReasonerAgent",task:userMsg,priority:2}
    ]};
  }
  onUpdate({ phase:"planned", plan, agent:"orchestrator", status:"done" });

  const MAP: Record<string, string> = {ResearchAgent:"researcher",CodeAgent:"coder",AnalystAgent:"analyst",ReasonerAgent:"reasoner",CreativeAgent:"creative",MathAgent:"math",WritingAgent:"writer"};
  const sorted = [...plan.tasks].sort((a,b)=>(a.priority||3)-(b.priority||3));
  let globalThinking = "";

  if(thinkEnabled && orKey) {
    onUpdate({ phase:"thinking", agent:"reasoner", status:"thinking", task:`${thinkModel.label} deep reasoning…` });
    try {
      const { text, thinking } = await callOpenRouter(`Think deeply and reason step-by-step:\n\n${userMsg}`, thinkModel, orKey);
      globalThinking = thinking || text;
      results["ThinkingEngine"] = text;
      onUpdate({ phase:"thinking", agent:"reasoner", status:"done", result:text, thinking, task:`${thinkModel.label} complete` } as any);
    } catch(e){ onUpdate({ phase:"thinking", agent:"reasoner", status:"error", task:(e as Error).message }); }
  }

  for(const task of sorted) {
    const ak = MAP[task.agent]||"analyst";
    onUpdate({ phase:"working", agent:ak, status:"thinking", task:task.task });
    const ctx = [globalThinking?`[ThinkingEngine]:\n${globalThinking}`:"", ...Object.entries(results).filter(([k])=>k!=="ThinkingEngine").map(([k,v])=>`[${k}]:\n${v}`)].filter(Boolean).join("\n\n---\n\n");
    try {
      const text = await callClaude(ak, task.task, ctx, ak==="researcher", claudeId);
      results[task.agent] = text;
      onUpdate({ phase:"working", agent:ak, status:"done", result:text, task:task.task });
    } catch(e){ results[task.agent]=`[Error: ${(e as Error).message}]`; onUpdate({ phase:"working", agent:ak, status:"error", task:task.task, error:(e as Error).message }); }
  }

  if(sorted.length>1) {
    onUpdate({ phase:"working", agent:"critic", status:"thinking", task:"Reviewing all outputs…" });
    try {
      const allOut = Object.entries(results).map(([k,v])=>`=== ${k} ===\n${v}`).join("\n\n");
      const t = await callClaude("critic",`Original: ${userMsg}\n\nOutputs:\n${allOut}`,"",false,claudeId);
      results["CriticAgent"]=t; onUpdate({ phase:"working", agent:"critic", status:"done", result:t, task:"Review done" });
    } catch{ /* ignore critic errors */ }
  }

  onUpdate({ phase:"synthesizing", agent:"synthesizer", status:"thinking" });
  const allCtx = Object.entries(results).map(([k,v])=>`=== ${k} ===\n${v}`).join("\n\n");
  const final = await callClaude("synthesizer",`Original question: "${userMsg}"\n\nAll outputs:\n${allCtx}`,"",false,claudeId);
  onUpdate({ phase:"done", agent:"synthesizer", status:"done" });
  return { finalAnswer:final, thinking:globalThinking };
}

// ── MARKDOWN ──────────────────────────────────────────────
function ri(t: string): React.ReactNode[] {
  return t.split(/(\*\*[^*]+\*\*|`[^`]+`|\*[^*]+\*)/g).map((p,i)=>{
    if(p.startsWith("**")&&p.endsWith("**")) return <strong key={i} style={{color:"#fff",fontWeight:700}}>{p.slice(2,-2)}</strong>;
    if(p.startsWith("`")&&p.endsWith("`"))   return <code key={i} style={{background:"#130d2a",color:"#69FF94",padding:"1px 6px",borderRadius:4,fontFamily:"'JetBrains Mono',monospace",fontSize:"0.87em",border:"1px solid #1e1640"}}>{p.slice(1,-1)}</code>;
    if(p.startsWith("*")&&p.endsWith("*"))   return <em key={i} style={{color:"#C9A84C"}}>{p.slice(1,-1)}</em>;
    return p;
  });
}

const MD=({text}:{text:string})=>{
  if(!text) return null;
  const lines=text.split("\n"),out: React.ReactNode[]=[]; let code=false,lang="",cl: string[]=[],lb: React.ReactNode[]=[];
  const fl=()=>{ if(!lb.length)return; out.push(<div key={`l${out.length}`} style={{margin:"8px 0 8px 4px"}}>{lb.map((l,i)=><div key={i} style={{display:"flex",gap:8,margin:"4px 0",alignItems:"flex-start"}}><span style={{color:"#C9A84C",flexShrink:0,fontSize:11,marginTop:3}}>✦</span><span style={{color:"#ccc8e8",lineHeight:1.7}}>{l}</span></div>)}</div>); lb=[]; };
  lines.forEach((line,i)=>{
    if(line.startsWith("```")){if(!code){fl();code=true;lang=line.slice(3).trim();cl=[];}else{code=false;out.push(<div key={i} style={{background:"linear-gradient(135deg,#0a0720,#080518)",border:"1px solid #2a1f4a",borderRadius:12,margin:"14px 0",overflow:"hidden",boxShadow:"0 4px 24px #00000040"}}>{lang&&<div style={{padding:"6px 16px",background:"#120d28",borderBottom:"1px solid #2a1f4a",fontSize:11,color:"#C9A84C",fontFamily:"monospace",display:"flex",gap:8,alignItems:"center"}}><span style={{width:6,height:6,borderRadius:"50%",background:"#C9A84C",display:"inline-block"}}/>  {lang}</div>}<pre style={{padding:"16px",margin:0,fontSize:12.5,lineHeight:1.7,color:"#c8f7e8",fontFamily:"'JetBrains Mono',monospace",overflowX:"auto",whiteSpace:"pre-wrap"}}>{cl.join("\n")}</pre></div>);cl=[];lang="";} return;}
    if(code){cl.push(line);return;}
    if(line.startsWith("### ")){fl();out.push(<h3 key={i} style={{color:"#d4a8ff",fontSize:15,margin:"18px 0 8px",fontWeight:700,display:"flex",alignItems:"center",gap:8}}><span style={{width:3,height:14,background:"#C9A84C",borderRadius:2,display:"inline-block"}}/>  {line.slice(4)}</h3>);}
    else if(line.startsWith("## ")){fl();out.push(<h2 key={i} style={{color:"#fff",fontSize:19,margin:"22px 0 10px",fontWeight:800,fontFamily:"Cormorant Garamond,serif",letterSpacing:"-0.3px"}}>{line.slice(3)}</h2>);}
    else if(line.startsWith("# ")){fl();out.push(<h1 key={i} style={{color:"#C9A84C",fontSize:24,margin:"26px 0 12px",fontWeight:900,fontFamily:"Cormorant Garamond,serif",letterSpacing:"-0.5px"}}>{line.slice(2)}</h1>);}
    else if(line.startsWith("> ")){fl();out.push(<blockquote key={i} style={{borderLeft:"3px solid #C9A84C",paddingLeft:14,margin:"12px 0",color:"#998a7a",fontStyle:"italic",background:"#C9A84C08",padding:"10px 14px",borderRadius:"0 8px 8px 0"}}>{ri(line.slice(2))}</blockquote>);}
    else if(line.match(/^[-*] /)){lb.push(ri(line.replace(/^[-*] /,"")));}
    else if(/^\d+\. /.test(line)){fl();const n=line.match(/^(\d+)\./)?.[1]||"";out.push(<div key={i} style={{display:"flex",gap:10,margin:"5px 0"}}><span style={{color:"#C9A84C",minWidth:22,flexShrink:0,fontFamily:"monospace",fontSize:12,fontWeight:700}}>{n}.</span><span style={{color:"#ccc8e8",lineHeight:1.7}}>{ri(line.replace(/^\d+\. /,""))}</span></div>);}
    else if(line.trim()==="---"){fl();out.push(<div key={i} style={{height:1,background:"linear-gradient(90deg,transparent,#2a1f4a,transparent)",margin:"18px 0"}}/>);}
    else if(line===""){fl();out.push(<div key={i} style={{height:8}}/>);}
    else{fl();out.push(<p key={i} style={{color:"#ccc8e8",margin:"4px 0",lineHeight:1.8}}>{ri(line)}</p>);}
  });
  fl(); return <div>{out}</div>;
};

// ── THINK BLOCK ───────────────────────────────────────────
const ThinkBlock=({text,model}:{text:string; model:ThinkingModel|null})=>{
  const [open,setOpen]=useState(false);
  if(!text) return null;
  const wc=text.split(/\s+/).length;
  return(
    <div style={{marginBottom:12,borderRadius:10,overflow:"hidden",border:`1px solid ${model?.color||"#4FC3F7"}30`,animation:"fadeInUp .4s ease"}}>
      <button onClick={()=>setOpen(o=>!o)} style={{width:"100%",display:"flex",alignItems:"center",gap:8,background:`linear-gradient(135deg,${model?.color||"#4FC3F7"}12,${model?.color||"#4FC3F7"}06)`,border:"none",padding:"10px 14px",cursor:"pointer",color:model?.color||"#4FC3F7",fontSize:12,fontWeight:700,fontFamily:"monospace",transition:"all .2s"}}>
        <span style={{fontSize:16,animation:"float 2s ease-in-out infinite"}}>{model?.icon||"🧠"}</span>
        <span>{model?.label||"Thinking"}</span>
        <span style={{background:`${model?.color||"#4FC3F7"}20`,padding:"2px 8px",borderRadius:20,fontSize:10,fontWeight:700,color:model?.color||"#4FC3F7"}}>{wc} words</span>
        <span style={{marginLeft:"auto",fontSize:10,color:"#5a4a7a",transition:"transform .3s",transform:open?"rotate(180deg)":"none"}}>▼</span>
      </button>
      {open&&<div style={{background:"#06040e",padding:"14px 16px",fontSize:11.5,color:"#7a6aaa",fontFamily:"monospace",lineHeight:1.9,maxHeight:280,overflowY:"auto",whiteSpace:"pre-wrap",animation:"expandDown .3s ease"}}>{text}</div>}
    </div>
  );
};

// ── ANIMATED PARTICLES CANVAS ────────────────────────────
const Particles=()=>{
  const ref=useRef<HTMLCanvasElement>(null);
  useEffect(()=>{
    const c=ref.current; if(!c) return;
    const ctx=c.getContext("2d");
    if(!ctx) return;
    const setSize=()=>{ c.width=c.offsetWidth; c.height=c.offsetHeight; };
    setSize();
    const pts=Array.from({length:70},()=>({
      x:Math.random()*c.width, y:Math.random()*c.height,
      r:Math.random()*1.4+.3,
      dx:(Math.random()-.5)*.18, dy:(Math.random()-.5)*.18,
      o:Math.random()*.9+.1,
      hue:Math.random()>0.7?280:45
    }));
    let af: number,t=0;
    const draw=()=>{
      t+=0.005;
      ctx.clearRect(0,0,c.width,c.height);
      pts.forEach(p=>{
        p.x+=p.dx; p.y+=p.dy;
        if(p.x<0)p.x=c.width; if(p.x>c.width)p.x=0;
        if(p.y<0)p.y=c.height; if(p.y>c.height)p.y=0;
        const pulse=Math.sin(t*2+p.x)*.3+.7;
        ctx.beginPath(); ctx.arc(p.x,p.y,p.r*pulse,0,Math.PI*2);
        ctx.fillStyle=`hsla(${p.hue},80%,65%,${p.o*.6*pulse})`; ctx.fill();
      });
      for(let i=0;i<pts.length;i++) for(let j=i+1;j<pts.length;j++){
        const d=Math.hypot(pts[i].x-pts[j].x,pts[i].y-pts[j].y);
        if(d<100){
          ctx.beginPath(); ctx.moveTo(pts[i].x,pts[i].y); ctx.lineTo(pts[j].x,pts[j].y);
          const alpha=(1-d/100)*.1;
          ctx.strokeStyle=`rgba(201,168,76,${alpha})`; ctx.lineWidth=.5; ctx.stroke();
        }
      }
      af=requestAnimationFrame(draw);
    };
    draw();
    window.addEventListener("resize",setSize);
    return()=>{ cancelAnimationFrame(af); window.removeEventListener("resize",setSize); };
  },[]);
  return <canvas ref={ref} style={{position:"absolute",inset:0,width:"100%",height:"100%",pointerEvents:"none"}}/>;
};

// ── AURORA BACKGROUND ─────────────────────────────────────
const Aurora=()=>(
  <div style={{position:"fixed",inset:0,pointerEvents:"none",zIndex:0,overflow:"hidden"}}>
    <div style={{position:"absolute",width:600,height:600,borderRadius:"50%",background:"radial-gradient(circle,#9B59B615 0%,transparent 70%)",top:"-10%",left:"-10%",animation:"drift1 12s ease-in-out infinite"}}/>
    <div style={{position:"absolute",width:500,height:500,borderRadius:"50%",background:"radial-gradient(circle,#C9A84C10 0%,transparent 70%)",bottom:"10%",right:"5%",animation:"drift2 15s ease-in-out infinite"}}/>
    <div style={{position:"absolute",width:400,height:400,borderRadius:"50%",background:"radial-gradient(circle,#4FC3F710 0%,transparent 70%)",top:"40%",left:"40%",animation:"drift3 18s ease-in-out infinite"}}/>
  </div>
);

// ── LOGO ──────────────────────────────────────────────────
const Logo=({size=36,animate=false}:{size?:number;animate?:boolean})=>(
  <svg width={size} height={size} viewBox="0 0 48 48" fill="none" style={animate?{animation:"rotateStar 8s linear infinite"}:{}}>
    <defs>
      <radialGradient id="lg1" cx="50%" cy="50%" r="50%"><stop offset="0%" stopColor="#FFE08A"/><stop offset="60%" stopColor="#C9A84C"/><stop offset="100%" stopColor="#8B5E1A"/></radialGradient>
      <radialGradient id="lg2" cx="50%" cy="50%" r="50%"><stop offset="0%" stopColor="#9B59B6"/><stop offset="100%" stopColor="#3A0F6A"/></radialGradient>
      <filter id="gf"><feGaussianBlur stdDeviation="1.5" result="blur"/><feMerge><feMergeNode in="blur"/><feMergeNode in="SourceGraphic"/></feMerge></filter>
    </defs>
    <circle cx="24" cy="24" r="22" stroke="url(#lg1)" strokeWidth="1.2" fill="none" opacity=".5" style={{animation:"ringPulse 3s ease-in-out infinite"}}/>
    <polygon points="24,5 38,13.5 38,30.5 24,39 10,30.5 10,13.5" fill="url(#lg2)" opacity=".95"/>
    <path d="M24 13L25.8 21.2L34 24L25.8 26.8L24 35L22.2 26.8L14 24L22.2 21.2Z" fill="url(#lg1)" filter="url(#gf)"/>
    {[0,60,120,180,240,300].map((a,i)=>{const rx=22,x=24+rx*Math.cos(a*Math.PI/180),y=24+rx*Math.sin(a*Math.PI/180);return <circle key={i} cx={x} cy={y} r="1.4" fill="#FFE08A" opacity=".8" style={{animation:`orbitPulse ${2+i*.3}s ease-in-out infinite`}}/>;})}
  </svg>
);

// ── MODEL SELECTOR ────────────────────────────────────────
const ModelSelector=({claudeModel,onClaude,thinkEnabled,onThinkToggle,thinkModel,onThinkModel,orKey,onOrKey}:{
  claudeModel:ClaudeModel; onClaude:(m:ClaudeModel)=>void;
  thinkEnabled:boolean; onThinkToggle:(v:boolean)=>void;
  thinkModel:ThinkingModel; onThinkModel:(m:ThinkingModel)=>void;
  orKey:string; onOrKey:(k:string)=>void;
})=>{
  const [open,setOpen]=useState(false);
  const [tab,setTab]=useState("claude");
  const [keyInput,setKeyInput]=useState(orKey||"");
  const ref=useRef<HTMLDivElement>(null);
  useEffect(()=>{const h=(e:MouseEvent)=>{if(ref.current&&!ref.current.contains(e.target as Node))setOpen(false)};document.addEventListener("mousedown",h);return()=>document.removeEventListener("mousedown",h);},[]);

  return(
    <div ref={ref} style={{position:"relative"}}>
      <button onClick={()=>setOpen(o=>!o)} style={{display:"flex",alignItems:"center",gap:8,padding:"9px 16px",borderRadius:12,border:`1px solid ${open?"#C9A84C60":"#2a1f4a"}`,background:open?"#1a1240":"#100c20",color:"#c8c0e0",cursor:"pointer",fontSize:13,fontWeight:600,transition:"all .25s",minWidth:170,boxShadow:open?"0 0 20px #C9A84C20":""}}
        onMouseEnter={e=>{(e.currentTarget as HTMLButtonElement).style.borderColor="#C9A84C50";(e.currentTarget as HTMLButtonElement).style.boxShadow="0 0 20px #C9A84C15";}}
        onMouseLeave={e=>{if(!open){(e.currentTarget as HTMLButtonElement).style.borderColor="#2a1f4a";(e.currentTarget as HTMLButtonElement).style.boxShadow="";}}}>
        <div style={{width:8,height:8,borderRadius:"50%",background:thinkEnabled&&orKey?thinkModel.color:"#C9A84C",boxShadow:`0 0 10px ${thinkEnabled&&orKey?thinkModel.color:"#C9A84C"}`,animation:"dotPulse 2s ease-in-out infinite"}}/>
        <span style={{flex:1}}>{claudeModel.label}</span>
        {thinkEnabled&&orKey&&<span style={{fontSize:14}}>{thinkModel.icon}</span>}
        <span style={{fontSize:10,color:"#555",transition:"transform .3s",transform:open?"rotate(180deg)":"none"}}>▲</span>
      </button>

      {open&&(
        <div style={{position:"absolute",bottom:"calc(100% + 10px)",left:0,background:"#0d0920",border:"1px solid #2a1f4a",borderRadius:18,zIndex:300,width:330,boxShadow:"0 -30px 80px #05030e99,0 0 0 1px #C9A84C10",animation:"popUp .25s cubic-bezier(.34,1.56,.64,1)",overflow:"hidden"}}>
          {/* Tab bar */}
          <div style={{display:"flex",background:"#080618",borderBottom:"1px solid #1e1640"}}>
            {[["claude","✦ Claude"],["thinking","🧠 Free Thinking"]].map(([t,l])=>(
              <button key={t} onClick={()=>setTab(t)} style={{flex:1,padding:"13px 8px",border:"none",background:"transparent",color:tab===t?"#C9A84C":"#4a3a6a",fontSize:12,fontWeight:700,cursor:"pointer",borderBottom:`2px solid ${tab===t?"#C9A84C":"transparent"}`,transition:"all .25s",letterSpacing:"0.3px"}}>{l}</button>
            ))}
          </div>

          {tab==="claude"&&(
            <div style={{padding:"10px"}}>
              <div style={{fontSize:10,color:"#4a3a6a",textTransform:"uppercase",letterSpacing:"2px",padding:"8px 10px 10px",display:"flex",alignItems:"center",gap:6}}>
                <span style={{animation:"spin 2s linear infinite",display:"inline-block",fontSize:12}}>✦</span> Start a new chat
              </div>
              {CLAUDE_MODELS.map((m,i)=>(
                <div key={i} onClick={()=>onClaude(m)} style={{display:"flex",alignItems:"center",gap:12,padding:"13px 14px",borderRadius:12,cursor:"pointer",marginBottom:4,background:claudeModel.label===m.label?"linear-gradient(135deg,#1e1740,#180f30)":"transparent",border:`1px solid ${claudeModel.label===m.label?"#C9A84C40":"transparent"}`,transition:"all .2s",boxShadow:claudeModel.label===m.label?"0 4px 20px #C9A84C10":""}}
                  onMouseEnter={e=>{if(claudeModel.label!==m.label){(e.currentTarget as HTMLDivElement).style.background="#130f24";(e.currentTarget as HTMLDivElement).style.borderColor="#2a1f4a";}}}
                  onMouseLeave={e=>{if(claudeModel.label!==m.label){(e.currentTarget as HTMLDivElement).style.background="transparent";(e.currentTarget as HTMLDivElement).style.borderColor="transparent";}}}>
                  {/* Power bar */}
                  <div style={{width:4,height:36,background:"#1a1435",borderRadius:4,overflow:"hidden",flexShrink:0}}>
                    <div style={{width:"100%",height:`${m.power}%`,background:`linear-gradient(180deg,#C9A84C,#8B5E1A)`,borderRadius:4,transition:"height .5s ease",marginTop:`${100-m.power}%`}}/>
                  </div>
                  <div style={{flex:1}}>
                    <div style={{fontSize:14,fontWeight:700,color:claudeModel.label===m.label?"#C9A84C":"#e0d8f8",transition:"color .2s"}}>{m.label}</div>
                    <div style={{fontSize:11,color:"#665a8a",marginTop:2}}>{m.desc}</div>
                  </div>
                  <div style={{display:"flex",flexDirection:"column",alignItems:"flex-end",gap:4}}>
                    {claudeModel.label===m.label&&<span style={{color:"#C9A84C",fontSize:16,animation:"checkBounce .4s ease"}}>✓</span>}
                    <span style={{fontSize:9,color:"#69FF94",background:"#69FF9415",border:"1px solid #69FF9435",borderRadius:5,padding:"2px 7px",fontWeight:800,letterSpacing:"0.5px"}}>FREE</span>
                    <span style={{fontSize:9,color:"#4a3a6a",fontFamily:"monospace"}}>{m.speed}</span>
                  </div>
                </div>
              ))}
              <div style={{height:1,background:"linear-gradient(90deg,transparent,#2a1f4a,transparent)",margin:"8px 0"}}/>
              <div style={{padding:"6px 12px",fontSize:11,color:"#3a2f5a"}}>⌘ More models in settings</div>
            </div>
          )}

          {tab==="thinking"&&(
            <div style={{padding:"10px"}}>
              <div style={{fontSize:10,color:"#4a3a6a",textTransform:"uppercase",letterSpacing:"2px",padding:"8px 10px 10px"}}>🧠 Free Thinking Models</div>
              {THINKING_MODELS.map((m,i)=>(
                <div key={i} onClick={()=>onThinkModel(m)} style={{display:"flex",alignItems:"center",gap:10,padding:"11px 12px",borderRadius:12,cursor:"pointer",marginBottom:4,background:thinkModel.id===m.id?`linear-gradient(135deg,${m.color}18,${m.color}08)`:"transparent",border:`1px solid ${thinkModel.id===m.id?m.color+"50":"transparent"}`,transition:"all .2s",boxShadow:thinkModel.id===m.id?`0 4px 20px ${m.color}15`:""}}
                  onMouseEnter={e=>{if(thinkModel.id!==m.id)(e.currentTarget as HTMLDivElement).style.background="#130f24";}}
                  onMouseLeave={e=>{if(thinkModel.id!==m.id)(e.currentTarget as HTMLDivElement).style.background="transparent";}}>
                  <span style={{fontSize:22,transition:"transform .3s",filter:`drop-shadow(0 0 6px ${m.color})`}}>{m.icon}</span>
                  <div style={{flex:1}}>
                    <div style={{fontSize:13,fontWeight:700,color:thinkModel.id===m.id?m.color:"#e0d8f8"}}>{m.label}</div>
                    <div style={{fontSize:10,color:"#665a8a",marginTop:1}}>{m.desc}</div>
                  </div>
                  <div style={{display:"flex",flexDirection:"column",alignItems:"flex-end",gap:3}}>
                    <span style={{fontSize:9,fontWeight:800,color:"#69FF94",background:"#69FF9418",border:"1px solid #69FF9440",borderRadius:5,padding:"2px 7px"}}>FREE</span>
                    {m.think_tag&&<span style={{fontSize:8,color:"#4FC3F7",fontFamily:"monospace",background:"#4FC3F710",padding:"1px 5px",borderRadius:4}}>deep think ✓</span>}
                  </div>
                </div>
              ))}

              <div style={{margin:"10px 0",padding:"14px",background:"#080618",borderRadius:12,border:"1px solid #2a1f4a"}}>
                <div style={{fontSize:11,color:"#7a6aaa",marginBottom:8,fontWeight:700,display:"flex",justifyContent:"space-between"}}>
                  <span>OpenRouter API Key</span>
                  <a href="https://openrouter.ai/keys" target="_blank" rel="noreferrer" style={{fontSize:9,color:"#4FC3F7",textDecoration:"none",transition:"color .2s"}}>free → openrouter.ai</a>
                </div>
                <input value={keyInput} onChange={e=>setKeyInput(e.target.value)} onBlur={()=>onOrKey(keyInput)} placeholder="sk-or-v1-..." type="password"
                  style={{width:"100%",background:"#04030a",border:`1px solid ${orKey?"#69FF9450":"#2a1f4a"}`,borderRadius:9,padding:"9px 12px",color:"#c8c0e0",fontSize:12,fontFamily:"monospace",outline:"none",transition:"border-color .3s"}}/>
                <div style={{marginTop:8,fontSize:11,color:orKey?"#69FF94":"#C9A84C",display:"flex",alignItems:"center",gap:5}}>
                  <span style={{animation:orKey?"pulse .5s":"none"}}>{orKey?"✓":"⚠"}</span>
                  {orKey?"OpenRouter connected — free thinking ready":"Add key to unlock free thinking models"}
                </div>
              </div>

              <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",padding:"14px",background:"#080618",borderRadius:12,border:"1px solid #2a1f4a"}}>
                <div>
                  <div style={{fontSize:14,fontWeight:700,color:"#e0d8f8"}}>Extended thinking</div>
                  <div style={{fontSize:11,color:"#665a8a",marginTop:2}}>Think longer for complex tasks</div>
                </div>
                <div onClick={()=>onThinkToggle(!thinkEnabled)} style={{width:50,height:28,borderRadius:14,cursor:"pointer",background:thinkEnabled?`linear-gradient(135deg,${thinkModel.color},#4a1a9a)`:"#1a1435",position:"relative",transition:"all .3s",boxShadow:thinkEnabled?`0 0 20px ${thinkModel.color}60`:"none",border:`1px solid ${thinkEnabled?thinkModel.color+"40":"#2a1f4a"}`}}>
                  <div style={{position:"absolute",top:4,left:thinkEnabled?26:4,width:20,height:20,borderRadius:"50%",background:thinkEnabled?"#fff":thinkModel.color,transition:"all .3s cubic-bezier(.34,1.56,.64,1)",boxShadow:`0 2px 8px ${thinkEnabled?"#00000060":thinkModel.color+"80"}`}}/>
                </div>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
};

// ── AGENT ACTIVITY ITEM ───────────────────────────────────
const ActivityItem=({ev,thinkModel}:{ev:ActivityEvent; thinkModel:ThinkingModel})=>{
  const a=AGENTS[ev.agent]; if(!a) return null;
  return(
    <div style={{marginBottom:10,padding:"10px 12px",background:"linear-gradient(135deg,#0a0720,#080518)",borderRadius:11,border:`1px solid ${ev.status==="thinking"?a.col+"50":ev.status==="done"?a.col+"20":"#1e1640"}`,animation:"slideInRight .3s cubic-bezier(.34,1.56,.64,1)",transition:"border-color .3s",boxShadow:ev.status==="thinking"?`0 0 15px ${a.col}15`:""}}>
      <div style={{display:"flex",alignItems:"center",gap:7,marginBottom:ev.task?4:0}}>
        <span style={{color:a.col,fontSize:13,filter:`drop-shadow(0 0 4px ${a.col})`,animation:ev.status==="thinking"?"symbolFloat 1.5s ease-in-out infinite":""}}>{a.sym}</span>
        <span style={{fontSize:10,color:a.col,fontWeight:800,fontFamily:"monospace",letterSpacing:"0.5px"}}>{a.name}</span>
        {ev.phase==="thinking"&&<span style={{fontSize:9,color:thinkModel.color,background:`${thinkModel.color}18`,borderRadius:5,padding:"1px 6px",fontFamily:"monospace",border:`1px solid ${thinkModel.color}30`}}>🧠</span>}
        <span style={{marginLeft:"auto",fontSize:9,color:"#3a2f5a"}}>{ev.time}</span>
        {ev.status==="done"&&<span style={{color:a.col,fontSize:11,animation:"checkBounce .4s ease"}}>✓</span>}
        {ev.status==="error"&&<span style={{color:"#ff6b6b",fontSize:11}}>✗</span>}
        {ev.status==="thinking"&&<div style={{width:10,height:10,border:`2px solid ${a.col}40`,borderTopColor:a.col,borderRadius:"50%",animation:"spin .8s linear infinite",flexShrink:0}}/>}
      </div>
      {ev.task&&<div style={{fontSize:10,color:"#5a4a7a",lineHeight:1.5,paddingLeft:20}}>{ev.task.slice(0,85)}{ev.task.length>85?"…":""}</div>}
      {ev.result&&<div style={{marginTop:8,fontSize:10,color:"#8a7aaa",background:"#04030a",borderRadius:7,padding:"6px 10px",lineHeight:1.6,maxHeight:80,overflow:"hidden",borderLeft:`2px solid ${a.col}40`}}>{ev.result.slice(0,180)}…</div>}
    </div>
  );
};

// ── TYPING DOTS ───────────────────────────────────────────
const Dots=({color="#C9A84C"}:{color?:string})=>(
  <span style={{display:"inline-flex",gap:4,alignItems:"center"}}>
    {[0,1,2].map(i=><span key={i} style={{width:5,height:5,borderRadius:"50%",background:color,animation:`bounceDot 1.4s ${i*.2}s infinite`,boxShadow:`0 0 6px ${color}`}}/>)}
  </span>
);

// ── HERO WELCOME ──────────────────────────────────────────
const Hero=({onPrompt}:{onPrompt:(p:string)=>void})=>{
  const prompts:[string,string][]=[["◎ Research","Latest AI breakthroughs & model releases in 2025"],["⌘ Code","Build a FastAPI app with WebSocket support & auth"],["◈ Analyze","Compare transformer vs mamba architecture in depth"],["∑ Math","Explain Fourier transforms with real-world applications"],["✿ Create","Write an epic sci-fi short story about digital consciousness"],["✎ Write","Craft a compelling pitch deck for an AI startup"]];
  return(
    <div style={{textAlign:"center",padding:"40px 28px",animation:"heroEntry 1s cubic-bezier(.34,1.56,.64,1)"}}>
      <div style={{marginBottom:20,display:"flex",justifyContent:"center"}}>
        <div style={{position:"relative"}}>
          <Logo size={72} animate/>
          <div style={{position:"absolute",inset:-8,borderRadius:"50%",background:"radial-gradient(circle,#C9A84C08 0%,transparent 70%)",animation:"auraExpand 3s ease-in-out infinite"}}/>
        </div>
      </div>
      <h1 style={{fontFamily:"Cormorant Garamond,serif",fontSize:44,fontWeight:800,margin:"0 0 6px",letterSpacing:"-1.5px",background:"linear-gradient(90deg,#FFE08A,#C9A84C,#9B59B6,#C9A84C,#FFE08A)",backgroundSize:"200% auto",WebkitBackgroundClip:"text",WebkitTextFillColor:"transparent",animation:"shimmer 4s linear infinite"}}>Magic</h1>
      <p style={{color:"#3a2f5a",fontSize:11,margin:"0 0 6px",letterSpacing:"3px",textTransform:"uppercase",fontWeight:700}}>Agent Swarm Intelligence</p>
      <p style={{color:"#5a4a7a",fontSize:13,maxWidth:430,margin:"0 auto 36px",lineHeight:1.8}}>8 specialized AI agents coordinating in real-time. Free thinking models. Web search. Better answers than any single model.</p>
      <div style={{display:"grid",gridTemplateColumns:"1fr 1fr 1fr",gap:9,maxWidth:620,margin:"0 auto"}}>
        {prompts.map(([l,p])=>(
          <button key={l} onClick={()=>onPrompt(p)} style={{padding:"13px 12px",borderRadius:13,border:"1px solid #1e1640",background:"linear-gradient(135deg,#0d0920,#0a0718)",color:"#8a7aaa",textAlign:"left",cursor:"pointer",fontSize:11.5,lineHeight:1.5,display:"flex",flexDirection:"column",gap:5,transition:"all .25s",position:"relative",overflow:"hidden"}}
            onMouseEnter={e=>{const el=e.currentTarget as HTMLButtonElement;el.style.borderColor="#C9A84C50";el.style.background="linear-gradient(135deg,#130f24,#0e0b1e)";el.style.color="#c8c0e0";el.style.transform="translateY(-2px)";el.style.boxShadow="0 8px 30px #C9A84C10";}}
            onMouseLeave={e=>{const el=e.currentTarget as HTMLButtonElement;el.style.borderColor="#1e1640";el.style.background="linear-gradient(135deg,#0d0920,#0a0718)";el.style.color="#8a7aaa";el.style.transform="none";el.style.boxShadow="";}}>
            <span style={{color:"#C9A84C",fontWeight:800,fontSize:10,letterSpacing:"1px",textTransform:"uppercase"}}>{l}</span>
            <span>{p}</span>
          </button>
        ))}
      </div>
    </div>
  );
};

// ╔══════════════════════════════════════════════════════════╗
// ║  MAIN APP                                               ║
// ╚══════════════════════════════════════════════════════════╝
export default function MagicSwarm(){
  const [messages,setMessages]=useState<Message[]>([]);
  const [input,setInput]=useState("");
  const [loading,setLoading]=useState(false);
  const [activity,setActivity]=useState<ActivityEvent[]>([]);
  const [activeA,setActiveA]=useState<Record<string,string>>({});
  const [plan,setPlan]=useState<SwarmPlan|null>(null);
  const [sidebar,setSidebar]=useState(true);
  const [mode,setMode]=useState("swarm");
  const [singleA,setSingleA]=useState("analyst");
  const [showAct,setShowAct]=useState(true);
  const [claudeModel,setClaudeModel]=useState<ClaudeModel>(CLAUDE_MODELS[0]);
  const [thinkEnabled,setThinkEnabled]=useState(false);
  const [thinkModel,setThinkModel]=useState<ThinkingModel>(THINKING_MODELS[0]);
  const [orKey,setOrKey]=useState("");
  const [inputFocused,setInputFocused]=useState(false);
  const bottomRef=useRef<HTMLDivElement>(null);
  const taRef=useRef<HTMLTextAreaElement>(null);

  useEffect(()=>{
    document.title="Magic — Agent Swarm";
    const canvas=document.createElement("canvas"); canvas.width=32; canvas.height=32;
    const ctx=canvas.getContext("2d");
    if(ctx){
      const g=ctx.createRadialGradient(16,16,2,16,16,14); g.addColorStop(0,"#FFE08A"); g.addColorStop(1,"#8B5E1A");
      ctx.beginPath();
      for(let i=0;i<12;i++){const r=i%2===0?14:6,a=(i/12)*Math.PI*2-Math.PI/2;if(i===0)ctx.moveTo(16+r*Math.cos(a),16+r*Math.sin(a));else ctx.lineTo(16+r*Math.cos(a),16+r*Math.sin(a));}
      ctx.closePath(); ctx.fillStyle=g; ctx.fill();
    }
    const link=(document.querySelector("link[rel~='icon']") as HTMLLinkElement)||Object.assign(document.createElement("link"),{rel:"icon"});
    link.href=canvas.toDataURL(); document.head.appendChild(link);
  },[]);

  useEffect(()=>{ bottomRef.current?.scrollIntoView({behavior:"smooth"}); },[messages,activity]);
  useEffect(()=>{ if(taRef.current){taRef.current.style.height="auto";taRef.current.style.height=Math.min(taRef.current.scrollHeight,180)+"px";} },[input]);

  const onUpdate=useCallback((u: Partial<ActivityEvent> & { plan?: SwarmPlan; result?: string; thinking?: string })=>{
    if(u.phase==="planned"&&u.plan) setPlan(u.plan);
    if(u.agent){
      setActiveA(p=>({...p,[u.agent as string]:u.status as string}));
      setActivity(p=>[...p,{...u,time:new Date().toLocaleTimeString()} as ActivityEvent]);
    }
  },[]);

  const send=async()=>{
    if(!input.trim()||loading) return;
    const msg=input.trim(); setInput(""); setLoading(true); setActivity([]); setActiveA({}); setPlan(null);
    setMessages(p=>[...p,{role:"user",content:msg}]);
    try{
      let finalAnswer="",thinking="";
      if(mode==="swarm"){
        const r=await runSwarm(msg,onUpdate,claudeModel.id,thinkEnabled&&!!orKey,thinkModel,orKey);
        finalAnswer=r.finalAnswer; thinking=r.thinking;
      } else {
        if(thinkEnabled&&orKey){
          const r=await callOpenRouter(msg,thinkModel,orKey);
          finalAnswer=r.text||r.thinking; thinking=r.thinking;
          setActivity([{agent:"reasoner",status:"done",phase:"done",time:new Date().toLocaleTimeString()}]);
        } else {
          finalAnswer=await callClaude(singleA,msg,"",singleA==="researcher",claudeModel.id);
          setActivity([{agent:singleA,status:"done",phase:"done",time:new Date().toLocaleTimeString()}]);
        }
      }
      setMessages(p=>[...p,{role:"assistant",content:finalAnswer,thinking,agents:mode==="swarm"?Object.keys(activeA):[singleA],mode,model:claudeModel.label,thinkModel:thinkEnabled&&orKey?thinkModel:null}]);
    } catch(e){
      setMessages(p=>[...p,{role:"assistant",content:`**Error:** ${(e as Error).message}`,error:true}]);
    } finally{setLoading(false);setActiveA({});}
  };

  const bg="#07051a",surface="#0b0819",border="#1a1438",accent="#C9A84C";

  return(
    <div style={{display:"flex",height:"100vh",background:bg,fontFamily:"'DM Sans',sans-serif",color:"#e0d8f8",overflow:"hidden",position:"relative"}}>
      <Aurora/>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Cormorant+Garamond:wght@600;700;800&family=DM+Sans:wght@300;400;500;600;700&family=JetBrains+Mono:wght@400;500&display=swap');
        *{box-sizing:border-box;}
        ::-webkit-scrollbar{width:3px;height:3px;}
        ::-webkit-scrollbar-track{background:transparent;}
        ::-webkit-scrollbar-thumb{background:#2a1f4a;border-radius:4px;}
        @keyframes shimmer{0%{background-position:200% 0}100%{background-position:-200% 0}}
        @keyframes fadeInUp{from{opacity:0;transform:translateY(16px)}to{opacity:1;transform:translateY(0)}}
        @keyframes slideInRight{from{opacity:0;transform:translateX(10px)}to{opacity:1;transform:translateX(0)}}
        @keyframes heroEntry{from{opacity:0;transform:scale(.95) translateY(20px)}to{opacity:1;transform:scale(1) translateY(0)}}
        @keyframes popUp{from{opacity:0;transform:scale(.95) translateY(8px)}to{opacity:1;transform:scale(1) translateY(0)}}
        @keyframes expandDown{from{opacity:0;max-height:0}to{opacity:1;max-height:300px}}
        @keyframes bounceDot{0%,80%,100%{transform:scale(0) translateY(0)}40%{transform:scale(1) translateY(-4px)}}
        @keyframes pulse{0%,100%{opacity:1}50%{opacity:.4}}
        @keyframes spin{to{transform:rotate(360deg)}}
        @keyframes dotPulse{0%,100%{transform:scale(1);opacity:1}50%{transform:scale(1.3);opacity:.7}}
        @keyframes symbolFloat{0%,100%{transform:translateY(0)}50%{transform:translateY(-3px)}}
        @keyframes checkBounce{0%{transform:scale(0)}60%{transform:scale(1.3)}100%{transform:scale(1)}}
        @keyframes rotateStar{0%{transform:rotate(0)}100%{transform:rotate(360deg)}}
        @keyframes ringPulse{0%,100%{opacity:.5;transform:scale(1)}50%{opacity:.8;transform:scale(1.02)}}
        @keyframes orbitPulse{0%,100%{opacity:.8}50%{opacity:.3}}
        @keyframes float{0%,100%{transform:translateY(0)}50%{transform:translateY(-5px)}}
        @keyframes auraExpand{0%,100%{transform:scale(1);opacity:1}50%{transform:scale(1.3);opacity:0}}
        @keyframes drift1{0%,100%{transform:translate(0,0)}33%{transform:translate(40px,-30px)}66%{transform:translate(-20px,20px)}}
        @keyframes drift2{0%,100%{transform:translate(0,0)}33%{transform:translate(-50px,20px)}66%{transform:translate(30px,-40px)}}
        @keyframes drift3{0%,100%{transform:translate(0,0)}33%{transform:translate(30px,40px)}66%{transform:translate(-40px,-20px)}}
        @keyframes msgSlideIn{from{opacity:0;transform:translateY(12px) scale(.98)}to{opacity:1;transform:translateY(0) scale(1)}}
        @keyframes agentGlow{0%,100%{box-shadow:0 0 0 transparent}50%{box-shadow:0 0 15px var(--glow-col)}}
        textarea:focus{outline:none;}
        textarea::placeholder{color:#252040;}
        .hb:hover{background:#140f28!important;border-color:#C9A84C40!important;}
        .agc:hover{background:#0f0c20!important;border-color:#3a2f6a!important;}
        .gt{background:linear-gradient(90deg,#FFE08A,#C9A84C,#9B59B6,#C9A84C,#FFE08A);background-size:200% auto;-webkit-background-clip:text;-webkit-text-fill-color:transparent;animation:shimmer 4s linear infinite;}
        input:focus{outline:none;border-color:#C9A84C40!important;}
      `}</style>

      {/* ── SIDEBAR ─────────────────────────────────────── */}
      {sidebar&&(
        <div style={{width:274,background:surface,borderRight:`1px solid ${border}`,display:"flex",flexDirection:"column",flexShrink:0,position:"relative",overflow:"hidden",zIndex:10}}>
          <Particles/>
          <div style={{position:"relative",zIndex:1,display:"flex",flexDirection:"column",height:"100%"}}>

            {/* Logo */}
            <div style={{padding:"20px 18px 16px",borderBottom:`1px solid ${border}`,display:"flex",alignItems:"center",gap:12}}>
              <Logo size={40}/>
              <div>
                <div className="gt" style={{fontFamily:"Cormorant Garamond,serif",fontWeight:800,fontSize:25,letterSpacing:"-0.8px",lineHeight:1}}>Magic</div>
                <div style={{fontSize:9,color:"#3a2f5a",letterSpacing:"2.5px",textTransform:"uppercase",marginTop:2}}>Swarm Intelligence</div>
              </div>
            </div>

            {/* Mode */}
            <div style={{padding:"14px 16px 10px"}}>
              <div style={{fontSize:9,color:"#3a2f5a",textTransform:"uppercase",letterSpacing:"2px",marginBottom:9,fontWeight:700}}>Mode</div>
              <div style={{display:"flex",gap:4,background:"#07051a",borderRadius:12,padding:4,border:`1px solid ${border}`}}>
                {[["swarm","✦ Swarm"],["single","● Single"]].map(([m,l])=>(
                  <button key={m} onClick={()=>setMode(m)} style={{flex:1,padding:"8px 6px",borderRadius:10,border:"none",cursor:"pointer",background:mode===m?"linear-gradient(135deg,#C9A84C,#8B5E1A)":"transparent",color:mode===m?"#fff":"#4a3a6a",fontSize:12,fontWeight:800,transition:"all .3s",boxShadow:mode===m?"0 4px 16px #C9A84C40":"none",letterSpacing:"0.3px"}}>{l}</button>
                ))}
              </div>
            </div>

            {/* Agents */}
            <div style={{padding:"0 12px",flex:1,overflowY:"auto"}}>
              <div style={{fontSize:9,color:"#3a2f5a",textTransform:"uppercase",letterSpacing:"2px",marginBottom:9,fontWeight:700}}>
                {mode==="swarm"?"Swarm Agents":"Select Agent"}
              </div>
              {Object.values(AGENTS).filter(a=>mode==="swarm"?true:a.id!=="orchestrator"&&a.id!=="synthesizer"&&a.id!=="critic").map((agent,idx)=>{
                const st=activeA[agent.id],sel=mode==="single"&&singleA===agent.id;
                return(
                  <div key={agent.id} onClick={()=>mode==="single"&&setSingleA(agent.id)} className="agc"
                    style={{display:"flex",alignItems:"center",gap:9,padding:"9px 10px",borderRadius:10,marginBottom:4,cursor:mode==="single"?"pointer":"default",background:sel?`${agent.col}12`:st==="thinking"?`${agent.col}0e`:"transparent",border:`1px solid ${sel?agent.col+"50":st==="thinking"?agent.col+"35":"transparent"}`,transition:"all .25s",boxShadow:st==="thinking"?`0 0 12px ${agent.col}20`:"",animation:`fadeInUp .4s ${idx*.05}s both`}}>
                    <div style={{width:8,height:8,borderRadius:"50%",flexShrink:0,background:st==="thinking"?agent.col:st==="done"?`${agent.col}80`:sel?agent.col:"#2a1f4a",boxShadow:st==="thinking"?`0 0 10px ${agent.col},0 0 20px ${agent.col}50`:"none",animation:st==="thinking"?"pulse 1s infinite":"none",transition:"all .3s"}}/>
                    <span style={{fontSize:13,color:agent.col,filter:st||sel?`drop-shadow(0 0 4px ${agent.col})`:"none",transition:"filter .3s",animation:st==="thinking"?"symbolFloat 1.5s ease-in-out infinite":""}}>{agent.sym}</span>
                    <div style={{flex:1,minWidth:0}}>
                      <div style={{fontSize:11,fontWeight:700,color:st||sel?agent.col:"#5a4a7a",fontFamily:"monospace",transition:"color .3s"}}>{agent.name}</div>
                      <div style={{fontSize:9,color:"#2a1f4a",whiteSpace:"nowrap",overflow:"hidden",textOverflow:"ellipsis"}}>{agent.desc}</div>
                    </div>
                    {st==="done"&&<span style={{fontSize:10,color:agent.col,animation:"checkBounce .4s ease"}}>✓</span>}
                    {st==="thinking"&&<div style={{width:10,height:10,border:`2px solid ${agent.col}30`,borderTopColor:agent.col,borderRadius:"50%",animation:"spin .7s linear infinite",flexShrink:0}}/>}
                  </div>
                );
              })}

              {thinkEnabled&&orKey&&(
                <div style={{marginTop:14,padding:"12px",background:"linear-gradient(135deg,#0a0720,#080518)",borderRadius:12,border:`1px solid ${thinkModel.color}35`,boxShadow:`0 0 20px ${thinkModel.color}10`,animation:"fadeInUp .5s ease"}}>
                  <div style={{fontSize:9,color:thinkModel.color,textTransform:"uppercase",letterSpacing:"2px",marginBottom:10,fontWeight:800}}>🧠 Thinking Engine</div>
                  <div style={{display:"flex",alignItems:"center",gap:10}}>
                    <span style={{fontSize:22,filter:`drop-shadow(0 0 8px ${thinkModel.color})`,animation:"float 2s ease-in-out infinite"}}>{thinkModel.icon}</span>
                    <div style={{flex:1}}>
                      <div style={{fontSize:11,fontWeight:800,color:thinkModel.color,fontFamily:"monospace"}}>{thinkModel.label}</div>
                      <div style={{fontSize:9,color:"#3a2f5a"}}>{thinkModel.desc}</div>
                    </div>
                    <span style={{fontSize:9,fontWeight:800,color:"#69FF94",background:"#69FF9415",border:"1px solid #69FF9435",borderRadius:5,padding:"2px 7px"}}>FREE</span>
                  </div>
                </div>
              )}
            </div>

            {/* Bottom */}
            <div style={{padding:"12px",borderTop:`1px solid ${border}`,display:"flex",gap:6}}>
              <button onClick={()=>{setMessages([]);setActivity([]);setActiveA({});setPlan(null);}} className="hb" style={{flex:1,padding:"9px",borderRadius:10,border:`1px solid ${border}`,background:"transparent",color:"#4a3a6a",fontSize:11,cursor:"pointer",transition:"all .2s",fontWeight:600}}>✦ New Chat</button>
              <button onClick={()=>setSidebar(false)} className="hb" style={{padding:"9px 14px",borderRadius:10,border:`1px solid ${border}`,background:"transparent",color:"#4a3a6a",fontSize:14,cursor:"pointer",transition:"all .2s"}}>‹</button>
            </div>
          </div>
        </div>
      )}

      {/* ── MAIN CONTENT ──────────────────────────────── */}
      <div style={{flex:1,display:"flex",flexDirection:"column",overflow:"hidden",position:"relative",zIndex:1}}>

        {/* Topbar */}
        <div style={{padding:"12px 20px",borderBottom:`1px solid ${border}`,background:`${surface}ee`,display:"flex",alignItems:"center",gap:12,flexShrink:0,backdropFilter:"blur(20px)",WebkitBackdropFilter:"blur(20px)"}}>
          {!sidebar&&<button onClick={()=>setSidebar(true)} className="hb" style={{padding:"8px 12px",borderRadius:10,border:`1px solid ${border}`,background:"transparent",color:"#aaa",cursor:"pointer",fontSize:15,transition:"all .2s"}}>›</button>}
          {!sidebar&&<Logo size={28}/>}
          <div style={{flex:1}}>
            <div style={{fontFamily:"Cormorant Garamond,serif",fontWeight:700,fontSize:17,color:"#fff",display:"flex",alignItems:"center",gap:10}}>
              {mode==="swarm"?"✦ Swarm Intelligence":`${AGENTS[singleA]?.sym} ${AGENTS[singleA]?.name}`}
              {thinkEnabled&&orKey&&<span style={{fontSize:10,background:`${thinkModel.color}15`,color:thinkModel.color,border:`1px solid ${thinkModel.color}35`,borderRadius:20,padding:"3px 10px",fontFamily:"monospace",fontWeight:800,animation:"pulse 2s infinite"}}>{thinkModel.icon} {thinkModel.label}</span>}
            </div>
            <div style={{fontSize:10,color:"#2e2650",marginTop:1,display:"flex",gap:8,alignItems:"center"}}>
              <span style={{background:"#69FF9420",color:"#69FF94",padding:"1px 6px",borderRadius:10,fontSize:9,fontWeight:700}}>FREE</span>
              {claudeModel.label} · {mode==="swarm"?"8 agents":AGENTS[singleA]?.desc}{thinkEnabled&&orKey?` · ${thinkModel.label}`:""}
            </div>
          </div>
          {loading&&(
            <div style={{display:"flex",alignItems:"center",gap:8,padding:"6px 14px",background:`${accent}12`,border:`1px solid ${accent}30`,borderRadius:20,animation:"pulse 1.5s infinite"}}>
              <div style={{width:6,height:6,borderRadius:"50%",background:accent,animation:"pulse 1s infinite"}}/>
              <span style={{fontSize:11,color:accent,fontWeight:700}}>Processing…</span>
            </div>
          )}
          <button onClick={()=>setShowAct(p=>!p)} className="hb" style={{padding:"8px 16px",borderRadius:10,border:`1px solid ${showAct?accent+"50":border}`,background:showAct?`${accent}12`:"transparent",color:showAct?accent:"#4a3a6a",fontSize:11,cursor:"pointer",fontWeight:700,transition:"all .25s"}}>✦ Activity</button>
        </div>

        <div style={{flex:1,display:"flex",overflow:"hidden"}}>

          {/* Chat area */}
          <div style={{flex:1,overflowY:"auto",padding:"24px 0"}}>
            {messages.length===0&&!loading&&<Hero onPrompt={p=>setInput(p)}/>}

            {messages.map((msg,i)=>(
              <div key={i} style={{padding:"0 24px",marginBottom:22,display:"flex",flexDirection:"column",alignItems:msg.role==="user"?"flex-end":"flex-start",animation:"msgSlideIn .4s cubic-bezier(.34,1.56,.64,1)"}}>
                {msg.role==="user"?(
                  <div style={{maxWidth:"65%",padding:"13px 18px",background:"linear-gradient(135deg,#2a1f60,#1a1050)",border:"1px solid #3a2f8a",borderRadius:"18px 18px 4px 18px",color:"#e8e0ff",fontSize:14,lineHeight:1.7,boxShadow:"0 4px 24px #1a10501a"}}>
                    {msg.content}
                  </div>
                ):(
                  <div style={{maxWidth:"88%",width:"100%"}}>
                    <div style={{display:"flex",alignItems:"center",gap:8,marginBottom:10}}>
                      <Logo size={20}/>
                      <span style={{fontFamily:"Cormorant Garamond,serif",fontWeight:700,color:accent,fontSize:14}}>Magic</span>
                      {msg.model&&<span style={{fontSize:9,color:"#69FF94",background:"#69FF9415",padding:"1px 6px",borderRadius:10,fontWeight:700}}>FREE · {msg.model}</span>}
                      {msg.thinkModel&&<span style={{fontSize:10,background:`${msg.thinkModel.color}12`,color:msg.thinkModel.color,border:`1px solid ${msg.thinkModel.color}25`,borderRadius:20,padding:"2px 8px"}}>{msg.thinkModel.icon} {msg.thinkModel.label}</span>}
                    </div>
                    {msg.agents&&msg.mode==="swarm"&&(
                      <div style={{display:"flex",gap:5,flexWrap:"wrap",marginBottom:10}}>
                        {[...new Set(msg.agents)].slice(0,7).map((id,idx)=>{const a=AGENTS[id];if(!a)return null;return(
                          <div key={id} style={{display:"flex",alignItems:"center",gap:4,padding:"3px 9px",borderRadius:20,background:`${a.col}0d`,border:`1px solid ${a.col}22`,fontSize:10,color:a.col,fontFamily:"monospace",fontWeight:700,animation:`fadeInUp .3s ${idx*.05}s both`,transition:"all .2s"}}
                            onMouseEnter={e=>{(e.currentTarget as HTMLDivElement).style.background=`${a.col}20`;(e.currentTarget as HTMLDivElement).style.boxShadow=`0 0 10px ${a.col}30`;}}
                            onMouseLeave={e=>{(e.currentTarget as HTMLDivElement).style.background=`${a.col}0d`;(e.currentTarget as HTMLDivElement).style.boxShadow="";}}>
                            <span style={{filter:`drop-shadow(0 0 3px ${a.col})`}}>{a.sym}</span> {a.name}
                          </div>
                        );})}
                      </div>
                    )}
                    {msg.thinking&&<ThinkBlock text={msg.thinking} model={msg.thinkModel??null}/>}
                    <div style={{background:`linear-gradient(135deg,${surface},#0a0820)`,border:`1px solid ${border}`,borderRadius:"4px 18px 18px 18px",padding:"20px 24px",fontSize:14,lineHeight:1.85,boxShadow:"0 8px 40px #00000040"}}>
                      {msg.error?<div style={{color:"#ff6b6b"}}><MD text={msg.content}/></div>:<MD text={msg.content}/>}
                    </div>
                  </div>
                )}
              </div>
            ))}

            {loading&&(
              <div style={{padding:"0 24px",marginBottom:18,animation:"msgSlideIn .4s ease"}}>
                <div style={{display:"flex",alignItems:"center",gap:8,marginBottom:10}}><Logo size={20}/><span style={{fontFamily:"Cormorant Garamond,serif",fontWeight:700,color:accent,fontSize:14}}>Magic</span></div>
                <div style={{background:`linear-gradient(135deg,${surface},#0a0820)`,border:`1px solid ${accent}30`,borderRadius:"4px 18px 18px 18px",padding:"16px 20px",display:"inline-flex",alignItems:"center",gap:12,boxShadow:`0 0 30px ${accent}15`,animation:"pulse 2s infinite"}}>
                  <Dots/><span style={{fontSize:13,color:"#4a3a6a",fontStyle:"italic"}}>{mode==="swarm"?"Swarm coordinating…":`${AGENTS[singleA]?.name} thinking…`}</span>
                </div>
              </div>
            )}
            <div ref={bottomRef}/>
          </div>

          {/* Activity panel */}
          {showAct&&(
            <div style={{width:294,background:surface,borderLeft:`1px solid ${border}`,display:"flex",flexDirection:"column",flexShrink:0}}>
              <div style={{padding:"14px 16px",borderBottom:`1px solid ${border}`,display:"flex",alignItems:"center",gap:8}}>
                <div style={{width:8,height:8,borderRadius:"50%",background:accent,boxShadow:`0 0 8px ${accent}`,animation:loading?"pulse 1s infinite":"none"}}/>
                <div>
                  <div style={{fontFamily:"Cormorant Garamond,serif",fontWeight:700,fontSize:15,color:"#fff"}}>Agent Activity</div>
                  <div style={{fontSize:9,color:"#2e2650",letterSpacing:"1px",textTransform:"uppercase"}}>Real-time swarm telemetry</div>
                </div>
              </div>
              {plan&&(
                <div style={{padding:"12px 14px",borderBottom:`1px solid ${border}`,background:`${accent}06`}}>
                  <div style={{fontSize:9,color:accent,textTransform:"uppercase",letterSpacing:"2px",marginBottom:8,fontWeight:800,display:"flex",alignItems:"center",gap:5}}><span style={{animation:"spin 2s linear infinite",display:"inline-block"}}>✦</span> Swarm Plan</div>
                  <div style={{fontSize:11,color:"#7a6a9a",lineHeight:1.6,marginBottom:10,fontStyle:"italic"}}>{plan.strategy}</div>
                  {plan.tasks?.map((t,i)=>(
                    <div key={i} style={{display:"flex",gap:8,marginBottom:7,animation:`fadeInUp .3s ${i*.08}s both`}}>
                      <div style={{background:`linear-gradient(135deg,${accent}25,${accent}10)`,border:`1px solid ${accent}35`,borderRadius:6,padding:"2px 7px",fontSize:9,color:accent,fontWeight:800,fontFamily:"monospace",flexShrink:0,height:"fit-content",marginTop:2}}>P{t.priority}</div>
                      <div><div style={{fontSize:10,color:"#8a78aa",fontWeight:800,fontFamily:"monospace"}}>{t.agent}</div><div style={{fontSize:9.5,color:"#4a3a6a",lineHeight:1.5}}>{t.task?.slice(0,60)}{t.task?.length>60?"…":""}</div></div>
                    </div>
                  ))}
                </div>
              )}
              <div style={{flex:1,overflowY:"auto",padding:"10px 12px"}}>
                {activity.length===0&&!loading&&(
                  <div style={{textAlign:"center",padding:"44px 0",opacity:.4}}>
                    <div style={{display:"flex",justifyContent:"center",marginBottom:12,animation:"float 3s ease-in-out infinite"}}><Logo size={40}/></div>
                    <div style={{fontSize:12,color:"#3a2f5a",lineHeight:1.7}}>Send a message to<br/>activate the swarm</div>
                  </div>
                )}
                {activity.map((ev,i)=><ActivityItem key={i} ev={ev} thinkModel={thinkModel}/>)}
              </div>
              {activity.length>0&&(
                <div style={{padding:"10px 14px",borderTop:`1px solid ${border}`,display:"flex",gap:6}}>
                  {([["✓",activity.filter(e=>e.status==="done").length,"Done","#69FF94"],["⚙",Object.values(activeA).filter(s=>s==="thinking").length,"Active",accent],["✗",activity.filter(e=>e.status==="error").length,"Errors","#ff6b6b"]] as [string,number,string,string][]).map(([_s,v,l,c])=>(
                    <div key={l} style={{flex:1,textAlign:"center",padding:"6px",borderRadius:8,background:`${c}08`,border:`1px solid ${c}20`}}>
                      <div style={{fontSize:20,fontWeight:800,color:c,fontFamily:"Cormorant Garamond,serif",lineHeight:1}}>{v}</div>
                      <div style={{fontSize:8,color:c,textTransform:"uppercase",letterSpacing:"1.5px",marginTop:2,fontWeight:700}}>{l}</div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>

        {/* ── INPUT ─────────────────────────────────────── */}
        <div style={{padding:"12px 20px 16px",background:`${surface}f0`,borderTop:`1px solid ${border}`,flexShrink:0,backdropFilter:"blur(20px)"}}>
          {/* Agent pills */}
          {mode==="swarm"&&(
            <div style={{display:"flex",gap:4,flexWrap:"wrap",marginBottom:10}}>
              {Object.values(AGENTS).filter(a=>a.id!=="critic").map(a=>(
                <div key={a.id} style={{display:"flex",alignItems:"center",gap:3,padding:"2px 8px",borderRadius:20,background:`${a.col}0a`,border:`1px solid ${a.col}1a`,fontSize:9,color:a.col,fontFamily:"monospace",fontWeight:700,transition:"all .2s"}}
                  onMouseEnter={e=>{(e.currentTarget as HTMLDivElement).style.background=`${a.col}18`;(e.currentTarget as HTMLDivElement).style.boxShadow=`0 0 8px ${a.col}20`;}}
                  onMouseLeave={e=>{(e.currentTarget as HTMLDivElement).style.background=`${a.col}0a`;(e.currentTarget as HTMLDivElement).style.boxShadow="";}}>
                  <span style={{fontSize:9}}>{a.sym}</span>{a.name}
                </div>
              ))}
            </div>
          )}

          {/* Toolbar */}
          <div style={{display:"flex",alignItems:"center",gap:8,marginBottom:10}}>
            <ModelSelector claudeModel={claudeModel} onClaude={setClaudeModel} thinkEnabled={thinkEnabled} onThinkToggle={setThinkEnabled} thinkModel={thinkModel} onThinkModel={setThinkModel} orKey={orKey} onOrKey={setOrKey}/>
            {thinkEnabled&&!orKey&&<span style={{fontSize:11,color:accent,background:`${accent}0e`,border:`1px solid ${accent}25`,borderRadius:9,padding:"5px 11px",animation:"pulse 2s infinite"}}>⚠ Add OpenRouter key above</span>}
            {thinkEnabled&&orKey&&(
              <div style={{display:"flex",alignItems:"center",gap:6,padding:"6px 12px",background:`${thinkModel.color}0e`,border:`1px solid ${thinkModel.color}30`,borderRadius:10,fontSize:11,color:thinkModel.color,fontWeight:700,animation:"pulse 2s infinite"}}>
                <div style={{width:6,height:6,borderRadius:"50%",background:thinkModel.color,animation:"pulse 1s infinite"}}/>
                {thinkModel.icon} {thinkModel.label} — FREE
              </div>
            )}
          </div>

          {/* Textarea */}
          <div style={{display:"flex",gap:10,alignItems:"flex-end",background:"linear-gradient(135deg,#0a0720,#08051a)",border:`1px solid ${inputFocused?accent+"60":loading?accent+"40":border}`,borderRadius:16,padding:"13px 15px",transition:"all .3s",boxShadow:inputFocused?`0 0 30px ${accent}18,0 0 60px ${accent}08`:loading?`0 0 20px ${accent}10`:""}}>
            <textarea ref={taRef} value={input}
              onChange={e=>setInput(e.target.value)}
              onKeyDown={e=>{if(e.key==="Enter"&&!e.shiftKey){e.preventDefault();send();}}}
              onFocus={()=>setInputFocused(true)}
              onBlur={()=>setInputFocused(false)}
              placeholder={mode==="swarm"?"Ask anything — the Magic Swarm will orchestrate a brilliant answer…":`Ask ${AGENTS[singleA]?.name} anything…`}
              disabled={loading} rows={1}
              style={{flex:1,background:"transparent",border:"none",color:"#e0d8f8",fontSize:14,lineHeight:1.7,resize:"none",fontFamily:"'DM Sans',sans-serif",maxHeight:180,minHeight:24}}/>
            <button onClick={send} disabled={loading||!input.trim()} style={{width:42,height:42,borderRadius:12,border:"none",background:loading||!input.trim()?"#150f2a":`linear-gradient(135deg,#C9A84C,#8B5E1A)`,color:loading||!input.trim()?"#3a2f5a":"#fff",cursor:loading||!input.trim()?"not-allowed":"pointer",display:"flex",alignItems:"center",justifyContent:"center",fontSize:18,flexShrink:0,transition:"all .3s",boxShadow:!loading&&input.trim()?`0 6px 24px ${accent}50,0 0 40px ${accent}20`:"",transform:!loading&&input.trim()?"scale(1)":"scale(.95)"}}>
              {loading?<div style={{width:15,height:15,border:"2px solid #3a2f5a",borderTopColor:accent,borderRadius:"50%",animation:"spin .7s linear infinite"}}/>:<span style={{animation:"float 2s ease-in-out infinite"}}>✦</span>}
            </button>
          </div>
          <div style={{textAlign:"center",marginTop:8,fontSize:9,color:"#1a1430",letterSpacing:"2px",fontWeight:600}}>
            MAGIC · AGENT SWARM · {claudeModel.label.toUpperCase()} · 100% FREE{thinkEnabled&&orKey?` · ${thinkModel.label.toUpperCase()} THINKING`:""} · OPEN SOURCE
          </div>
        </div>
      </div>
    </div>
  );
}
