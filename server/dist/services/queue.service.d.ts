import { EventEmitter } from 'events';
export interface Job<T = any> {
    id: string;
    name: string;
    data: T;
    status: 'queued' | 'processing' | 'completed' | 'failed';
    progress: number;
    result?: any;
    error?: string;
    attempts: number;
    maxRetries: number;
    createdAt: number;
    startedAt?: number;
    completedAt?: number;
}
export interface JobHandler<T = any> {
    (data: T, job: Job<T>): Promise<any>;
}
export declare class JobQueue {
    name: string;
    private queueKey;
    constructor(name: string);
    /** 提交任务到队列，返回 jobId */
    add<T = any>(jobName: string, data: T, options?: {
        maxRetries?: number;
    }): Promise<string>;
    /** 获取任务详情 */
    getJob(id: string): Promise<Job | null>;
    /** 获取队列长度 */
    length(): Promise<number>;
    /** 清空队列 */
    clear(): Promise<void>;
}
export interface WorkerOptions {
    /** 最多同时处理的任务数 */
    concurrency?: number;
    /** 轮询超时（秒），BRPOP 阻塞等待 */
    pollTimeout?: number;
}
export declare class JobWorker extends EventEmitter {
    private queue;
    private handlers;
    private running;
    private concurrency;
    private pollTimeout;
    private activeJobs;
    constructor(queue: JobQueue, options?: WorkerOptions);
    /** 注册任务处理器 */
    register(name: string, handler: JobHandler): this;
    /** 启动 Worker */
    start(): Promise<void>;
    /** 停止 Worker */
    stop(): Promise<void>;
    /** 核心消费循环 */
    private consume;
    /** 处理单个任务 */
    private processJob;
    private failJob;
    private saveJob;
    private sleep;
}
export declare const mediaQueue: JobQueue;
export declare const mediaWorker: JobWorker;
//# sourceMappingURL=queue.service.d.ts.map