import { ISlideStyle, BUILTIN_STYLES } from "../models/slide.models";
import { callAI } from "./ai.service";
import fs from "fs";
import path from "path";
import { exec } from "child_process";
import { promisify } from "util";
const execAsync = promisify(exec);

export interface PagePlan {
  pageNumber: number; role: "cover"|"chapter"|"content"|"ending";
  conclusionTitle: string; subtitle?: string; content: string;
  keyNumbers?: Array<{label:string;value:string;unit?:string}>;
  evidenceIds: string[]; soWhat: string; chartType: string;
  densityLevel: "high"|"medium"|"low"; notes?: string;
}

const PPTX_DIR = path.join(__dirname, "..", "..", "exports", "slides");

const ANALYSIS_PROMPT = `你是 MBB 管理咨询顾问。分析源材料，输出 JSON：
{ "evidenceTable": [{"evidenceId":"E01","claim":"...","value":"...","source":"...","confidence":"high|medium|low","implication":"...","recommendedVisual":"bar|line|pie|table"}],
  "storyline": {"situation":"","complication":"","resolution":"","keyArguments":[]},
  "pagePlans": [{"pageNumber":1,"role":"cover|content|chapter|ending","conclusionTitle":"...","content":"...","evidenceIds":[],"soWhat":"...","chartType":"none|bar|line|table","densityLevel":"medium"}],
  "recommendedStyle":"cyber-04" }`;

export async function analyzeSource(sourceText: string, targetPages?: number) {
  const truncated = sourceText.length > 12000 ? sourceText.substring(0, 12000) + "\n[截断，共" + sourceText.length + "字符]" : sourceText;
  const hint = targetPages ? "\n用户期望" + targetPages + "页。" : "\n自动判断合理页数(8-20页)。";
  const result = await callAI({ system: ANALYSIS_PROMPT, user: "分析以下材料。" + hint + "\n---\n" + truncated, temperature: 0.3, maxTokens: 16000 });
  const m = result.content.match(/\{[\s\S]*\}/);
  if (!m) throw new Error("AI分析失败：无法解析JSON");
  const d = JSON.parse(m[0]);
  return { analysis: { evidenceTable: d.evidenceTable||[], dataConflicts:[], dataGaps:[], storyline: d.storyline||{situation:"",complication:"",resolution:"",keyArguments:[],alternativeStorylines:[]}, materialsPool:{keyNumbers:[],comparisons:[],rankings:[],trends:[]} }, pagePlans: d.pagePlans||[], recommendedStyle: d.recommendedStyle||"cyber-04" };
}

export async function generatePPTX(projectId: string, pages: PagePlan[], style: ISlideStyle, sourceText: string, mode: "quick"|"professional") {
  if (!fs.existsSync(PPTX_DIR)) fs.mkdirSync(PPTX_DIR, { recursive: true });
  const dir = path.join(PPTX_DIR, projectId);
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(path.join(dir, "slide_content_lock.json"), JSON.stringify({ projectId, style:{styleId:style.styleId,name:style.name,colors:{primary:style.primaryColor,accent:style.accentColor,background:style.backgroundColor,text:style.textColor}}, pages, mode }, null, 2), "utf-8");

  const svgDir = path.join(dir, "svg_output");
  if (!fs.existsSync(svgDir)) fs.mkdirSync(svgDir, { recursive: true });
  for (const page of pages) {
    const svg = genSVG(page, style);
    fs.writeFileSync(path.join(svgDir, "slide_" + String(page.pageNumber).padStart(2,"0") + ".svg"), svg, "utf-8");
  }

  const pptxPath = path.join(dir, "deck.pptx");
  try {
    await generatePythonPPTX(pptxPath, pages, style, dir);
  } catch {
    generateOOXML(pptxPath, pages);
  }

  return { pptxPath, qaResult: runQA(pptxPath, pages, mode) };
}

function runQA(pptxPath: string, pages: PagePlan[], mode: string) {
  const g: Record<string,{passed:boolean;message:string}> = {};
  const missingEvidence = pages.filter(p => p.role==="content" && (!p.evidenceIds||p.evidenceIds.length===0)).length;
  g.evidence_gate = { passed: mode==="quick" || missingEvidence===0, message: missingEvidence>0?missingEvidence+"页缺证据":"通过" };
  const missingSoWhat = pages.filter(p => p.role==="content" && !p.soWhat).length;
  g.density_gate = { passed: mode==="quick" || missingSoWhat===0, message: missingSoWhat>0?missingSoWhat+"页缺SO WHAT":"通过" };
  const exists = fs.existsSync(pptxPath);
  g.output_gate = { passed: exists, message: exists?(fs.statSync(pptxPath).size/1024).toFixed(1)+"KB":"不存在" };
  const entries = Object.entries(g); const passed = entries.filter(([,v])=>v.passed).length;
  return { passed: ["output_gate","density_gate"].every(k=>g[k]?.passed), gates: g, totalGates: entries.length, passedGates: passed, score: Math.round(passed/entries.length*100) };
}

function genSVG(page: PagePlan, style: ISlideStyle): string {
  const W=1280,H=720,M=60,ty=M+45,cy=page.subtitle?ty+80:ty+60,sy=H-M-20;
  const e=(s:string)=>s.replace(/&/g,"&amp;").replace(/</g,"&lt;").replace(/>/g,"&gt;");
  let svg = '<?xml version="1.0"?><svg xmlns="http://www.w3.org/2000/svg" width="'+W+'" height="'+H+'">';
  svg += '<rect width="'+W+'" height="'+H+'" fill="'+style.backgroundColor+'"/>';
  svg += '<rect x="'+M+'" y="'+M+'" width="'+(W-M*2)+'" height="3" fill="'+style.accentColor+'"/>';
  svg += '<text x="'+M+'" y="'+(M+22)+'" font-size="14" fill="'+style.secondaryTextColor+'">'+String(page.pageNumber).padStart(2,"0")+'</text>';
  svg += '<text x="'+M+'" y="'+ty+'" font-size="28" font-weight="bold" fill="'+style.textColor+'">'+e(page.conclusionTitle)+'</text>';
  if(page.subtitle) svg += '<text x="'+M+'" y="'+(ty+50)+'" font-size="14" fill="'+style.secondaryTextColor+'">'+e(page.subtitle)+'</text>';
  svg += '<foreignObject x="'+M+'" y="'+cy+'" width="'+(W-M*2)+'" height="'+(H-cy-100)+'"><div xmlns="http://www.w3.org/1999/xhtml" style="font-size:16px;color:'+style.textColor+';line-height:1.8">'+(page.content||"").replace(/\n/g,"<br/>")+'</div></foreignObject>';
  if(page.soWhat){ svg += '<rect x="'+M+'" y="'+(sy-30)+'" width="'+(W-M*2)+'" height="50" fill="'+style.accentColor+'" opacity="0.1"/>'; svg += '<text x="'+(M+10)+'" y="'+sy+'" font-size="12" font-weight="bold" fill="'+style.accentColor+'">SO WHAT</text>'; svg += '<text x="'+(M+100)+'" y="'+sy+'" font-size="13" fill="'+style.secondaryTextColor+'">'+e(page.soWhat||"")+'</text>'; }
  svg += '<line x1="'+M+'" y1="'+(H-M)+'" x2="'+(W-M)+'" y2="'+(H-M)+'" stroke="'+style.lineColor+'"/>';
  svg += '</svg>'; return svg;
}

async function generatePythonPPTX(pptxPath: string, pages: PagePlan[], style: ISlideStyle, dir: string) {
  const pd = JSON.stringify(pages.map(p=>({n:p.pageNumber,r:p.role,t:p.conclusionTitle,s:p.subtitle||"",c:(p.content||"").substring(0,500),w:p.soWhat||""})));
  const sd = JSON.stringify({p:style.primaryColor,a:style.accentColor,b:style.backgroundColor,t:style.textColor,s:style.secondaryTextColor});
  const script = `
import json,os,sys
pages=json.loads(r'${pd}')
style=json.loads(r'${sd}')
try:
 from pptx import Presentation;from pptx.util import Inches,Pt;from pptx.dml.color import RGBColor
 prs=Presentation();prs.slide_width=Inches(13.333);prs.slide_height=Inches(7.5)
 bl=prs.slide_layouts[6]
 def h2r(h):h=h.lstrip("#");return tuple(int(h[i:i+2],16)for i in(0,2,4))
 for p in pages:
  s=prs.slides.add_slide(bl)
  s.background.fill.solid();s.background.fill.fore_color.rgb=RGBColor(*h2r(style["b"]))
  ln=s.shapes.add_shape(1,Inches(0.6),Inches(0.6),Inches(11.133),Inches(0.04));ln.fill.solid();ln.fill.fore_color.rgb=RGBColor(*h2r(style["a"]));ln.line.fill.background()
  tb=s.shapes.add_textbox(Inches(0.6),Inches(1.2),Inches(12),Inches(0.7));tf=tb.text_frame;tf.text=p["t"];tf.paragraphs[0].font.size=Pt(28);tf.paragraphs[0].font.bold=True;tf.paragraphs[0].font.color.rgb=RGBColor(*h2r(style["t"]))
  if p["c"]:
   tb=s.shapes.add_textbox(Inches(0.6),Inches(2.5),Inches(12),Inches(3.5));tf=tb.text_frame;tf.word_wrap=True;tf.text=p["c"];tf.paragraphs[0].font.size=Pt(16);tf.paragraphs[0].font.color.rgb=RGBColor(*h2r(style["t"]))
  if p["w"]:
   tb=s.shapes.add_textbox(Inches(0.6),Inches(6.5),Inches(12),Inches(0.5));tf=tb.text_frame;tf.text="SO WHAT: "+p["w"];tf.paragraphs[0].font.size=Pt(13);tf.paragraphs[0].font.color.rgb=RGBColor(*h2r(style["a"]));tf.paragraphs[0].font.bold=True
 prs.save(r"${pptxPath.replace(/\\/g,"\\\\")}");print("PPTX_OK")
except ImportError:sys.exit(1)
`;
  const sp = path.join(dir, "_gen.py"); fs.writeFileSync(sp, script, "utf-8");
  try { const { stdout } = await execAsync('python3 "' + sp + '" 2>&1 || python "' + sp + '" 2>&1', { timeout: 60000 }); if (stdout.includes("PPTX_OK")) return; } catch {}
  fs.unlinkSync(sp);
  generateOOXML(pptxPath, pages);
}

function generateOOXML(pptxPath: string, pages: PagePlan[]) {
  const JSZip = require("jszip"); const zip = new JSZip();
  zip.file("[Content_Types].xml",'<?xml version="1.0"?><Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="xml" ContentType="application/xml"/><Override PartName="/ppt/presentation.xml" ContentType="application/vnd.openxmlformats-officedocument.presentationml.presentation.main+xml"/><Override PartName="/ppt/slideMasters/slideMaster1.xml" ContentType="application/vnd.openxmlformats-officedocument.presentationml.slideMaster+xml"/><Override PartName="/ppt/slideLayouts/slideLayout1.xml" ContentType="application/vnd.openxmlformats-officedocument.presentationml.slideLayout+xml"/></Types>');
  zip.file("_rels/.rels",'<?xml version="1.0"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="ppt/presentation.xml"/></Relationships>');
  let sids="",srels="";
  for(let i=0;i<pages.length;i++){const n=i+1;sids+='<p:sldId id="'+(256+i)+'" r:id="rId'+n+'"/>';srels+='<Relationship Id="rId'+n+'" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/slide" Target="slides/slide'+n+'.xml"/>';}
  zip.file("ppt/presentation.xml",'<?xml version="1.0"?><p:presentation xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships" xmlns:p="http://schemas.openxmlformats.org/presentationml/2006/main"><p:sldMasterIdLst><p:sldMasterId id="2147483648" r:id="rId1"/></p:sldMasterIdLst><p:sldIdLst>'+sids+'</p:sldIdLst><p:sldSz cx="12192000" cy="6858000"/></p:presentation>');
  zip.file("ppt/_rels/presentation.xml.rels",'<?xml version="1.0"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/slideMaster" Target="slideMasters/slideMaster1.xml"/>'+srels+'</Relationships>');
  zip.file("ppt/slideMasters/slideMaster1.xml",'<?xml version="1.0"?><p:sldMaster xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships" xmlns:p="http://schemas.openxmlformats.org/presentationml/2006/main"><p:cSld><p:spTree><p:nvGrpSpPr><p:cNvPr id="1" name=""/><p:cNvGrpSpPr/><p:nvPr/></p:nvGrpSpPr><p:grpSpPr/></p:spTree></p:cSld><p:sldLayoutIdLst><p:sldLayoutId id="2147483649" r:id="rId1"/></p:sldLayoutIdLst></p:sldMaster>');
  zip.file("ppt/slideMasters/_rels/slideMaster1.xml.rels",'<?xml version="1.0"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/slideLayout" Target="../slideLayouts/slideLayout1.xml"/></Relationships>');
  zip.file("ppt/slideLayouts/slideLayout1.xml",'<?xml version="1.0"?><p:sldLayout xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships" xmlns:p="http://schemas.openxmlformats.org/presentationml/2006/main" type="blank"><p:cSld><p:spTree><p:nvGrpSpPr><p:cNvPr id="1" name=""/><p:cNvGrpSpPr/><p:nvPr/></p:nvGrpSpPr><p:grpSpPr/></p:spTree></p:cSld></p:sldLayout>');
  for(let i=0;i<pages.length;i++){const n=i+1,p=pages[i];const t=p.conclusionTitle.replace(/&/g,"&amp;").replace(/</g,"&lt;").replace(/"/g,"&quot;");const c=(p.content||"").substring(0,200).replace(/&/g,"&amp;").replace(/</g,"&lt;").replace(/"/g,"&quot;");zip.file("ppt/slides/slide"+n+".xml",'<?xml version="1.0"?><p:sld xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships" xmlns:p="http://schemas.openxmlformats.org/presentationml/2006/main"><p:cSld><p:spTree><p:nvGrpSpPr><p:cNvPr id="1" name=""/><p:cNvGrpSpPr/><p:nvPr/></p:nvGrpSpPr><p:grpSpPr/><p:sp><p:nvSpPr><p:cNvPr id="2" name="Title"/><p:cNvSpPr><a:spLocks noGrp="1"/></p:cNvSpPr><p:nvPr/></p:nvSpPr><p:spPr><a:xfrm><a:off x="685800" y="274320"/><a:ext cx="10820400" cy="914400"/></a:xfrm></p:spPr><p:txBody><a:bodyPr/><a:lstStyle/><a:p><a:r><a:rPr lang="zh-CN" sz="2800" b="1"/><a:t>'+t+'</a:t></a:r></a:p></p:txBody></p:sp><p:sp><p:nvSpPr><p:cNvPr id="3" name="Content"/><p:cNvSpPr><a:spLocks noGrp="1"/></p:cNvSpPr><p:nvPr/></p:nvSpPr><p:spPr><a:xfrm><a:off x="685800" y="1828800"/><a:ext cx="10820400" cy="4114800"/></a:xfrm></p:spPr><p:txBody><a:bodyPr wrap="square"/><a:lstStyle/><a:p><a:r><a:rPr lang="zh-CN" sz="1600"/><a:t>'+c+'</a:t></a:r></a:p></p:txBody></p:sp></p:spTree></p:cSld></p:sld>');zip.file("ppt/slides/_rels/slide"+n+".xml.rels",'<?xml version="1.0"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/slideLayout" Target="../slideLayouts/slideLayout1.xml"/></Relationships>');}
  const outDir = path.dirname(pptxPath);
  if (!fs.existsSync(outDir)) fs.mkdirSync(outDir, { recursive: true });
  zip.generateNodeStream({ type: "nodebuffer", streamFiles: true }).pipe(fs.createWriteStream(pptxPath));
}

export function getBuiltinStyles() { return BUILTIN_STYLES; }
export function getStyleById(id: string) { return BUILTIN_STYLES.find(s=>s.styleId===id); }
export function getStylesByCategory(cat: string) { return BUILTIN_STYLES.filter(s=>s.category===cat); }
export function getStyleCategories() { return ["consulting","business","academic","government","creative"].map(k=>({key:k,label:({consulting:"咨询风格",business:"商务风格",academic:"学术风格",government:"政务风格",creative:"创意风格"})[k]||k,count:BUILTIN_STYLES.filter(s=>s.category===k).length})); }
