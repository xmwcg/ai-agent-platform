import mongoose, { Schema, Document, Model } from "mongoose";

export interface ISlideStyle {
  styleId: string; name: string; primaryColor: string; accentColor: string;
  backgroundColor: string; textColor: string; secondaryTextColor: string;
  lineColor: string; fontFamily: string;
  category: "consulting"|"business"|"academic"|"government"|"creative";
  sampleImage?: string; suitableFor: string;
}

export const BUILTIN_STYLES: ISlideStyle[] = [
  { styleId:"cyber-01",name:"经典深红咨询风",primaryColor:"#8B1E1E",accentColor:"#8B1E1E",backgroundColor:"#F3F4EF",textColor:"#111111",secondaryTextColor:"#555555",lineColor:"#D6D6D2",fontFamily:"微软雅黑, Microsoft YaHei, sans-serif",category:"consulting",suitableFor:"战略分析、竞品研究、行业报告、商业计划"},
  { styleId:"cyber-02",name:"冷灰勃艮第红",primaryColor:"#7A1F2B",accentColor:"#7A1F2B",backgroundColor:"#F5F5F2",textColor:"#000000",secondaryTextColor:"#6B6B6B",lineColor:"#D9D9D6",fontFamily:"微软雅黑, Microsoft YaHei, sans-serif",category:"consulting",suitableFor:"财务分析、投研报告、风险评估"},
  { styleId:"cyber-03",name:"暖象牙白酒红",primaryColor:"#8A1538",accentColor:"#8A1538",backgroundColor:"#F4F1EA",textColor:"#121212",secondaryTextColor:"#77736C",lineColor:"#D8D3CA",fontFamily:"微软雅黑, Microsoft YaHei, sans-serif",category:"consulting",suitableFor:"品牌战略、消费品分析、电商研究"},
  { styleId:"cyber-04",name:"象牙白深蓝",primaryColor:"#12355B",accentColor:"#12355B",backgroundColor:"#F7F6F0",textColor:"#101820",secondaryTextColor:"#6F7275",lineColor:"#C9CDD1",fontFamily:"微软雅黑, Microsoft YaHei, sans-serif",category:"consulting",suitableFor:"科技、SaaS、B2B、企业数字化"},
  { styleId:"cyber-05",name:"浅灰白墨绿",primaryColor:"#1F5B4D",accentColor:"#1F5B4D",backgroundColor:"#F2F3EF",textColor:"#111111",secondaryTextColor:"#666666",lineColor:"#D7D9D3",fontFamily:"微软雅黑, Microsoft YaHei, sans-serif",category:"consulting",suitableFor:"可持续、海外市场、增长战略"},
  { styleId:"cyber-06",name:"纸张米色铜棕",primaryColor:"#9A5A2E",accentColor:"#9A5A2E",backgroundColor:"#F4F0E8",textColor:"#161616",secondaryTextColor:"#76716A",lineColor:"#B8B6B1",fontFamily:"微软雅黑, Microsoft YaHei, sans-serif",category:"consulting",suitableFor:"消费零售、奢侈品、商业模式"},
  { styleId:"cyber-07",name:"纯净浅灰黑金",primaryColor:"#A87932",accentColor:"#A87932",backgroundColor:"#F6F6F4",textColor:"#000000",secondaryTextColor:"#707070",lineColor:"#DADADA",fontFamily:"微软雅黑, Microsoft YaHei, sans-serif",category:"consulting",suitableFor:"高管汇报、融资材料、董事会"},
  { styleId:"cyber-08",name:"冷白灰深紫",primaryColor:"#4B2E83",accentColor:"#4B2E83",backgroundColor:"#F4F5F6",textColor:"#111111",secondaryTextColor:"#6D7175",lineColor:"#C8CCD0",fontFamily:"微软雅黑, Microsoft YaHei, sans-serif",category:"consulting",suitableFor:"AI、技术趋势、产品战略"},
  { styleId:"biz-01",name:"极简商务蓝",primaryColor:"#2563EB",accentColor:"#1D4ED8",backgroundColor:"#FFFFFF",textColor:"#1E293B",secondaryTextColor:"#64748B",lineColor:"#E2E8F0",fontFamily:"微软雅黑, Microsoft YaHei, sans-serif",category:"business",suitableFor:"商业汇报、产品发布、路演"},
  { styleId:"biz-02",name:"暗色仪表盘",primaryColor:"#38BDF8",accentColor:"#0EA5E9",backgroundColor:"#0F172A",textColor:"#F1F5F9",secondaryTextColor:"#94A3B8",lineColor:"#334155",fontFamily:"微软雅黑, Microsoft YaHei, sans-serif",category:"business",suitableFor:"数据报告、KPI展示、技术发布"},
  { styleId:"acd-01",name:"学术答辩风",primaryColor:"#1E40AF",accentColor:"#3B82F6",backgroundColor:"#F8FAFC",textColor:"#0F172A",secondaryTextColor:"#475569",lineColor:"#CBD5E1",fontFamily:"微软雅黑, 宋体, serif",category:"academic",suitableFor:"论文答辩、科研汇报、开题报告"},
  { styleId:"gov-01",name:"政务党建红",primaryColor:"#DC2626",accentColor:"#B91C1C",backgroundColor:"#FEF2F2",textColor:"#1F2937",secondaryTextColor:"#6B7280",lineColor:"#FECACA",fontFamily:"微软雅黑, 宋体, serif",category:"government",suitableFor:"党建汇报、政务报告、竞聘述职"},
  { styleId:"gov-02",name:"政务蓝",primaryColor:"#1E3A5F",accentColor:"#2563EB",backgroundColor:"#F0F4F8",textColor:"#1E293B",secondaryTextColor:"#64748B",lineColor:"#CBD5E1",fontFamily:"微软雅黑, 宋体, serif",category:"government",suitableFor:"政府工作报告、政策解读"},
  { styleId:"crt-01",name:"创意水彩风",primaryColor:"#8B5CF6",accentColor:"#A78BFA",backgroundColor:"#FAF5FF",textColor:"#2E1065",secondaryTextColor:"#7C3AED",lineColor:"#DDD6FE",fontFamily:"微软雅黑, Microsoft YaHei, sans-serif",category:"creative",suitableFor:"产品发布、品牌展示、创意提案"},
  { styleId:"crt-02",name:"科技霓虹风",primaryColor:"#06B6D4",accentColor:"#22D3EE",backgroundColor:"#0A0A0A",textColor:"#E2E8F0",secondaryTextColor:"#94A3B8",lineColor:"#1E293B",fontFamily:"微软雅黑, Microsoft YaHei, sans-serif",category:"creative",suitableFor:"科技发布、AI产品、黑客松"},
];

export interface ISlideProject extends Document {
  userId: mongoose.Types.ObjectId; title: string; status: string;
  sourceFiles: Array<{ originalName: string; storedPath: string; fileType: string; sizeBytes: number }>;
  sourceText: string; storyline?: Record<string,unknown>; selectedStyleId?: string;
  pages: Array<Record<string,unknown>>; pageCount: number; targetLanguage: string;
  generationMode: "quick"|"professional"; pptxPath?: string; errorMessage?: string;
  creditsUsed: number; createdAt: Date; updatedAt: Date;
}

const SlideProjectSchema = new Schema<ISlideProject>({
  userId:{type:Schema.Types.ObjectId,ref:"User",required:true,index:true},
  title:{type:String,default:"未命名PPT",maxlength:200},
  status:{type:String,enum:["uploaded","analyzing","outline_ready","style_selected","blueprint_ready","generating","completed","failed"],default:"uploaded",index:true},
  sourceFiles:[{originalName:String,storedPath:String,fileType:String,sizeBytes:Number}],
  sourceText:{type:String,default:""}, storyline:{type:Schema.Types.Mixed},
  selectedStyleId:String, pages:[{type:Schema.Types.Mixed}], pageCount:{type:Number,default:0},
  targetLanguage:{type:String,default:"zh-CN"},
  generationMode:{type:String,enum:["quick","professional"],default:"quick"},
  pptxPath:String, errorMessage:String, creditsUsed:{type:Number,default:0},
},{timestamps:true,toJSON:{virtuals:true},toObject:{virtuals:true}});
SlideProjectSchema.index({userId:1,updatedAt:-1}); SlideProjectSchema.index({userId:1,status:1});

export interface ISlideExport extends Document {
  projectId:mongoose.Types.ObjectId; userId:mongoose.Types.ObjectId;
  status:"pending"|"processing"|"completed"|"failed"; filePath?:string;
  fileSize?:number; qaResult?:Record<string,unknown>; errorMessage?:string;
  createdAt:Date; updatedAt:Date;
}
const SlideExportSchema = new Schema<ISlideExport>({
  projectId:{type:Schema.Types.ObjectId,ref:"SlideProject",required:true,index:true},
  userId:{type:Schema.Types.ObjectId,ref:"User",required:true},
  status:{type:String,enum:["pending","processing","completed","failed"],default:"pending"},
  filePath:String, fileSize:Number, qaResult:{type:Schema.Types.Mixed}, errorMessage:String,
},{timestamps:true});

export const SlideProject:Model<ISlideProject> = mongoose.models.SlideProject || mongoose.model<ISlideProject>("SlideProject",SlideProjectSchema);
export const SlideExport:Model<ISlideExport> = mongoose.models.SlideExport || mongoose.model<ISlideExport>("SlideExport",SlideExportSchema);
export { BUILTIN_STYLES as SlideStyles };
