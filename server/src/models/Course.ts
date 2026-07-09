import mongoose, { Schema, Document } from 'mongoose';

// 课程接口
export interface ICourse extends Document {
  title: string;
  description: string;
  instructor: string;
  level: 'beginner' | 'intermediate' | 'advanced';
  category: string;
  tags: string[];
  thumbnail?: string;
  price: number;
  isPublished: boolean;
  chapters: IChapter[];
  enrolledStudents: number;
  rating: number;
  createdAt: Date;
  updatedAt: Date;
}

// 章节接口
export interface IChapter {
  title: string;
  description: string;
  order: number;
  duration: number; // 分钟
  videoUrl?: string;
  content?: string; // Markdown 内容
  resources?: IResource[];
  quiz?: IQuiz; // 随堂测验
}

// 资源接口
export interface IResource {
  title: string;
  type: 'pdf' | 'code' | 'link' | 'file';
  url: string;
}

// 测验接口
export interface IQuiz {
  title: string;
  description: string;
  questions: IQuestion[];
  timeLimit?: number; // 分钟
  passingScore: number; // 及格分
}

// 问题接口
export interface IQuestion {
  type: 'single' | 'multiple' | 'truefalse' | 'fillblank' | 'code';
  question: string;
  options?: string[]; // 选择题选项
  correctAnswer: any; // 正确答案
  explanation?: string; // 解析
  points: number; // 分值
}

// 课程 Schema
const CourseSchema = new Schema<ICourse>(
  {
    title: {
      type: String,
      required: [true, 'Title is required'],
      trim: true,
      maxlength: [200, 'Title cannot exceed 200 characters']
    },
    description: {
      type: String,
      required: [true, 'Description is required']
    },
    instructor: {
      type: String, // 简化为 String
      required: true
    },
    level: {
      type: String,
      enum: ['beginner', 'intermediate', 'advanced'],
      default: 'beginner'
    },
    category: {
      type: String,
      required: true
    },
    tags: [
      {
        type: String,
        trim: true
      }
    ],
    thumbnail: String,
    price: {
      type: Number,
      default: 0,
      min: [0, 'Price cannot be negative']
    },
    isPublished: {
      type: Boolean,
      default: false
    },
    chapters: [
      {
        title: String,
        description: String,
        order: Number,
        duration: Number,
        videoUrl: String,
        content: String,
        resources: [
          {
            title: String,
            type: String,
            url: String
          }
        ],
        quiz: {
          title: String,
          description: String,
          questions: [
            {
              type: String,
              question: String,
              options: [String],
              correctAnswer: Schema.Types.Mixed,
              explanation: String,
              points: Number
            }
          ],
          timeLimit: Number,
          passingScore: Number
        }
      }
    ],
    enrolledStudents: {
      type: Number,
      default: 0
    },
    rating: {
      type: Number,
      default: 0,
      min: 0,
      max: 5
    }
  },
  {
    timestamps: true
  }
);

// 索引
CourseSchema.index({ title: 'text', description: 'text' });
CourseSchema.index({ category: 1 });
CourseSchema.index({ tags: 1 });
CourseSchema.index({ level: 1 });
CourseSchema.index({ price: 1 });
CourseSchema.index({ isPublished: 1 });

// 虚拟字段：总时长
CourseSchema.virtual('totalDuration').get(function (this: ICourse) {
  return this.chapters.reduce((total, chapter) => total + chapter.duration, 0);
});

// 虚拟字段：章节数
CourseSchema.virtual('chapterCount').get(function (this: ICourse) {
  return this.chapters.length;
});

export const Course = mongoose.model<ICourse>('Course', CourseSchema);
