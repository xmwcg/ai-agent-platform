"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
Object.defineProperty(exports, "__esModule", { value: true });
exports.Course = void 0;
const mongoose_1 = __importStar(require("mongoose"));
// 课程 Schema
const CourseSchema = new mongoose_1.Schema({
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
                        correctAnswer: mongoose_1.Schema.Types.Mixed,
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
}, {
    timestamps: true
});
// 索引
CourseSchema.index({ title: 'text', description: 'text' });
CourseSchema.index({ category: 1 });
CourseSchema.index({ tags: 1 });
CourseSchema.index({ level: 1 });
CourseSchema.index({ price: 1 });
CourseSchema.index({ isPublished: 1 });
// 虚拟字段：总时长
CourseSchema.virtual('totalDuration').get(function () {
    return this.chapters.reduce((total, chapter) => total + chapter.duration, 0);
});
// 虚拟字段：章节数
CourseSchema.virtual('chapterCount').get(function () {
    return this.chapters.length;
});
exports.Course = mongoose_1.default.model('Course', CourseSchema);
//# sourceMappingURL=Course.js.map