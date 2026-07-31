/**
 * NexMind Flow 同步服务 — Platform 内封装 Python sync 引擎
 * 接入配额 + 计费体系，按套餐控制同步能力
 */

import { execFile } from 'child_process';
import { promisify } from 'util';
import path from 'path';
import { User } from '../models/User';
import { logger } from '../lib/logger';
import { resolveUserPlan } from '../middleware/subscription';
import type { PlanId } from '../config/billing';

const execAsync = promisify(execFile);

// Python 解释器路径（优先 venv，fallback 系统）
const PYTHON_PATH = process.env.NEXMIND_FLOW_PYTHON || 'python';
// NexMind Flow CLI 路径
const FLOW_CLI = process.env.NEXMIND_FLOW_CLI ||
  path.resolve(process.cwd(), '..', 'nexmind-flow', 'nexmind_flow', 'cli.py');
// 回退：直接调用模块
const FLOW_MODULE = 'nexmind_flow.cli';

export interface FlowSyncOptions {
  userId: string;
  sources: string[];
  project?: string;
  title?: string;
  summary?: string;
  tags?: string[];
  dryRun?: boolean;
}

export interface FlowSyncResult {
  success: boolean;
  status?: string;
  category?: string;
  project?: string;
  copied?: number;
  updated?: number;
  skipped?: number;
  index?: string;
  overview?: string;
  error?: string;
  quotaExceeded?: boolean;
}

/**
 * 获取用户 Flow 配额
 * 免费版：手动同步，每次消耗 1 次配额
 * 专业版：自动同步，不限额
 * 旗舰版：多库同步 + Webhook
 */
export async function getUserFlowQuota(userId: string): Promise<{
  plan: PlanId;
  canAutoSync: boolean;
  canMultiVault: boolean;
  dailyLimit: number;
}> {
  const { plan, expired } = await resolveUserPlan(userId);
  switch (plan) {
    case 'max':
    case 'team':
      return { plan, canAutoSync: true, canMultiVault: true, dailyLimit: 9999 };
    case 'pro':
      return { plan, canAutoSync: true, canMultiVault: false, dailyLimit: 200 };
    default: // free
      return { plan: 'free', canAutoSync: false, canMultiVault: false, dailyLimit: 5 };
  }
}


export function buildFlowCliArgs(opts: FlowSyncOptions): string[] {
  const args: string[] = ['-m', FLOW_MODULE];
  for (const src of opts.sources) {
    args.push('--source', src);
  }
  if (opts.project) args.push('--project', opts.project);
  if (opts.title) args.push('--title', opts.title);
  if (opts.summary) args.push('--summary', opts.summary);
  if (opts.tags && opts.tags.length > 0) args.push('--tags', opts.tags.join(','));
  if (opts.dryRun) args.push('--dry-run');
  return args;
}

/**
 * 执行 NexMind Flow 同步
 *
 * 调用 Python CLI → 将 AI 产出归档到 Obsidian vault
 */
export async function runFlowSync(opts: FlowSyncOptions): Promise<FlowSyncResult> {
  // 检查用户配额
  const quota = await getUserFlowQuota(opts.userId);

  // 检查日限额（免费版限制每日同步次数）
  const user = await User.findById(opts.userId).select('flowSyncCount flowSyncDate');
  if (!user) return { success: false, error: '用户不存在' };

  const today = new Date().toDateString();
  if ((user as any).flowSyncDate !== today) {
    (user as any).flowSyncCount = 0;
    (user as any).flowSyncDate = today;
  }

  if ((user as any).flowSyncCount >= quota.dailyLimit) {
    return {
      success: false,
      quotaExceeded: true,
      error: `日同步次数已达上限（${quota.plan} 套餐：${quota.dailyLimit} 次/天），请升级套餐`,
    };
  }

  // 构建 CLI 参数
  const args = buildFlowCliArgs(opts);

  try {
    const { stdout, stderr } = await execAsync(PYTHON_PATH, args, {
      timeout: 60000,
      maxBuffer: 1024 * 1024,
      env: { ...process.env, PYTHONIOENCODING: 'utf-8' },
    });

    if (stderr && !stderr.includes('SyntaxWarning')) {
      logger.warn('flow-sync', 'Python stderr', { stderr: stderr.slice(0, 500) });
    }

    // 解析 Python CLI 输出（JSON 格式）
    if (stdout.includes('SYNC_OK')) {
      try {
        const jsonStr = stdout.slice(stdout.indexOf('{'));
        const result = JSON.parse(jsonStr);

        // 扣减配额
        (user as any).flowSyncCount = ((user as any).flowSyncCount || 0) + 1;
        await user.save();

        return {
          success: true,
          status: 'SYNC_OK',
          category: result.category,
          project: result.project,
          copied: result.copied,
          updated: result.updated,
          skipped: result.skipped,
          index: result.index,
          overview: result.overview,
        };
      } catch {
        return { success: true, status: 'SYNC_OK', ...JSON.parse(stdout.replace('SYNC_OK ', '')) };
      }
    }

    if (stdout.includes('SYNC_DRY_RUN')) {
      const jsonStr = stdout.slice(stdout.indexOf('{'));
      return { success: true, ...JSON.parse(jsonStr), status: 'DRY_RUN' };
    }

    if (stdout.includes('SYNC_ERROR')) {
      return { success: false, error: stdout.trim() };
    }

    logger.error('flow-sync', 'Unexpected Python output', { stdout: stdout.slice(0, 200) });
    return { success: false, error: '同步引擎异常输出' };
  } catch (e: any) {
    logger.error('flow-sync', 'Python exec failed', { error: e.message });
    return { success: false, error: `同步引擎错误: ${e.message}` };
  }
}

export default { runFlowSync, getUserFlowQuota };
