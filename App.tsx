import { useState, useCallback } from "react";
import {
  detectElectricalComponents,
  DetectionResult,
  DetectedComponent,
  groupByRoom,
  getReviewItems,
} from "./analyze_pdf";

const C = {
  bg:      "#0A1628",
  navy:    "#0F1E35",
  card:    "#132240",
  blue:    "#1D6EFD",
  blueLt:  "#4B8FFF",
  green:   "#00C48C",
  amber:   "#FFB020",
  red:     "#FF4D4D",
  text:    "#EDF2FF",
  muted:   "#5C7A9E",
  border:  "#1A3358",
  dim:     "#8BA4C4",
};

type Screen = "upload" | "scanning" | "results";
type ResultTab = "schedule" | "risks";

const LABELS: Record<string, string> = {
  GPO_STANDARD:"Power Point",GPO_DOUBLE:"Double Power Point",GPO_WEATHERPROOF:"Weatherproof GPO",
  GPO_USB:"USB Power Point",DOWNLIGHT_RECESSED:"Downlight",PENDANT_FEATURE:"Pendant Light",
  EXHAUST_FAN:"Exhaust Fan",SWITCHING_STANDARD:"Light Switch",SWITCHING_DIMMER:"Dimmer Switch",
  SWITCHING_2WAY:"2-Way Switch",SWITCHBOARD_MAIN:"Main Switchboard",SWITCHBOARD_SUB:"Sub Board",
  AC_SPLIT:"Split System AC",AC_DUCTED:"Ducted AC",DATA_CAT6:"Data Point",DATA_TV:"TV/Antenna Point",
  SECURITY_CCTV:"CCTV Camera",SECURITY_INTERCOM:"Intercom",SECURITY_ALARM:"Alarm Sensor",
  EV_CHARGER:"EV Charger",POOL_OUTDOOR:"Pool Equipment",GATE_ACCESS:"Gate/Access Control",
  AUTOMATION_HUB:"Home Automation",
};

const FLAG_SHORT: Record<string, string> = {
  HEIGHT_RISK:"Height risk",AUTOMATION_DEPENDENCY:"Automation needed",MISSING_CIRCUIT:"Missing circuit",
  SCOPE_CONFIRM:"Confirm scope",OUTDOOR_LOCATION:"Outdoor",OFF_FORM_PREMIUM:"Off-form premium",
  CABLE_RUN_LONG:"Long cable run",LOW_CONFIDENCE:"Verify on drawing",SYMBOL_AMBIGUOUS:"Check manually",
};

const CSS = `
  *{box-sizing:border-box;-webkit-tap-highlight-color:transparent;}
  html,body{margin:0;padding:0;background:#0A1628;overscroll-behavior:none;font-family:-apple-system,BlinkMacSystemFont,'SF Pro Display',sans-serif;}
  @keyframes fadeUp{from{opacity:0;transform:translateY(10px)}to{opacity:1;transform:translateY(0)}}
  @keyframes pulse{0%,100%{transform:scale(1);opacity:1}50%{transform:scale(1.07);opacity:.75}}
  @keyframes slideIn{from{opacity:0;transform:translateY(5px)}to{opacity:1;transform:translateY(0)}}
`;

const fmt = (n: number) => n >= 1000 ? `$${(n/1000).toFixed(n%1000===0?0:1)}k` : `$${n}`;

function UploadScreen({onFile}:{onFile:(f:File)=>void}) {
  const [drag, setDrag] = useState(false);
  const drop = useCallback((e:React.DragEvent)=>{e.preventDefault();setDrag(false);const f=e.dataTransfer.files[0];if(f?.type==="application/pdf")onFile(f);},[onFile]);
  return (
    <div style={{minHeight:"100vh",background:C.bg,display:"flex",flexDirection:"column"}}>
      <div style={{padding:"20px 20px 0",display:"flex",alignItems:"center",justifyContent:"space-between"}}>
        <div style={{fontSize:20,fontWeight:800,color:C.blue,letterSpacing:"-0.03em"}}>Electra<span style={{color:C.text}}>Scan</span></div>
        <div style={{fontSize:11,color:C.muted,background:C.navy,padding:"4px 10px",borderRadius:20,border:`1px solid ${C.border}`}}>Vesh Electrical</div>
      </div>
      <div style={{padding:"32px 20px 0",animation:"fadeUp .4s ease"}}>
        <div style={{fontSize:30,fontWeight:800,color:C.text,letterSpacing:"-0.03em",lineHeight:1.15,marginBottom:10}}>Scan a<br/>drawing</div>
        <div style={{fontSize:14,color:C.muted,lineHeight:1.6,marginBottom:28}}>Upload the electrical PDF from your email. ElectraScan detects every component and builds your estimate.</div>
        <label style={{display:"block",cursor:"pointer"}}>
          <div onDragOver={e=>{e.preventDefault();setDrag(true);}} onDragLeave={()=>setDrag(false)} onDrop={drop}
            style={{background:drag?"#0D2347":C.card,border:`2px dashed ${drag?C.blue:C.border}`,borderRadius:20,padding:"40px 20px",textAlign:"center",transition:"all .2s"}}>
            <div style={{fontSize:48,marginBottom:12}}>📄</div>
            <div style={{fontSize:17,fontWeight:700,color:C.text,marginBottom:6}}>Drop PDF here</div>
            <div style={{fontSize:13,color:C.muted,marginBottom:20}}>or tap to choose from files or email</div>
            <div style={{display:"inline-block",background:C.blue,color:"#fff",fontSize:15,fontWeight:700,padding:"13px 32px",borderRadius:12}}>Choose PDF</div>
          </div>
          <input type="file" accept="application/pdf" style={{display:"none"}} onChange={e=>{const f=e.target.files?.[0];if(f)onFile(f);}}/>
        </label>
      </div>
      <div style={{margin:"20px 20px 0",background:C.card,borderRadius:16,padding:"18px 18px 14px",border:`1px solid ${C.border}`}}>
        <div style={{fontSize:11,fontWeight:700,color:C.muted,letterSpacing:"0.08em",textTransform:"uppercase" as const,marginBottom:14}}>What gets detected</div>
        <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:"8px 12px"}}>
          {[["⚡","Power points"],["💡","Downlights"],["🔆","Switches"],["🔌","Switchboards"],["❄️","AC units"],["📡","Data & TV"],["📹","Security & CCTV"],["🚗","EV chargers"],["🏊","Pool equipment"],["🏠","Automation"]].map(([icon,label])=>(
            <div key={label} style={{display:"flex",alignItems:"center",gap:8,fontSize:13,color:C.dim}}><span style={{fontSize:14}}>{icon}</span>{label}</div>
          ))}
        </div>
      </div>
      <div style={{height:40}}/>
    </div>
  );
}

function ScanningScreen({fileName}:{fileName:string}) {
  return (
    <div style={{minHeight:"100vh",background:C.bg,display:"flex",flexDirection:"column",alignItems:"center",justifyContent:"center",padding:32,textAlign:"center"}}>
      <div style={{width:88,height:88,borderRadius:"50%",background:`${C.blue}18`,border:`2.5px solid ${C.blue}`,display:"flex",alignItems:"center",justifyContent:"center",fontSize:36,marginBottom:28,animation:"pulse 1.8s ease-in-out infinite"}}>⚡</div>
      <div style={{fontSize:22,fontWeight:800,color:C.text,marginBottom:10,letterSpacing:"-0.02em"}}>Scanning drawing...</div>
      <div style={{fontSize:14,color:C.muted,lineHeight:1.7,maxWidth:280}}>Claude Vision is reading <strong style={{color:C.dim}}>{fileName}</strong><br/>and detecting every electrical component.</div>
      <div style={{marginTop:28,display:"flex",gap:6,flexWrap:"wrap" as const,justifyContent:"center"}}>
        {["GPOs","Lighting","Switchboards","AC","Security"].map((item,i)=>(
          <div key={item} style={{fontSize:11,color:C.blue,background:`${C.blue}18`,padding:"4px 8px",borderRadius:6,animation:`fadeUp .3s ease ${i*.1}s both`}}>{item}</div>
        ))}
      </div>
    </div>
  );
}

function RoomCard({room,components,defaultOpen}:{room:string;components:DetectedComponent[];defaultOpen:boolean}) {
  const [open,setOpen] = useState(defaultOpen);
  const roomTotal = components.reduce((s,c)=>s+c.line_total,0);
  const hasReview = components.some(c=>c.needs_review);
  return (
    <div style={{background:C.card,border:`1px solid ${C.border}`,borderRadius:16,marginBottom:10,overflow:"hidden"}}>
      <button onClick={()=>setOpen(o=>!o)} style={{width:"100%",background:"none",border:"none",padding:"16px 18px",display:"flex",alignItems:"center",justifyContent:"space-between",cursor:"pointer",textAlign:"left" as const}}>
        <div style={{display:"flex",alignItems:"center",gap:10}}>
          <div style={{fontSize:14,fontWeight:700,color:C.text}}>{room}</div>
          {hasReview&&<div style={{fontSize:10,background:`${C.amber}22`,color:C.amber,padding:"2px 7px",borderRadius:10,fontWeight:600}}>Review</div>}
        </div>
        <div style={{display:"flex",alignItems:"center",gap:12}}>
          <div style={{fontSize:15,fontWeight:800,color:C.blue}}>{fmt(roomTotal)}</div>
          <div style={{fontSize:20,color:C.muted,lineHeight:1,transform:open?"rotate(90deg)":"rotate(0deg)",transition:"transform .2s"}}>›</div>
        </div>
      </button>
      {open&&(
        <div style={{padding:"0 18px 16px",animation:"slideIn .2s ease"}}>
          <div style={{height:1,background:C.border,marginBottom:14}}/>
          {components.map((c,i)=>(
            <div key={i} style={{display:"flex",alignItems:"flex-start",justifyContent:"space-between",padding:"10px 0",borderBottom:i<components.length-1?`1px solid ${C.border}`:"none",gap:12}}>
              <div style={{flex:1,minWidth:0}}>
                <div style={{fontSize:13,fontWeight:600,color:C.text,marginBottom:3}}>{LABELS[c.type]??c.type}</div>
                {c.notes&&<div style={{fontSize:11,color:C.muted,lineHeight:1.4}}>{c.notes}</div>}
                {c.flags.filter(f=>f!=="LOW_CONFIDENCE").slice(0,2).map(f=>(
                  <span key={f} style={{display:"inline-block",fontSize:10,color:C.amber,background:`${C.amber}18`,padding:"2px 6px",borderRadius:5,marginTop:4,marginRight:4}}>{FLAG_SHORT[f]??f}</span>
                ))}
              </div>
              <div style={{textAlign:"right" as const,flexShrink:0}}>
                <div style={{display:"flex",alignItems:"center",gap:5,justifyContent:"flex-end",marginBottom:4}}>
                  <div style={{width:6,height:6,borderRadius:"50%",background:c.confidence>=90?C.green:c.confidence>=70?C.amber:C.red}}/>
                  <span style={{fontSize:11,color:C.muted}}>{c.confidence}%</span>
                </div>
                <div style={{display:"inline-flex",alignItems:"center",gap:4,background:C.bg,border:`1px solid ${C.border}`,borderRadius:8,padding:"4px 10px",marginBottom:4}}>
                  <span style={{fontSize:15,fontWeight:800,color:C.text}}>{c.quantity}</span>
                  <span style={{fontSize:10,color:C.muted}}>EA</span>
                </div>
                <div style={{fontSize:13,fontWeight:700,color:C.text}}>${c.line_total.toLocaleString()}</div>
                <div style={{fontSize:10,color:C.muted}}>@${c.unit_price}/ea</div>
              </div>
            </div>
          ))}
          <div style={{paddingTop:12,textAlign:"right" as const,fontSize:12,color:C.muted}}>Room total: <strong style={{color:C.text,fontSize:14}}>${roomTotal.toLocaleString()}</strong></div>
        </div>
      )}
    </div>
  );
}

function ResultsScreen({result,fileName,onReset}:{result:DetectionResult;fileName:string;onReset:()=>void}) {
  const [tab,setTab] = useState<ResultTab>("schedule");
  const byRoom = groupByRoom(result.components);
  const rooms = Object.keys(byRoom);
  const reviewCount = getReviewItems(result.components).length;
  const highRisks = result.risk_flags.filter(f=>f.level==="high").length;
  const gst = result.estimate_subtotal*0.1;
  const total = result.estimate_subtotal+gst;

  const exportEstimate = () => {
    const lines=[`ElectraScan Estimate — ${fileName}`,`Generated: ${new Date().toLocaleDateString("en-AU")}`,`Scale: ${result.scale_detected}`,"",...result.components.map(c=>`${LABELS[c.type]??c.type} | ${c.room} | Qty: ${c.quantity} | $${c.line_total}`),``,`Subtotal ex GST: $${result.estimate_subtotal.toLocaleString()}`,`GST: $${gst.toLocaleString()}`,`TOTAL inc GST: $${total.toLocaleString()}`].join("\n");
    const a=document.createElement("a");a.href=URL.createObjectURL(new Blob([lines],{type:"text/plain"}));a.download=`ElectraScan-Estimate.txt`;a.click();
  };

  return (
    <div style={{minHeight:"100vh",background:C.bg,display:"flex",flexDirection:"column",paddingBottom:80}}>
      {/* Sticky header */}
      <div style={{position:"sticky",top:0,zIndex:100,background:C.navy,borderBottom:`1px solid ${C.border}`,padding:"14px 18px"}}>
        <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",marginBottom:14}}>
          <div style={{fontSize:16,fontWeight:800,color:C.blue,letterSpacing:"-0.02em"}}>Electra<span style={{color:C.text}}>Scan</span></div>
          <button onClick={onReset} style={{background:"none",border:`1px solid ${C.border}`,color:C.muted,fontSize:12,padding:"6px 14px",borderRadius:8,cursor:"pointer"}}>New scan</button>
        </div>
        <div style={{display:"grid",gridTemplateColumns:"1fr 1fr 1fr",gap:8}}>
          <div style={{background:C.card,borderRadius:12,padding:"12px 14px"}}>
            <div style={{fontSize:20,fontWeight:800,color:C.blue,letterSpacing:"-0.02em"}}>{fmt(total)}</div>
            <div style={{fontSize:10,color:C.muted,marginTop:2}}>inc GST</div>
          </div>
          <div style={{background:C.card,borderRadius:12,padding:"12px 14px"}}>
            <div style={{fontSize:20,fontWeight:800,color:reviewCount>0?C.amber:C.green}}>{reviewCount}</div>
            <div style={{fontSize:10,color:C.muted,marginTop:2}}>to review</div>
          </div>
          <div style={{background:C.card,borderRadius:12,padding:"12px 14px"}}>
            <div style={{fontSize:20,fontWeight:800,color:highRisks>0?C.red:C.green}}>{highRisks}</div>
            <div style={{fontSize:10,color:C.muted,marginTop:2}}>risk flags</div>
          </div>
        </div>
        <div style={{marginTop:10,fontSize:11,color:C.muted}}>{fileName} · {result.page_count}p · Scale {result.scale_detected} · {result.components.length} items</div>
      </div>

      {/* Scrollable content */}
      <div style={{flex:1,padding:"16px 16px 0",overflowY:"auto"}}>
        {tab==="schedule"&&(
          <div>
            {rooms.map((room,i)=><RoomCard key={room} room={room} components={byRoom[room]} defaultOpen={i===0}/>)}
            <div style={{background:C.card,border:`1px solid ${C.border}`,borderRadius:16,padding:"18px",marginTop:6}}>
              <div style={{display:"flex",justifyContent:"space-between",marginBottom:10}}>
                <span style={{fontSize:13,color:C.muted}}>Subtotal ex GST</span>
                <span style={{fontSize:15,fontWeight:700,color:C.text}}>${result.estimate_subtotal.toLocaleString()}</span>
              </div>
              <div style={{display:"flex",justifyContent:"space-between",paddingBottom:14,borderBottom:`1px solid ${C.border}`}}>
                <span style={{fontSize:13,color:C.muted}}>GST (10%)</span>
                <span style={{fontSize:13,color:C.muted}}>${gst.toLocaleString()}</span>
              </div>
              <div style={{display:"flex",justifyContent:"space-between",paddingTop:14}}>
                <span style={{fontSize:16,fontWeight:800,color:C.text}}>Total inc GST</span>
                <span style={{fontSize:22,fontWeight:800,color:C.green}}>${total.toLocaleString()}</span>
              </div>
            </div>
          </div>
        )}
        {tab==="risks"&&(
          <div>
            {result.risk_flags.length===0?(
              <div style={{textAlign:"center",padding:"60px 20px"}}>
                <div style={{fontSize:48,marginBottom:12}}>✓</div>
                <div style={{color:C.green,fontWeight:700,fontSize:16}}>No risk flags</div>
                <div style={{color:C.muted,fontSize:13,marginTop:6}}>Drawing looks clean</div>
              </div>
            ):result.risk_flags.map((flag,i)=>(
              <div key={i} style={{background:C.card,border:`1px solid ${flag.level==="high"?`${C.red}55`:flag.level==="medium"?`${C.amber}55`:C.border}`,borderRadius:14,padding:"16px 18px",marginBottom:10,animation:`slideIn .2s ease ${i*.05}s both`}}>
                <div style={{display:"flex",alignItems:"center",gap:8,marginBottom:8}}>
                  <div style={{fontSize:10,fontWeight:700,padding:"3px 8px",borderRadius:6,background:flag.level==="high"?`${C.red}22`:flag.level==="medium"?`${C.amber}22`:`${C.blue}22`,color:flag.level==="high"?C.red:flag.level==="medium"?C.amber:C.blueLt,letterSpacing:"0.06em"}}>{flag.level.toUpperCase()}</div>
                  <div style={{fontSize:13,fontWeight:700,color:C.text}}>{LABELS[flag.component_type]??flag.component_type}</div>
                </div>
                <div style={{fontSize:13,color:C.muted,lineHeight:1.6}}>{flag.description}</div>
              </div>
            ))}
          </div>
        )}
        <div style={{height:20}}/>
      </div>

      {/* Bottom tab bar */}
      <div style={{position:"fixed",bottom:0,left:0,right:0,zIndex:100,background:C.navy,borderTop:`1px solid ${C.border}`,display:"flex",padding:"0 12px 0"}}>
        <button onClick={()=>setTab("schedule")} style={{flex:1,background:"none",border:"none",padding:"12px 0",cursor:"pointer",display:"flex",flexDirection:"column",alignItems:"center",gap:3}}>
          <div style={{fontSize:20}}>📋</div>
          <div style={{fontSize:11,fontWeight:600,color:tab==="schedule"?C.blue:C.muted}}>Schedule</div>
          {tab==="schedule"&&<div style={{width:20,height:2,background:C.blue,borderRadius:1}}/>}
        </button>
        <button onClick={exportEstimate} style={{flex:1,background:"none",border:"none",padding:"6px 0",cursor:"pointer",display:"flex",flexDirection:"column",alignItems:"center",gap:3}}>
          <div style={{width:44,height:44,borderRadius:"50%",background:C.blue,display:"flex",alignItems:"center",justifyContent:"center",fontSize:22,marginTop:-10,boxShadow:`0 4px 20px ${C.blue}66`}}>↑</div>
          <div style={{fontSize:11,fontWeight:600,color:C.blue}}>Export</div>
        </button>
        <button onClick={()=>setTab("risks")} style={{flex:1,background:"none",border:"none",padding:"12px 0",cursor:"pointer",display:"flex",flexDirection:"column",alignItems:"center",gap:3}}>
          <div style={{fontSize:20,position:"relative" as const}}>
            ⚠️
            {result.risk_flags.length>0&&<span style={{position:"absolute" as const,top:-4,right:-8,fontSize:9,fontWeight:700,background:C.red,color:"#fff",width:14,height:14,borderRadius:"50%",display:"flex",alignItems:"center",justifyContent:"center"}}>{result.risk_flags.length}</span>}
          </div>
          <div style={{fontSize:11,fontWeight:600,color:tab==="risks"?C.blue:C.muted}}>Risks</div>
          {tab==="risks"&&<div style={{width:20,height:2,background:C.blue,borderRadius:1}}/>}
        </button>
      </div>
    </div>
  );
}

export default function App() {
  const [screen,setScreen] = useState<Screen>("upload");
  const [file,setFile] = useState<File|null>(null);
  const [result,setResult] = useState<DetectionResult|null>(null);
  const [error,setError] = useState<string|null>(null);

  const handleFile = async (f:File) => {
    setFile(f);setError(null);setScreen("scanning");
    try {
      const d = await detectElectricalComponents(f,"001");
      setResult(d);setScreen("results");
    } catch(err:any) {
      setError(err?.message??"Detection failed. Please try again.");
      setScreen("upload");
    }
  };

  return (
    <>
      <style>{CSS}</style>
      {error&&<div style={{position:"fixed",top:0,left:0,right:0,zIndex:999,background:C.red,color:"#fff",padding:"14px 20px",fontSize:13,lineHeight:1.5}}><strong>Detection error</strong><br/>{error}</div>}
      {screen==="upload"&&<UploadScreen onFile={handleFile}/>}
      {screen==="scanning"&&file&&<ScanningScreen fileName={file.name}/>}
      {screen==="results"&&result&&file&&<ResultsScreen result={result} fileName={file.name} onReset={()=>{setScreen("upload");setFile(null);setResult(null);setError(null);}}/>}
    </>
  );
}
