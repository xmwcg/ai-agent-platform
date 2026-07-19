import mongoose, { Document } from 'mongoose';
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
export interface IChapter {
    title: string;
    description: string;
    order: number;
    duration: number;
    videoUrl?: string;
    content?: string;
    resources?: IResource[];
    quiz?: IQuiz;
}
export interface IResource {
    title: string;
    type: 'pdf' | 'code' | 'link' | 'file';
    url: string;
}
export interface IQuiz {
    title: string;
    description: string;
    questions: IQuestion[];
    timeLimit?: number;
    passingScore: number;
}
export interface IQuestion {
    type: 'single' | 'multiple' | 'truefalse' | 'fillblank' | 'code';
    question: string;
    options?: string[];
    correctAnswer: any;
    explanation?: string;
    points: number;
}
export declare const Course: mongoose.Model<ICourse, {}, {}, {}, mongoose.Document<unknown, {}, ICourse, {}, {}> & ICourse & Required<{
    _id: mongoose.Types.ObjectId;
}> & {
    __v: number;
}, any>;
//# sourceMappingURL=Course.d.ts.map