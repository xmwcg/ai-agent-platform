declare const router: import("express-serve-static-core").Router;
type Level = 'beginner' | 'intermediate' | 'advanced';
interface Milestone {
    week: number;
    title: string;
    description: string;
    courses: {
        id: string;
        title: string;
        completed?: boolean;
    }[];
    quiz?: {
        title: string;
        passed?: boolean;
    };
}
export interface LearningPath {
    id: string;
    title: string;
    description: string;
    targetLevel: Level;
    estimatedWeeks: number;
    milestones: Milestone[];
    generatedBy: 'ai' | 'template';
}
export declare function isLearningPathTemplateFallbackAllowed(env?: string): boolean;
export declare function generateLearningPathWithAI(input: {
    level: Level;
    goal?: string;
    interests?: string;
    courseList: {
        id: string;
        title: string;
        level: string;
        category: string;
    }[];
}): Promise<LearningPath>;
export default router;
//# sourceMappingURL=learning-path.d.ts.map