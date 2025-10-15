import React, { useId, useRef, useState } from "react";
import { jsPDF } from "jspdf";
import html2canvas from "html2canvas";

/** ------------ Brand + Paper ------------- */
const BRAND = {
  primary: "#0D1B2A",
  accent:  "#00C2A8",
  line:    "#e2e8f0",
  paper:   "#ffffff",
};

/** ------------ Exact A4 + DPI controls ------------- */
const PAGE_MM    = { W: 210, H: 297 };       // A4 portrait
const EXPORT_DPI = 240;                      // 192–240 good; 300 = print-quality
const PX_PER_MM  = EXPORT_DPI / 25.4;
const PAGE_PX    = { W: Math.round(PX_PER_MM * PAGE_MM.W),
                     H: Math.round(PX_PER_MM * PAGE_MM.H) };

const defaultState = {
  brandName: "",
  tripTitle: "",
  travelers: "",
  dateRange: "",
  contact: { phone: "", email: "", website: "" },
  highlights: [""],            // start with one empty highlight input
  days: [
    {
      title: "",
      items: [
        { time: "", what: "", where: "", note: "" },  // one empty row to start
      ],
    },
  ],
  footerNotes: "",
};


/** Normalize modern colors (oklch etc.) → rgb() so html2canvas can parse */
function normalizeColorsForCanvas(root) {
  if (!root) return;
  const props = ["color","backgroundColor","borderColor","borderTopColor","borderRightColor","borderBottomColor","borderLeftColor","outlineColor"];
  const cnv = document.createElement("canvas");
  const ctx = cnv.getContext("2d");
  const toRgb = (v) => { try { ctx.fillStyle = v; return ctx.fillStyle; } catch { return null; } };
  (function walk(el){
    if (!(el instanceof Element)) return;
    const cs = getComputedStyle(el);
    props.forEach(p => { const rgb = toRgb(cs[p]); if (rgb && cs[p] !== rgb) el.style[p] = rgb; });
    [...el.children].forEach(walk);
  })(root);
}

export default function App() {
  const [data, setData] = useState(defaultState);
  const [activeDay, setActiveDay] = useState(0);
  const pdfRef = useRef(null);

  const updateField = (path, value) => {
    setData(prev => {
      const next = structuredClone(prev);
      const keys = path.split(".");
      let o = next;
      for (let i = 0; i < keys.length - 1; i++) o = o[keys[i]];
      o[keys.at(-1)] = value;
      return next;
    });
  };

  const addDay   = () => setData(p => ({ ...p, days: [...p.days, { title: `Day ${p.days.length + 1} • New Day`, items: [] }]}));
  const removeDay = (idx) => setData(p => ({ ...p, days: p.days.filter((_,i)=>i!==idx) }));
  const addItem  = (d) => setData(p => { const n=structuredClone(p); n.days[d].items.push({time:"",what:"",where:"",note:""}); return n;});
  const updateItem = (d,i,k,v)=> setData(p=>{const n=structuredClone(p); n.days[d].items[i][k]=v; return n;});
  const removeItem = (d,i)=> setData(p=>{const n=structuredClone(p); n.days[d].items.splice(i,1); return n;});

  /** Exact A4 export (single page if content fits; multi-page if taller) */
  const generatePDF = async () => {
    const node = pdfRef.current;
    if (!node) return;

    // Force preview node to exact A4 pixel size for a perfect 1:1 capture
    const prevW = node.style.width, prevH = node.style.height;
    node.style.width  = `${PAGE_PX.W}px`;
    node.style.height = `${PAGE_PX.H}px`;

    let canvas;
    try {
      canvas = await html2canvas(node, {
        scale: 1,
        backgroundColor: BRAND.paper,
        useCORS: true,
        windowWidth: PAGE_PX.W,
        logging: false,
        onclone: (doc) => {
          try { normalizeColorsForCanvas(doc.getElementById("pdf-root")); } catch {}
        },
      });
    } catch {
      canvas = await html2canvas(node, {
        scale: 1,
        backgroundColor: BRAND.paper,
        useCORS: true,
        windowWidth: PAGE_PX.W,
        foreignObjectRendering: true,
        logging: false,
      });
    } finally {
      node.style.width  = prevW;
      node.style.height = prevH;
    }

    const img = canvas.toDataURL("image/png");
    const pdf = new jsPDF({ orientation: "p", unit: "mm", format: [PAGE_MM.W, PAGE_MM.H] });

    // Because our capture node is exactly A4 aspect (PAGE_PX.W × PAGE_PX.H),
    // we can place it EXACTLY to the page bounds: no undersize, no extra margins.
    pdf.addImage(img, "PNG", 0, 0, PAGE_MM.W, PAGE_MM.H, undefined, "FAST");
    pdf.save(`${data.tripTitle.replace(/\s+/g, "_")}_Itinerary.pdf`);
  };

  return (
    <div className="min-h-screen bg-slate-50 text-slate-900">
      {/* Top Bar */}
      <header className="sticky top-0 z-10 bg-white/80 backdrop-blur border-b border-slate-200">
        <div className="max-w-7xl mx-auto px-4 py-3 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-xl" style={{ background: BRAND.accent }} />
            <span className="font-bold tracking-wider" style={{ color: BRAND.primary }}>{data.brandName}</span>
          </div>
          <button onClick={generatePDF} className="px-4 py-2 rounded-xl bg-slate-900 text-white hover:opacity-90">
            Get Itinerary
          </button>
        </div>
      </header>

      <main className="max-w-7xl mx-auto p-4 grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* LEFT: Form */}
        <section className="bg-white rounded-2xl shadow-sm p-4 lg:p-6 border border-slate-200">
          <h2 className="text-lg font-semibold mb-4">Trip Details</h2>
          <div className="grid md:grid-cols-2 gap-3">
            <Field label="Brand Name" name="brandName" value={data.brandName} onChange={(v)=>updateField("brandName",v)} />
            <Field label="Trip Title" name="tripTitle" value={data.tripTitle} onChange={(v)=>updateField("tripTitle",v)} />
            <Field label="Travelers" name="travelers" value={data.travelers} onChange={(v)=>updateField("travelers",v)} />
            <Field label="Date Range" name="dateRange" value={data.dateRange} onChange={(v)=>updateField("dateRange",v)} />
          </div>

          <div className="mt-6 grid md:grid-cols-3 gap-3">
            <Field label="Phone" name="phone" value={data.contact.phone} onChange={(v)=>updateField("contact.phone",v)} />
            <Field label="Email" name="email" value={data.contact.email} onChange={(v)=>updateField("contact.email",v)} />
            <Field label="Website" name="website" value={data.contact.website} onChange={(v)=>updateField("contact.website",v)} />
          </div>

          <h3 className="mt-6 text-base font-semibold">Highlights</h3>
          <ul className="mt-2 space-y-2">
            {data.highlights.map((h, i) => (
              <li key={i} className="grid grid-cols-12 gap-2 items-center">
                <Field
                  className="col-span-11"
                  label={`Highlight ${i + 1}`}
                  name={`highlight_${i}`}
                  value={h}
                  onChange={(v)=>{
                    setData(prev=>{ const n=structuredClone(prev); n.highlights[i]=v; return n; });
                  }}
                />
                <button
                  onClick={()=>setData(prev=>({...prev, highlights: prev.highlights.filter((_,k)=>k!==i)}))}
                  className="col-span-1 px-3 py-2 rounded-xl border border-slate-300 hover:bg-slate-50"
                  aria-label={`Remove highlight ${i+1}`}
                >−</button>
              </li>
            ))}
            <button
              onClick={()=>setData(prev=>({...prev, highlights:[...prev.highlights, ""]}))}
              className="px-3 py-2 rounded-xl border border-slate-300 hover:bg-slate-50"
            >+ Add highlight</button>
          </ul>

          <div className="mt-8 border-t border-slate-200 pt-6">
            <div className="flex items-center justify-between mb-3">
              <h3 className="text-base font-semibold">Day-wise Plan</h3>
              <div className="flex items-center gap-2">
                <button onClick={addDay} className="px-3 py-2 rounded-xl border border-slate-300 hover:bg-slate-50">+ Add day</button>
                {data.days.length > 0 && (
                  <button onClick={()=>removeDay(activeDay)} className="px-3 py-2 rounded-xl border border-rose-300 text-rose-600 hover:bg-rose-50">Remove day</button>
                )}
              </div>
            </div>

            <div className="flex flex-wrap gap-2 mb-4">
              {data.days.map((d, i) => (
                <button key={i} onClick={()=>setActiveDay(i)}
                  className={`px-3 py-1.5 rounded-full border ${i===activeDay?"bg-slate-900 text-white border-slate-900":"border-slate-300 hover:bg-slate-50"}`}>
                  {d.title.split("•")[0] || `Day ${i+1}`}
                </button>
              ))}
            </div>

            {data.days[activeDay] && (
              <div className="space-y-3">
                <Field
                  label="Section Title"
                  name={`day_${activeDay}_title`}
                  value={data.days[activeDay].title}
                  onChange={(v)=>setData(p=>{const n=structuredClone(p); n.days[activeDay].title=v; return n;})}
                />

                <div className="space-y-2">
                  {data.days[activeDay].items.map((it, j) => (
                    <div key={j} className="grid md:grid-cols-12 gap-2 items-start">
                      <Field className="md:col-span-2"  label="Time"  name={`d${activeDay}_i${j}_time`}  value={it.time}  onChange={(v)=>updateItem(activeDay,j,"time",v)} />
                      <Field className="md:col-span-4"  label="What"  name={`d${activeDay}_i${j}_what`}  value={it.what}  onChange={(v)=>updateItem(activeDay,j,"what",v)} />
                      <Field className="md:col-span-3"  label="Where" name={`d${activeDay}_i${j}_where`} value={it.where} onChange={(v)=>updateItem(activeDay,j,"where",v)} />
                      <Field className="md:col-span-2"  label="Note"  name={`d${activeDay}_i${j}_note`}  value={it.note}  onChange={(v)=>updateItem(activeDay,j,"note",v)} />
                      <button onClick={()=>removeItem(activeDay,j)} className="md:col-span-1 px-3 py-2 rounded-xl border border-rose-300 text-rose-600 hover:bg-rose-50" aria-label={`Remove item ${j+1}`}>−</button>
                    </div>
                  ))}
                  <button onClick={()=>addItem(activeDay)} className="px-3 py-2 rounded-xl border border-slate-300 hover:bg-slate-50">+ Add item</button>
                </div>
              </div>
            )}
          </div>
        </section>

        {/* RIGHT: A4-locked Preview (export target) */}
        <section className="bg-white rounded-2xl shadow-sm p-0 border border-slate-200 overflow-hidden">
          <div
            ref={pdfRef}
            id="pdf-root"
            className="w-full bg-white"
            style={{ width: PAGE_PX.W, height: PAGE_PX.H }}
          >
            <div className="mx-auto w-full" style={{ width: PAGE_PX.W, height: PAGE_PX.H }}>
              {/* Header */}
              <div className="relative p-8" style={{ background: BRAND.primary, color: "white" }}>
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-xl" style={{ background: BRAND.accent }} />
                    <div className="leading-tight">
                      <div className="text-sm tracking-widest opacity-80">TRAVEL ITINERARY</div>
                      <div className="text-2xl font-bold">{data.tripTitle}</div>
                    </div>
                  </div>
                  <div className="text-right text-sm opacity-90">
                    <div>{data.travelers}</div>
                    <div>{data.dateRange}</div>
                  </div>
                </div>
              </div>

              {/* Summary Strip */}
              <div className="grid grid-cols-3 gap-4 p-6 border-b" style={{ borderColor: BRAND.line }}>
                <Summary label="Contact"    value={`${data.contact.phone} • ${data.contact.email}`} />
                <Summary label="Website"    value={data.contact.website} />
                <Summary label="Highlights" value={data.highlights.filter(Boolean).join(" • ") || "—"} />
              </div>

              {/* Days */}
              <div className="p-6 space-y-8">
                {data.days.map((d, i) => (
                  <div key={i}>
                    <h3 className="text-lg font-semibold mb-3" style={{ color: BRAND.primary }}>{d.title}</h3>
                    <div className="overflow-hidden rounded-xl border" style={{ borderColor: BRAND.line }}>
                      <div className="grid grid-cols-12 bg-slate-50 text-slate-600 text-xs font-medium">
                        <div className="col-span-2 py-2 pl-4">TIME</div>
                        <div className="col-span-4 py-2">WHAT</div>
                        <div className="col-span-3 py-2">WHERE</div>
                        <div className="col-span-3 py-2 pr-4 text-right">NOTE</div>
                      </div>
                      {d.items.length === 0 && (<div className="p-4 text-sm text-slate-500">No items added yet.</div>)}
                      {d.items.map((it, j) => (
                        <div key={j} className="grid grid-cols-12 items-stretch border-t text-sm" style={{ borderColor: BRAND.line }}>
                          <div className="col-span-2 py-2 pl-4 font-medium text-slate-700">{it.time  || "—"}</div>
                          <div className="col-span-4 py-2">{it.what  || "—"}</div>
                          <div className="col-span-3 py-2 text-slate-600">{it.where || "—"}</div>
                          <div className="col-span-3 py-2 pr-4 text-right text-slate-500">{it.note || ""}</div>
                        </div>
                      ))}
                    </div>
                  </div>
                ))}
              </div>

              {/* Footer Notes */}
              <div className="px-6 pb-8">
                <div className="rounded-xl border p-4 text-xs leading-relaxed text-slate-600" style={{ borderColor: BRAND.line }}>
                  {data.footerNotes}
                </div>
              </div>

              <div className="h-3" style={{ background: BRAND.accent }} />
            </div>
          </div>
        </section>
      </main>

      <footer className="max-w-7xl mx-auto p-4 text-xs text-slate-500">
        <div>Exact A4 export is enabled. Increase EXPORT_DPI to 300 for print.</div>
      </footer>
    </div>
  );
}

/* ---------- Accessible inputs (id + name + label) ---------- */

function Field({ label, name, value, onChange, placeholder, className }) {
  const autoId = useId();
  const id = `${name || labelToId(label)}_${autoId}`;
  return (
    <div className={className}>
      <label htmlFor={id} className="block">
        <div className="text-xs font-medium text-slate-600 mb-1">{label}</div>
        <input
          id={id}
          name={name || id}
          value={value}
          onChange={(e)=>onChange(e.target.value)}
          placeholder={placeholder}
          autoComplete="off"
          className="w-full rounded-xl border border-slate-300 px-3 py-2 focus:outline-none focus:ring-2 focus:ring-slate-900/10"
        />
      </label>
    </div>
  );
}

function Summary({ label, value }) {
  return (
    <div>
      <div className="text-xs text-slate-500">{label}</div>
      <div className="text-sm font-medium text-slate-800">{value}</div>
    </div>
  );
}

function labelToId(s) {
  return String(s || "field").toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, "");
}
