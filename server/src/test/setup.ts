/**
 * 测试基建（M7）
 *
 * 目标：在不依赖真实 MongoDB / Redis 的前提下，对路由层鉴权做集成回归测试。
 * - 固定 JWT_SECRET，使测试内可签发可被 requireAuth 校验的合法 Token。
 * - 用内存桩替掉 ioredis / mongoose，避免连接外部服务。
 * - enforceQuota 由具体测试文件按需再 mock（默认放行），从而能进入 handler 验证归属/参数校验。
 */
process.env.JWT_SECRET = process.env.JWT_SECRET || 'test-secret-do-not-use-in-prod';
process.env.NODE_ENV = 'test';
process.env.ENABLE_MOCK_MODE = 'true';

// 内存版 ioredis 桩（get/set/incrby/expire 全部 no-op）
const memoryRedis = {
  get: jest.fn().mockResolvedValue(null),
  set: jest.fn().mockResolvedValue('OK'),
  incrby: jest.fn().mockResolvedValue(1),
  expire: jest.fn().mockResolvedValue(1),
  del: jest.fn().mockResolvedValue(1),
  on: jest.fn(),
  quit: jest.fn().mockResolvedValue('OK'),
};
jest.mock('ioredis', () => {
  return {
    __esModule: true,
    default: jest.fn().mockImplementation(() => memoryRedis),
    Redis: jest.fn().mockImplementation(() => memoryRedis),
  };
});

// 说明：不全局 mock mongoose。
// 真实 mongoose 仅「编译 schema」(model()) 与「执行查询」时才触及数据库；
// 本测试套件的路由鉴权用例在 requireAuth 中间件即被拦截（401），
// 不会进入 handler 触发真实查询，因此无需替身。
// 既有 customer-service.test.ts 依赖真实模型 schema.paths，必须保留真实 mongoose。
// 仅对那些「确实会连接」的真实 connect 调用做保险（一般不被路由 import 触发）。
jest.mock('mongoose', () => {
  const actual = jest.requireActual('mongoose');
  return {
    __esModule: true,
    ...actual,
    connect: jest.fn().mockResolvedValue(undefined),
    default: { ...actual, connect: jest.fn().mockResolvedValue(undefined) },
  };
});

// 全局静音 console.error（路由里大量 console.error 会刷屏）
jest.spyOn(console, 'error').mockImplementation(() => {});
