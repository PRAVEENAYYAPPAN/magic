import { useState, useRef, useEffect, useCallback } from "react";

// ── FREE CLAUDE MODELS ────────────────────────────────────
const CLAUDE_MODELS = [
  { id:"claude-haiku-4-5-20251001", label:"Haiku 4.5",  desc:"Fast & lightweight",        speed:"Fastest", power:72 },
  { id:"claude-sonnet-4-5",         label:"Sonnet 4.5", desc:"Previous Sonnet generation", speed:"Fast",    power:82 },
];

// ── INTERFACES ────────────────────────────────────────────
interface AgentDef { id:string; name:string; sym:string; col:string; desc:string; role:string; }
interface ClaudeModel { id:string; label:string; desc:string; speed:string; power:number; }
interface SwarmPlan { strategy:string; tasks:Array<{agent:string;task:string;priority:number}>; }
interface ActivityEvent { phase:string; agent:string; status:"thinking"|"done"|"error"; task?:string; result?:string; error?:string; plan?:SwarmPlan; time:string; }
interface Message { role:"user"|"assistant"; content:string; agents?:string[]; mode?:string; model?:string; error?:boolean; }

const AGENTS: Record<string,AgentDef> = {
  orchestrator:{ id:"orchestrator", name:"Orchestrator",  sym:"✦", col:"#C9A84C", desc:"Plans & coordinates",
    role:`You are the Orchestrator. Break the task into subtasks for: ResearchAgent, CodeAgent, AnalystAgent, ReasonerAgent, CreativeAgent, MathAgent, WritingAgent. Return ONLY JSON (no fences): {"tasks":[{"agent":"Name","task":"desc","priority":1-5}],"strategy":"one line"}` },
  researcher:  { id:"researcher",   name:"ResearchAgent", sym:"◎", col:"#4FC3F7", desc:"Research & facts",
    role:`You are ResearchAgent. Research thoroughly. Give accurate, well-organised information.` },
  coder:       { id:"coder",        name:"CodeAgent",     sym:"⌘", col:"#69FF94", desc:"Software engineering",
    role:`You are CodeAgent. Write clean, production-ready, commented code. Include examples.` },
  analyst:     { id:"analyst",      name:"AnalystAgent",  sym:"◈", col:"#FFB74D", desc:"Deep analysis",
    role:`You are AnalystAgent. Use rigorous analytical frameworks. Give actionable insights.` },
  reasoner:    { id:"reasoner",     name:"ReasonerAgent", sym:"⬡", col:"#CE93D8", desc:"Logical reasoning",
    role:`You are ReasonerAgent. Chain-of-thought reasoning. Show every step.` },
  creative:    { id:"creative",     name:"CreativeAgent", sym:"✿", col:"#F48FB1", desc:"Creative writing",
    role:`You are CreativeAgent. Generate vivid, original creative content.` },
  math:        { id:"math",         name:"MathAgent",     sym:"∑", col:"#80DEEA", desc:"Mathematics",
    role:`You are MathAgent. Solve math rigorously. Show all workings.` },
  writer:      { id:"writer",       name:"WritingAgent",  sym:"✎", col:"#A5D6A7", desc:"Professional writing",
    role:`You are WritingAgent. Craft compelling professional prose.` },
  critic:      { id:"critic",       name:"CriticAgent",   sym:"◐", col:"#FFCC80", desc:"Quality review",
    role:`You are CriticAgent. Critically evaluate all outputs. Identify improvements.` },
  synthesizer: { id:"synthesizer",  name:"Synthesizer",   sym:"✦", col:"#C9A84C", desc:"Merges all outputs",
    role:`You are Synthesizer. Merge all outputs into one exceptional answer. Format beautifully. Start directly.` },
};

const ANTHROPIC_API = "/api/claude";

async function callClaude(agentKey:string, msg:string, ctx:string, modelId:string): Promise<string> {
  const agent = AGENTS[agentKey];
  const body = { model:modelId, max_tokens:3000, system:agent.role,
    messages:[{ role:"user", content:ctx?`Context:\n${ctx}\n\nTask: ${msg}`:msg }] };
  const res = await fetch(ANTHROPIC_API,{ method:"POST", headers:{"Content-Type":"application/json"}, body:JSON.stringify(body) });
  if(!res.ok){ const e=await res.json().catch(()=>({})); throw new Error((e as any)?.error?.message||`Error ${res.status}`); }
  const data = await res.json();
  return (data.content||[]).filter((b:any)=>b.type==="text").map((b:any)=>b.text).join("\n");
}

async function runSwarm(userMsg:string, onUpdate:(u:Partial<ActivityEvent>&{plan?:SwarmPlan;result?:string})=>void, claudeId:string): Promise<string> {
  const results: Record<string,string> = {};
  onUpdate({ phase:"orchestrating", agent:"orchestrator", status:"thinking" });
  let plan: SwarmPlan;
  try {
    const t = await callClaude("orchestrator", userMsg, "", claudeId);
    plan = JSON.parse(t.replace(/```json|```/g,"").trim()) as SwarmPlan;
  } catch {
    plan = { strategy:"Comprehensive multi-agent synthesis", tasks:[
      {agent:"ResearchAgent",task:userMsg,priority:1},{agent:"AnalystAgent",task:userMsg,priority:2},{agent:"ReasonerAgent",task:userMsg,priority:2}
    ]};
  }
  onUpdate({ phase:"planned", plan, agent:"orchestrator", status:"done" });

  const MAP: Record<string,string> = {ResearchAgent:"researcher",CodeAgent:"coder",AnalystAgent:"analyst",ReasonerAgent:"reasoner",CreativeAgent:"creative",MathAgent:"math",WritingAgent:"writer"};
  const sorted = [...plan.tasks].sort((a,b)=>(a.priority||3)-(b.priority||3));

  for(const task of sorted) {
    const ak = MAP[task.agent]||"analyst";
    onUpdate({ phase:"working", agent:ak, status:"thinking", task:task.task });
    const ctx = Object.entries(results).map(([k,v])=>`[${k}]:\n${v}`).join("\n\n---\n\n");
    try {
      const text = await callClaude(ak, task.task, ctx, claudeId);
      results[task.agent] = text;
      onUpdate({ phase:"working", agent:ak, status:"done", result:text, task:task.task });
    } catch(e){ results[task.agent]=`[Error: ${(e as Error).message}]`; onUpdate({ phase:"working", agent:ak, status:"error", task:task.task, error:(e as Error).message }); }
  }

  if(sorted.length>1){
    onUpdate({ phase:"working", agent:"critic", status:"thinking", task:"Reviewing all outputs…" });
    try {
      const allOut = Object.entries(results).map(([k,v])=>`=== ${k} ===\n${v}`).join("\n\n");
      const t = await callClaude("critic",`Original: ${userMsg}\n\nOutputs:\n${allOut}`,"",claudeId);
      results["CriticAgent"]=t; onUpdate({ phase:"working", agent:"critic", status:"done", result:t, task:"Review done" });
    } catch{ /* ignore */ }
  }

  onUpdate({ phase:"synthesizing", agent:"synthesizer", status:"thinking" });
  const allCtx = Object.entries(results).map(([k,v])=>`=== ${k} ===\n${v}`).join("\n\n");
  const final = await callClaude("synthesizer",`Original question: "${userMsg}"\n\nAll outputs:\n${allCtx}`,"",claudeId);
  onUpdate({ phase:"done", agent:"synthesizer", status:"done" });
  return final;
}

// ── MARKDOWN ──────────────────────────────────────────────
function ri(t:string): React.ReactNode[] {
  return t.split(/(\*\*[^*]+\*\*|`[^`]+`|\*[^*]+\*)/g).map((p,i)=>{
    if(p.startsWith("**")&&p.endsWith("**")) return <strong key={i} style={{color:"#fff",fontWeight:700}}>{p.slice(2,-2)}</strong>;
    if(p.startsWith("`")&&p.endsWith("`")) return <code key={i} style={{background:"#130d2a",color:"#69FF94",padding:"1px 6px",borderRadius:4,fontFamily:"monospace",fontSize:"0.87em",border:"1px solid #1e1640"}}>{p.slice(1,-1)}</code>;
    if(p.startsWith("*")&&p.endsWith("*")) return <em key={i} style={{color:"#C9A84C"}}>{p.slice(1,-1)}</em>;
    return p;
  });
}
const MD=({text}:{text:string})=>{
  if(!text) return null;
  const lines=text.split("\n"),out:React.ReactNode[]=[]; let code=false,lang="",cl:string[]=[],lb:React.ReactNode[]=[];
  const fl=()=>{ if(!lb.length)return; out.push(<div key={`l${out.length}`} style={{margin:"8px 0 8px 4px"}}>{lb.map((l,i)=><div key={i} style={{display:"flex",gap:8,margin:"4px 0"}}><span style={{color:"#C9A84C",flexShrink:0,fontSize:11,marginTop:3}}>✦</span><span style={{color:"#ccc8e8",lineHeight:1.7}}>{l}</span></div>)}</div>); lb=[]; };
  lines.forEach((line,i)=>{
    if(line.startsWith("```")){if(!code){fl();code=true;lang=line.slice(3).trim();cl=[];}else{code=false;out.push(<div key={i} style={{background:"#0a0720",border:"1px solid #2a1f4a",borderRadius:12,margin:"14px 0",overflow:"hidden"}}>{lang&&<div style={{padding:"6px 16px",background:"#120d28",borderBottom:"1px solid #2a1f4a",fontSize:11,color:"#C9A84C",fontFamily:"monospace"}}>{lang}</div>}<pre style={{padding:"16px",margin:0,fontSize:12.5,lineHeight:1.7,color:"#c8f7e8",fontFamily:"monospace",overflowX:"auto",whiteSpace:"pre-wrap"}}>{cl.join("\n")}</pre></div>);cl=[];lang="";}return;}
    if(code){cl.push(line);return;}
    if(line.startsWith("### ")){fl();out.push(<h3 key={i} style={{color:"#d4a8ff",fontSize:15,margin:"18px 0 8px",fontWeight:700}}>{line.slice(4)}</h3>);}
    else if(line.startsWith("## ")){fl();out.push(<h2 key={i} style={{color:"#fff",fontSize:19,margin:"22px 0 10px",fontWeight:800}}>{line.slice(3)}</h2>);}
    else if(line.startsWith("# ")){fl();out.push(<h1 key={i} style={{color:"#C9A84C",fontSize:24,margin:"26px 0 12px",fontWeight:900}}>{line.slice(2)}</h1>);}
    else if(line.startsWith("> ")){fl();out.push(<blockquote key={i} style={{borderLeft:"3px solid #C9A84C",paddingLeft:14,margin:"12px 0",color:"#998a7a",fontStyle:"italic",background:"#C9A84C08",padding:"10px 14px",borderRadius:"0 8px 8px 0"}}>{ri(line.slice(2))}</blockquote>);}
    else if(line.match(/^[-*] /)){lb.push(ri(line.replace(/^[-*] /,"")));}
    else if(/^\d+\. /.test(line)){fl();const n=line.match(/^(\d+)\./)?.[1]||"";out.push(<div key={i} style={{display:"flex",gap:10,margin:"5px 0"}}><span style={{color:"#C9A84C",minWidth:22,fontFamily:"monospace",fontSize:12,fontWeight:700}}>{n}.</span><span style={{color:"#ccc8e8",lineHeight:1.7}}>{ri(line.replace(/^\d+\. /,""))}</span></div>);}
    else if(line.trim()==="---"){fl();out.push(<div key={i} style={{height:1,background:"linear-gradient(90deg,transparent,#2a1f4a,transparent)",margin:"18px 0"}}/>);}
    else if(line===""){fl();out.push(<div key={i} style={{height:8}}/>);}
    else{fl();out.push(<p key={i} style={{color:"#ccc8e8",margin:"4px 0",lineHeight:1.8}}>{ri(line)}</p>);}
  });
  fl(); return <div>{out}</div>;
};

const Particles=()=>{
  const ref=useRef<HTMLCanvasElement>(null);
  useEffect(()=>{
    const c=ref.current; if(!c)return; const ctx=c.getContext("2d"); if(!ctx)return;
    const sz=()=>{c.width=c.offsetWidth;c.height=c.offsetHeight;}; sz();
    const pts=Array.from({length:60},()=>({x:Math.random()*c.width,y:Math.random()*c.height,r:Math.random()*1.4+.3,dx:(Math.random()-.5)*.18,dy:(Math.random()-.5)*.18,o:Math.random()*.9+.1,hue:Math.random()>0.7?280:45}));
    let af:number,t=0;
    const draw=()=>{t+=0.005;ctx.clearRect(0,0,c.width,c.height);pts.forEach(p=>{p.x+=p.dx;p.y+=p.dy;if(p.x<0)p.x=c.width;if(p.x>c.width)p.x=0;if(p.y<0)p.y=c.height;if(p.y>c.height)p.y=0;const pulse=Math.sin(t*2+p.x)*.3+.7;ctx.beginPath();ctx.arc(p.x,p.y,p.r*pulse,0,Math.PI*2);ctx.fillStyle=`hsla(${p.hue},80%,65%,${p.o*.6*pulse})`;ctx.fill();});for(let i=0;i<pts.length;i++)for(let j=i+1;j<pts.length;j++){const d=Math.hypot(pts[i].x-pts[j].x,pts[i].y-pts[j].y);if(d<100){ctx.beginPath();ctx.moveTo(pts[i].x,pts[i].y);ctx.lineTo(pts[j].x,pts[j].y);ctx.strokeStyle=`rgba(201,168,76,${(1-d/100)*.1})`;ctx.lineWidth=.5;ctx.stroke();}}af=requestAnimationFrame(draw);};
    draw();window.addEventListener("resize",sz);return()=>{cancelAnimationFrame(af);window.removeEventListener("resize",sz);};
  },[]);
  return <canvas ref={ref} style={{position:"absolute",inset:0,width:"100%",height:"100%",pointerEvents:"none"}}/>;
};

const Aurora=()=>(
  <div style={{position:"fixed",inset:0,pointerEvents:"none",zIndex:0,overflow:"hidden"}}>
    <div style={{position:"absolute",width:600,height:600,borderRadius:"50%",background:"radial-gradient(circle,#9B59B615 0%,transparent 70%)",top:"-10%",left:"-10%",animation:"drift1 12s ease-in-out infinite"}}/>
    <div style={{position:"absolute",width:500,height:500,borderRadius:"50%",background:"radial-gradient(circle,#C9A84C10 0%,transparent 70%)",bottom:"10%",right:"5%",animation:"drift2 15s ease-in-out infinite"}}/>
    <div style={{position:"absolute",width:400,height:400,borderRadius:"50%",background:"radial-gradient(circle,#4FC3F710 0%,transparent 70%)",top:"40%",left:"40%",animation:"drift3 18s ease-in-out infinite"}}/>
  </div>
);

const Logo=({size=36,animate=false}:{size?:number;animate?:boolean})=>(
  <svg width={size} height={size} viewBox="0 0 48 48" fill="none" style={animate?{animation:"rotateStar 8s linear infinite"}:{}}>
    <defs>
      <radialGradient id="lg1" cx="50%" cy="50%" r="50%"><stop offset="0%" stopColor="#FFE08A"/><stop offset="60%" stopColor="#C9A84C"/><stop offset="100%" stopColor="#8B5E1A"/></radialGradient>
      <radialGradient id="lg2" cx="50%" cy="50%" r="50%"><stop offset="0%" stopColor="#9B59B6"/><stop offset="100%" stopColor="#3A0F6A"/></radialGradient>
      <filter id="gf"><feGaussianBlur stdDeviation="1.5" result="blur"/><feMerge><feMergeNode in="blur"/><feMergeNode in="SourceGraphic"/></feMerge></filter>
    </defs>
    <circle cx="24" cy="24" r="22" stroke="url(#lg1)" strokeWidth="1.2" fill="none" opacity=".5"/>
    <polygon points="24,5 38,13.5 38,30.5 24,39 10,30.5 10,13.5" fill="url(#lg2)" opacity=".95"/>
    <path d="M24 13L25.8 21.2L34 24L25.8 26.8L24 35L22.2 26.8L14 24L22.2 21.2Z" fill="url(#lg1)" filter="url(#gf)"/>
    {[0,60,120,180,240,300].map((a,i)=>{const x=24+22*Math.cos(a*Math.PI/180),y=24+22*Math.sin(a*Math.PI/180);return <circle key={i} cx={x} cy={y} r="1.4" fill="#FFE08A" opacity=".8"/>;})}
  </svg>
);

const ModelSelector=({claudeModel,onClaude}:{claudeModel:ClaudeModel;onClaude:(m:ClaudeModel)=>void})=>{
  const [open,setOpen]=useState(false);
  const ref=useRef<HTMLDivElement>(null);
  useEffect(()=>{const h=(e:MouseEvent)=>{if(ref.current&&!ref.current.contains(e.target as Node))setOpen(false)};document.addEventListener("mousedown",h);return()=>document.removeEventListener("mousedown",h);},[]);
  return(
    <div ref={ref} style={{position:"relative"}}>
      <button onClick={()=>setOpen(o=>!o)} style={{display:"flex",alignItems:"center",gap:8,padding:"9px 16px",borderRadius:12,border:`1px solid ${open?"#C9A84C60":"#2a1f4a"}`,background:open?"#1a1240":"#100c20",color:"#c8c0e0",cursor:"pointer",fontSize:13,fontWeight:600,transition:"all .25s",minWidth:160}}>
        <div style={{width:8,height:8,borderRadius:"50%",background:"#C9A84C",boxShadow:"0 0 10px #C9A84C"}}/>
        <span style={{flex:1}}>{claudeModel.label}</span>
        <span style={{fontSize:10,color:"#555",transition:"transform .3s",transform:open?"rotate(180deg)":"none"}}>▲</span>
      </button>
      {open&&(
        <div style={{position:"absolute",bottom:"calc(100% + 10px)",left:0,background:"#0d0920",border:"1px solid #2a1f4a",borderRadius:16,zIndex:300,width:260,boxShadow:"0 -20px 60px #05030e99",animation:"popUp .2s ease",overflow:"hidden",padding:"10px"}}>
          <div style={{fontSize:10,color:"#4a3a6a",textTransform:"uppercase",letterSpacing:"2px",padding:"6px 10px 10px",fontWeight:700}}>✦ Select Model</div>
          {CLAUDE_MODELS.map((m,i)=>(
            <div key={i} onClick={()=>{onClaude(m);setOpen(false);}} style={{display:"flex",alignItems:"center",gap:12,padding:"12px 14px",borderRadius:12,cursor:"pointer",marginBottom:4,background:claudeModel.label===m.label?"linear-gradient(135deg,#1e1740,#180f30)":"transparent",border:`1px solid ${claudeModel.label===m.label?"#C9A84C40":"transparent"}`,transition:"all .2s"}}
              onMouseEnter={e=>{if(claudeModel.label!==m.label)(e.currentTarget as HTMLDivElement).style.background="#130f24";}}
              onMouseLeave={e=>{if(claudeModel.label!==m.label)(e.currentTarget as HTMLDivElement).style.background="transparent";}}>
              <div style={{width:4,height:36,background:"#1a1435",borderRadius:4,overflow:"hidden",flexShrink:0}}>
                <div style={{width:"100%",height:`${m.power}%`,background:"linear-gradient(180deg,#C9A84C,#8B5E1A)",borderRadius:4,marginTop:`${100-m.power}%`}}/>
              </div>
              <div style={{flex:1}}>
                <div style={{fontSize:14,fontWeight:700,color:claudeModel.label===m.label?"#C9A84C":"#e0d8f8"}}>{m.label}</div>
                <div style={{fontSize:11,color:"#665a8a",marginTop:2}}>{m.desc}</div>
              </div>
              <div style={{display:"flex",flexDirection:"column",alignItems:"flex-end",gap:4}}>
                {claudeModel.label===m.label&&<span style={{color:"#C9A84C",fontSize:16}}>✓</span>}
                <span style={{fontSize:9,color:"#69FF94",background:"#69FF9415",border:"1px solid #69FF9435",borderRadius:5,padding:"2px 7px",fontWeight:800}}>FREE</span>
                <span style={{fontSize:9,color:"#4a3a6a",fontFamily:"monospace"}}>{m.speed}</span>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

const ActivityItem=({ev}:{ev:ActivityEvent})=>{
  const a=AGENTS[ev.agent]; if(!a) return null;
  return(
    <div style={{marginBottom:10,padding:"10px 12px",background:"linear-gradient(135deg,#0a0720,#080518)",borderRadius:11,border:`1px solid ${ev.status==="thinking"?a.col+"50":ev.status==="done"?a.col+"20":"#1e1640"}`,animation:"slideInRight .3s ease",boxShadow:ev.status==="thinking"?`0 0 15px ${a.col}15`:""}}>
      <div style={{display:"flex",alignItems:"center",gap:7,marginBottom:ev.task?4:0}}>
        <span style={{color:a.col,fontSize:13}}>{a.sym}</span>
        <span style={{fontSize:10,color:a.col,fontWeight:800,fontFamily:"monospace"}}>{a.name}</span>
        <span style={{marginLeft:"auto",fontSize:9,color:"#3a2f5a"}}>{ev.time}</span>
        {ev.status==="done"&&<span style={{color:a.col,fontSize:11}}>✓</span>}
        {ev.status==="error"&&<span style={{color:"#ff6b6b",fontSize:11}}>✗</span>}
        {ev.status==="thinking"&&<div style={{width:10,height:10,border:`2px solid ${a.col}40`,borderTopColor:a.col,borderRadius:"50%",animation:"spin .8s linear infinite",flexShrink:0}}/>}
      </div>
      {ev.task&&<div style={{fontSize:10,color:"#5a4a7a",lineHeight:1.5,paddingLeft:20}}>{ev.task.slice(0,85)}{ev.task.length>85?"…":""}</div>}
      {ev.result&&<div style={{marginTop:8,fontSize:10,color:"#8a7aaa",background:"#04030a",borderRadius:7,padding:"6px 10px",lineHeight:1.6,maxHeight:80,overflow:"hidden",borderLeft:`2px solid ${a.col}40`}}>{ev.result.slice(0,180)}…</div>}
    </div>
  );
};

const Dots=({color="#C9A84C"}:{color?:string})=>(
  <span style={{display:"inline-flex",gap:4,alignItems:"center"}}>
    {[0,1,2].map(i=><span key={i} style={{width:5,height:5,borderRadius:"50%",background:color,animation:`bounceDot 1.4s ${i*.2}s infinite`,boxShadow:`0 0 6px ${color}`}}/>)}
  </span>
);

const Hero=({onPrompt}:{onPrompt:(p:string)=>void})=>{
  const prompts:[string,string][]=[["◎ Research","Latest AI breakthroughs & model releases in 2025"],["⌘ Code","Build a FastAPI app with WebSocket support & auth"],["◈ Analyze","Compare transformer vs mamba architecture in depth"],["∑ Math","Explain Fourier transforms with real-world applications"],["✿ Create","Write an epic sci-fi short story about digital consciousness"],["✎ Write","Craft a compelling pitch deck for an AI startup"]];
  return(
    <div style={{textAlign:"center",padding:"40px 28px",animation:"heroEntry 1s ease"}}>
      <div style={{marginBottom:20,display:"flex",justifyContent:"center"}}><Logo size={72} animate/></div>
      <h1 style={{fontFamily:"Cormorant Garamond,serif",fontSize:44,fontWeight:800,margin:"0 0 6px",letterSpacing:"-1.5px",background:"linear-gradient(90deg,#FFE08A,#C9A84C,#9B59B6,#C9A84C,#FFE08A)",backgroundSize:"200% auto",WebkitBackgroundClip:"text",WebkitTextFillColor:"transparent",animation:"shimmer 4s linear infinite"}}>Magic</h1>
      <p style={{color:"#3a2f5a",fontSize:11,margin:"0 0 6px",letterSpacing:"3px",textTransform:"uppercase",fontWeight:700}}>Agent Swarm Intelligence</p>
      <p style={{color:"#5a4a7a",fontSize:13,maxWidth:430,margin:"0 auto 36px",lineHeight:1.8}}>8 specialized AI agents coordinating in real-time. Better answers than any single model.</p>
      <div style={{display:"grid",gridTemplateColumns:"1fr 1fr 1fr",gap:9,maxWidth:620,margin:"0 auto"}}>
        {prompts.map(([l,p])=>(
          <button key={l} onClick={()=>onPrompt(p)} style={{padding:"13px 12px",borderRadius:13,border:"1px solid #1e1640",background:"linear-gradient(135deg,#0d0920,#0a0718)",color:"#8a7aaa",textAlign:"left",cursor:"pointer",fontSize:11.5,lineHeight:1.5,display:"flex",flexDirection:"column",gap:5,transition:"all .25s"}}
            onMouseEnter={e=>{const el=e.currentTarget as HTMLButtonElement;el.style.borderColor="#C9A84C50";el.style.background="linear-gradient(135deg,#130f24,#0e0b1e)";el.style.color="#c8c0e0";el.style.transform="translateY(-2px)";}}
            onMouseLeave={e=>{const el=e.currentTarget as HTMLButtonElement;el.style.borderColor="#1e1640";el.style.background="linear-gradient(135deg,#0d0920,#0a0718)";el.style.color="#8a7aaa";el.style.transform="none";}}>
            <span style={{color:"#C9A84C",fontWeight:800,fontSize:10,letterSpacing:"1px",textTransform:"uppercase"}}>{l}</span>
            <span>{p}</span>
          </button>
        ))}
      </div>
    </div>
  );
};

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
  const [inputFocused,setInputFocused]=useState(false);
  const bottomRef=useRef<HTMLDivElement>(null);
  const taRef=useRef<HTMLTextAreaElement>(null);

  useEffect(()=>{ document.title="Magic — Agent Swarm"; },[]);
  useEffect(()=>{ bottomRef.current?.scrollIntoView({behavior:"smooth"}); },[messages,activity]);
  useEffect(()=>{ if(taRef.current){taRef.current.style.height="auto";taRef.current.style.height=Math.min(taRef.current.scrollHeight,180)+"px";} },[input]);

  const onUpdate=useCallback((u:Partial<ActivityEvent>&{plan?:SwarmPlan;result?:string})=>{
    if(u.phase==="planned"&&u.plan) setPlan(u.plan);
    if(u.agent){ setActiveA(p=>({...p,[u.agent as string]:u.status as string})); setActivity(p=>[...p,{...u,time:new Date().toLocaleTimeString()} as ActivityEvent]); }
  },[]);

  const send=async()=>{
    if(!input.trim()||loading) return;
    const msg=input.trim(); setInput(""); setLoading(true); setActivity([]); setActiveA({}); setPlan(null);
    setMessages(p=>[...p,{role:"user",content:msg}]);
    try{
      let finalAnswer="";
      if(mode==="swarm"){ finalAnswer=await runSwarm(msg,onUpdate,claudeModel.id); }
      else { finalAnswer=await callClaude(singleA,msg,"",claudeModel.id); setActivity([{agent:singleA,status:"done",phase:"done",time:new Date().toLocaleTimeString()}]); }
      setMessages(p=>[...p,{role:"assistant",content:finalAnswer,agents:mode==="swarm"?Object.keys(activeA):[singleA],mode,model:claudeModel.label}]);
    } catch(e){ setMessages(p=>[...p,{role:"assistant",content:`**Error:** ${(e as Error).message}`,error:true}]); }
    finally{ setLoading(false); setActiveA({}); }
  };

  const bg="#07051a",surface="#0b0819",border="#1a1438",accent="#C9A84C";

  return(
    <div style={{display:"flex",height:"100vh",background:bg,fontFamily:"'DM Sans',sans-serif",color:"#e0d8f8",overflow:"hidden",position:"relative"}}>
      <Aurora/>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Cormorant+Garamond:wght@600;700;800&family=DM+Sans:wght@300;400;500;600;700&display=swap');
        *{box-sizing:border-box;}
        ::-webkit-scrollbar{width:3px;} ::-webkit-scrollbar-thumb{background:#2a1f4a;border-radius:4px;}
        @keyframes shimmer{0%{background-position:200% 0}100%{background-position:-200% 0}}
        @keyframes heroEntry{from{opacity:0;transform:scale(.95) translateY(20px)}to{opacity:1;transform:scale(1) translateY(0)}}
        @keyframes popUp{from{opacity:0;transform:scale(.95) translateY(8px)}to{opacity:1;transform:scale(1) translateY(0)}}
        @keyframes slideInRight{from{opacity:0;transform:translateX(10px)}to{opacity:1;transform:translateX(0)}}
        @keyframes bounceDot{0%,80%,100%{transform:scale(0)}40%{transform:scale(1) translateY(-4px)}}
        @keyframes spin{to{transform:rotate(360deg)}}
        @keyframes rotateStar{0%{transform:rotate(0)}100%{transform:rotate(360deg)}}
        @keyframes drift1{0%,100%{transform:translate(0,0)}50%{transform:translate(40px,-30px)}}
        @keyframes drift2{0%,100%{transform:translate(0,0)}50%{transform:translate(-50px,20px)}}
        @keyframes drift3{0%,100%{transform:translate(0,0)}50%{transform:translate(30px,40px)}}
        @keyframes msgSlideIn{from{opacity:0;transform:translateY(12px)}to{opacity:1;transform:translateY(0)}}
        @keyframes fadeInUp{from{opacity:0;transform:translateY(16px)}to{opacity:1;transform:translateY(0)}}
        @keyframes pulse{0%,100%{opacity:1}50%{opacity:.4}}
        textarea:focus{outline:none;} textarea::placeholder{color:#252040;}
        .hb:hover{background:#140f28!important;border-color:#C9A84C40!important;}
        .agc:hover{background:#0f0c20!important;border-color:#3a2f6a!important;}
        .gt{background:linear-gradient(90deg,#FFE08A,#C9A84C,#9B59B6,#C9A84C,#FFE08A);background-size:200% auto;-webkit-background-clip:text;-webkit-text-fill-color:transparent;animation:shimmer 4s linear infinite;}
      `}</style>

      {sidebar&&(
        <div style={{width:260,background:surface,borderRight:`1px solid ${border}`,display:"flex",flexDirection:"column",flexShrink:0,position:"relative",overflow:"hidden",zIndex:10}}>
          <Particles/>
          <div style={{position:"relative",zIndex:1,display:"flex",flexDirection:"column",height:"100%"}}>
            <div style={{padding:"20px 18px 16px",borderBottom:`1px solid ${border}`,display:"flex",alignItems:"center",gap:12}}>
              <Logo size={40}/>
              <div>
                <div className="gt" style={{fontFamily:"Cormorant Garamond,serif",fontWeight:800,fontSize:25,letterSpacing:"-0.8px",lineHeight:1}}>Magic</div>
                <div style={{fontSize:9,color:"#3a2f5a",letterSpacing:"2.5px",textTransform:"uppercase",marginTop:2}}>Swarm Intelligence</div>
              </div>
            </div>
            <div style={{padding:"14px 16px 10px"}}>
              <div style={{fontSize:9,color:"#3a2f5a",textTransform:"uppercase",letterSpacing:"2px",marginBottom:9,fontWeight:700}}>Mode</div>
              <div style={{display:"flex",gap:4,background:"#07051a",borderRadius:12,padding:4,border:`1px solid ${border}`}}>
                {[["swarm","✦ Swarm"],["single","● Single"]].map(([m,l])=>(
                  <button key={m} onClick={()=>setMode(m)} style={{flex:1,padding:"8px 6px",borderRadius:10,border:"none",cursor:"pointer",background:mode===m?"linear-gradient(135deg,#C9A84C,#8B5E1A)":"transparent",color:mode===m?"#fff":"#4a3a6a",fontSize:12,fontWeight:800,transition:"all .3s"}}>{l}</button>
                ))}
              </div>
            </div>
            <div style={{padding:"0 12px",flex:1,overflowY:"auto"}}>
              <div style={{fontSize:9,color:"#3a2f5a",textTransform:"uppercase",letterSpacing:"2px",marginBottom:9,fontWeight:700}}>{mode==="swarm"?"Swarm Agents":"Select Agent"}</div>
              {Object.values(AGENTS).filter(a=>mode==="swarm"?true:a.id!=="orchestrator"&&a.id!=="synthesizer"&&a.id!=="critic").map((agent,idx)=>{
                const st=activeA[agent.id],sel=mode==="single"&&singleA===agent.id;
                return(
                  <div key={agent.id} onClick={()=>mode==="single"&&setSingleA(agent.id)} className="agc"
                    style={{display:"flex",alignItems:"center",gap:9,padding:"9px 10px",borderRadius:10,marginBottom:4,cursor:mode==="single"?"pointer":"default",background:sel?`${agent.col}12`:st==="thinking"?`${agent.col}0e`:"transparent",border:`1px solid ${sel?agent.col+"50":st==="thinking"?agent.col+"35":"transparent"}`,transition:"all .25s",animation:`fadeInUp .4s ${idx*.05}s both`}}>
                    <div style={{width:8,height:8,borderRadius:"50%",flexShrink:0,background:st==="thinking"?agent.col:st==="done"?`${agent.col}80`:sel?agent.col:"#2a1f4a",boxShadow:st==="thinking"?`0 0 10px ${agent.col}`:"none",animation:st==="thinking"?"pulse 1s infinite":"none",transition:"all .3s"}}/>
                    <span style={{fontSize:13,color:agent.col}}>{agent.sym}</span>
                    <div style={{flex:1,minWidth:0}}>
                      <div style={{fontSize:11,fontWeight:700,color:st||sel?agent.col:"#5a4a7a",fontFamily:"monospace"}}>{agent.name}</div>
                      <div style={{fontSize:9,color:"#2a1f4a",whiteSpace:"nowrap",overflow:"hidden",textOverflow:"ellipsis"}}>{agent.desc}</div>
                    </div>
                    {st==="done"&&<span style={{fontSize:10,color:agent.col}}>✓</span>}
                    {st==="thinking"&&<div style={{width:10,height:10,border:`2px solid ${agent.col}30`,borderTopColor:agent.col,borderRadius:"50%",animation:"spin .7s linear infinite",flexShrink:0}}/>}
                  </div>
                );
              })}
            </div>
            <div style={{padding:"12px",borderTop:`1px solid ${border}`,display:"flex",gap:6}}>
              <button onClick={()=>{setMessages([]);setActivity([]);setActiveA({});setPlan(null);}} className="hb" style={{flex:1,padding:"9px",borderRadius:10,border:`1px solid ${border}`,background:"transparent",color:"#4a3a6a",fontSize:11,cursor:"pointer",transition:"all .2s",fontWeight:600}}>✦ New Chat</button>
              <button onClick={()=>setSidebar(false)} className="hb" style={{padding:"9px 14px",borderRadius:10,border:`1px solid ${border}`,background:"transparent",color:"#4a3a6a",fontSize:14,cursor:"pointer"}}>‹</button>
            </div>
          </div>
        </div>
      )}

      <div style={{flex:1,display:"flex",flexDirection:"column",overflow:"hidden",position:"relative",zIndex:1}}>
        <div style={{padding:"12px 20px",borderBottom:`1px solid ${border}`,background:`${surface}ee`,display:"flex",alignItems:"center",gap:12,flexShrink:0,backdropFilter:"blur(20px)"}}>
          {!sidebar&&<button onClick={()=>setSidebar(true)} className="hb" style={{padding:"8px 12px",borderRadius:10,border:`1px solid ${border}`,background:"transparent",color:"#aaa",cursor:"pointer",fontSize:15}}>›</button>}
          {!sidebar&&<Logo size={28}/>}
          <div style={{flex:1}}>
            <div style={{fontFamily:"Cormorant Garamond,serif",fontWeight:700,fontSize:17,color:"#fff"}}>{mode==="swarm"?"✦ Swarm Intelligence":`${AGENTS[singleA]?.sym} ${AGENTS[singleA]?.name}`}</div>
            <div style={{fontSize:10,color:"#2e2650",marginTop:1,display:"flex",gap:8,alignItems:"center"}}>
              <span style={{background:"#69FF9420",color:"#69FF94",padding:"1px 6px",borderRadius:10,fontSize:9,fontWeight:700}}>FREE</span>
              {claudeModel.label} · {mode==="swarm"?"8 agents":AGENTS[singleA]?.desc}
            </div>
          </div>
          {loading&&(<div style={{display:"flex",alignItems:"center",gap:8,padding:"6px 14px",background:`${accent}12`,border:`1px solid ${accent}30`,borderRadius:20,animation:"pulse 1.5s infinite"}}><div style={{width:6,height:6,borderRadius:"50%",background:accent,animation:"pulse 1s infinite"}}/><span style={{fontSize:11,color:accent,fontWeight:700}}>Processing…</span></div>)}
          <button onClick={()=>setShowAct(p=>!p)} className="hb" style={{padding:"8px 16px",borderRadius:10,border:`1px solid ${showAct?accent+"50":border}`,background:showAct?`${accent}12`:"transparent",color:showAct?accent:"#4a3a6a",fontSize:11,cursor:"pointer",fontWeight:700,transition:"all .25s"}}>✦ Activity</button>
        </div>

        <div style={{flex:1,display:"flex",overflow:"hidden"}}>
          <div style={{flex:1,overflowY:"auto",padding:"24px 0"}}>
            {messages.length===0&&!loading&&<Hero onPrompt={p=>setInput(p)}/>}
            {messages.map((msg,i)=>(
              <div key={i} style={{padding:"0 24px",marginBottom:22,display:"flex",flexDirection:"column",alignItems:msg.role==="user"?"flex-end":"flex-start",animation:"msgSlideIn .4s ease"}}>
                {msg.role==="user"?(
                  <div style={{maxWidth:"65%",padding:"13px 18px",background:"linear-gradient(135deg,#2a1f60,#1a1050)",border:"1px solid #3a2f8a",borderRadius:"18px 18px 4px 18px",color:"#e8e0ff",fontSize:14,lineHeight:1.7}}>{msg.content}</div>
                ):(
                  <div style={{maxWidth:"88%",width:"100%"}}>
                    <div style={{display:"flex",alignItems:"center",gap:8,marginBottom:10}}>
                      <Logo size={20}/>
                      <span style={{fontFamily:"Cormorant Garamond,serif",fontWeight:700,color:accent,fontSize:14}}>Magic</span>
                      {msg.model&&<span style={{fontSize:9,color:"#69FF94",background:"#69FF9415",padding:"1px 6px",borderRadius:10,fontWeight:700}}>FREE · {msg.model}</span>}
                    </div>
                    {msg.agents&&msg.mode==="swarm"&&(
                      <div style={{display:"flex",gap:5,flexWrap:"wrap",marginBottom:10}}>
                        {[...new Set(msg.agents)].slice(0,7).map((id,idx)=>{const a=AGENTS[id];if(!a)return null;return(<div key={id} style={{display:"flex",alignItems:"center",gap:4,padding:"3px 9px",borderRadius:20,background:`${a.col}0d`,border:`1px solid ${a.col}22`,fontSize:10,color:a.col,fontFamily:"monospace",fontWeight:700,animation:`fadeInUp .3s ${idx*.05}s both`}}><span>{a.sym}</span>{a.name}</div>);})}
                      </div>
                    )}
                    <div style={{background:`linear-gradient(135deg,${surface},#0a0820)`,border:`1px solid ${border}`,borderRadius:"4px 18px 18px 18px",padding:"20px 24px",fontSize:14,lineHeight:1.85,boxShadow:"0 8px 40px #00000040"}}>
                      {msg.error?<div style={{color:"#ff6b6b"}}><MD text={msg.content}/></div>:<MD text={msg.content}/>}
                    </div>
                  </div>
                )}
              </div>
            ))}
            {loading&&(
              <div style={{padding:"0 24px",marginBottom:18}}>
                <div style={{display:"flex",alignItems:"center",gap:8,marginBottom:10}}><Logo size={20}/><span style={{fontFamily:"Cormorant Garamond,serif",fontWeight:700,color:accent,fontSize:14}}>Magic</span></div>
                <div style={{background:`linear-gradient(135deg,${surface},#0a0820)`,border:`1px solid ${accent}30`,borderRadius:"4px 18px 18px 18px",padding:"16px 20px",display:"inline-flex",alignItems:"center",gap:12,animation:"pulse 2s infinite"}}>
                  <Dots/><span style={{fontSize:13,color:"#4a3a6a",fontStyle:"italic"}}>{mode==="swarm"?"Swarm coordinating…":`${AGENTS[singleA]?.name} thinking…`}</span>
                </div>
              </div>
            )}
            <div ref={bottomRef}/>
          </div>

          {showAct&&(
            <div style={{width:280,background:surface,borderLeft:`1px solid ${border}`,display:"flex",flexDirection:"column",flexShrink:0}}>
              <div style={{padding:"14px 16px",borderBottom:`1px solid ${border}`,display:"flex",alignItems:"center",gap:8}}>
                <div style={{width:8,height:8,borderRadius:"50%",background:accent,boxShadow:`0 0 8px ${accent}`,animation:loading?"pulse 1s infinite":"none"}}/>
                <div><div style={{fontFamily:"Cormorant Garamond,serif",fontWeight:700,fontSize:15,color:"#fff"}}>Agent Activity</div><div style={{fontSize:9,color:"#2e2650",letterSpacing:"1px",textTransform:"uppercase"}}>Real-time swarm telemetry</div></div>
              </div>
              {plan&&(
                <div style={{padding:"12px 14px",borderBottom:`1px solid ${border}`,background:`${accent}06`}}>
                  <div style={{fontSize:9,color:accent,textTransform:"uppercase",letterSpacing:"2px",marginBottom:8,fontWeight:800}}>✦ Swarm Plan</div>
                  <div style={{fontSize:11,color:"#7a6a9a",lineHeight:1.6,marginBottom:10,fontStyle:"italic"}}>{plan.strategy}</div>
                  {plan.tasks?.map((t,i)=>(<div key={i} style={{display:"flex",gap:8,marginBottom:7}}><div style={{background:`${accent}20`,border:`1px solid ${accent}35`,borderRadius:6,padding:"2px 7px",fontSize:9,color:accent,fontWeight:800,fontFamily:"monospace",flexShrink:0}}>P{t.priority}</div><div><div style={{fontSize:10,color:"#8a78aa",fontWeight:800,fontFamily:"monospace"}}>{t.agent}</div><div style={{fontSize:9.5,color:"#4a3a6a",lineHeight:1.5}}>{t.task?.slice(0,60)}{t.task?.length>60?"…":""}</div></div></div>))}
                </div>
              )}
              <div style={{flex:1,overflowY:"auto",padding:"10px 12px"}}>
                {activity.length===0&&!loading&&(<div style={{textAlign:"center",padding:"44px 0",opacity:.4}}><div style={{display:"flex",justifyContent:"center",marginBottom:12}}><Logo size={40}/></div><div style={{fontSize:12,color:"#3a2f5a",lineHeight:1.7}}>Send a message to<br/>activate the swarm</div></div>)}
                {activity.map((ev,i)=><ActivityItem key={i} ev={ev}/>)}
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

        <div style={{padding:"12px 20px 16px",background:`${surface}f0`,borderTop:`1px solid ${border}`,flexShrink:0,backdropFilter:"blur(20px)"}}>
          {mode==="swarm"&&(
            <div style={{display:"flex",gap:4,flexWrap:"wrap",marginBottom:10}}>
              {Object.values(AGENTS).filter(a=>a.id!=="critic").map(a=>(<div key={a.id} style={{display:"flex",alignItems:"center",gap:3,padding:"2px 8px",borderRadius:20,background:`${a.col}0a`,border:`1px solid ${a.col}1a`,fontSize:9,color:a.col,fontFamily:"monospace",fontWeight:700}}><span>{a.sym}</span>{a.name}</div>))}
            </div>
          )}
          <div style={{display:"flex",alignItems:"center",gap:8,marginBottom:10}}>
            <ModelSelector claudeModel={claudeModel} onClaude={setClaudeModel}/>
          </div>
          <div style={{display:"flex",gap:10,alignItems:"flex-end",background:"linear-gradient(135deg,#0a0720,#08051a)",border:`1px solid ${inputFocused?accent+"60":loading?accent+"40":border}`,borderRadius:16,padding:"13px 15px",transition:"all .3s",boxShadow:inputFocused?`0 0 30px ${accent}18`:""}}>
            <textarea ref={taRef} value={input} onChange={e=>setInput(e.target.value)} onKeyDown={e=>{if(e.key==="Enter"&&!e.shiftKey){e.preventDefault();send();}}} onFocus={()=>setInputFocused(true)} onBlur={()=>setInputFocused(false)} placeholder={mode==="swarm"?"Ask anything — the Magic Swarm will orchestrate a brilliant answer…":`Ask ${AGENTS[singleA]?.name} anything…`} disabled={loading} rows={1} style={{flex:1,background:"transparent",border:"none",color:"#e0d8f8",fontSize:14,lineHeight:1.7,resize:"none",fontFamily:"'DM Sans',sans-serif",maxHeight:180,minHeight:24}}/>
            <button onClick={send} disabled={loading||!input.trim()} style={{width:42,height:42,borderRadius:12,border:"none",background:loading||!input.trim()?"#150f2a":`linear-gradient(135deg,#C9A84C,#8B5E1A)`,color:loading||!input.trim()?"#3a2f5a":"#fff",cursor:loading||!input.trim()?"not-allowed":"pointer",display:"flex",alignItems:"center",justifyContent:"center",fontSize:18,flexShrink:0,transition:"all .3s",boxShadow:!loading&&input.trim()?`0 6px 24px ${accent}50`:""}}>
              {loading?<div style={{width:15,height:15,border:"2px solid #3a2f5a",borderTopColor:accent,borderRadius:"50%",animation:"spin .7s linear infinite"}}/>:<span>✦</span>}
            </button>
          </div>
          <div style={{textAlign:"center",marginTop:8,fontSize:9,color:"#1a1430",letterSpacing:"2px",fontWeight:600}}>MAGIC · AGENT SWARM · {claudeModel.label.toUpperCase()} · 100% FREE · OPEN SOURCE</div>
        </div>
      </div>
    </div>
  );
}
