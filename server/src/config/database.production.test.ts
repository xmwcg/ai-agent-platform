const ORIGINAL_ENV = { ...process.env };

type FakeRedis = {
  status: string;
  on: jest.Mock;
  connect: jest.Mock;
  ping: jest.Mock;
  quit: jest.Mock;
};

function productionEnv(overrides: Record<string, string | undefined> = {}) {
  process.env = {
    ...ORIGINAL_ENV,
    NODE_ENV: 'production',
    ENABLE_MOCK_MODE: 'false',
    MOCK_MODE: 'false',
    ...overrides,
  };
  for (const [key, value] of Object.entries(overrides)) {
    if (value === undefined) delete process.env[key];
  }
}

function loadDatabase(options: {
  mongoConnect?: jest.Mock;
  redis?: Partial<FakeRedis>;
} = {}) {
  const fakeRedis: FakeRedis = {
    status: 'wait',
    on: jest.fn(),
    connect: jest.fn().mockResolvedValue(undefined),
    ping: jest.fn().mockResolvedValue('PONG'),
    quit: jest.fn().mockResolvedValue('OK'),
    ...options.redis,
  };

  const RedisCtor = require('ioredis').default as jest.Mock;
  RedisCtor.mockImplementation(() => fakeRedis);

  const mongooseModule = require('mongoose');
  const mongoConnect = options.mongoConnect || jest.fn().mockResolvedValue(undefined);
  const connection = mongooseModule.connection || { on: jest.fn(), readyState: 1 };
  mongooseModule.connect.mockImplementation(mongoConnect);
  mongooseModule.default.connect.mockImplementation(mongoConnect);
  mongooseModule.default.connection = connection;

  const database = require('./database') as typeof import('./database');
  return { database, fakeRedis, mongoConnect, mongooseModule };
}

describe('production database startup gate', () => {
  beforeEach(() => {
    jest.resetModules();
    jest.clearAllMocks();
    productionEnv({
      MONGODB_URI: 'mongodb://db.example.internal:27017/aibak',
      REDIS_URL: 'rediss://redis.example.internal:6380',
    });
  });

  afterAll(() => {
    process.env = ORIGINAL_ENV;
  });

  it('rejects production startup when MONGODB_URI is missing', async () => {
    process.env.MONGODB_URI = '';
    const { database } = loadDatabase();

    await expect(database.connectMongoDB()).rejects.toThrow('MONGODB_URI');
  });

  it('rejects production startup when MongoDB connection fails', async () => {
    const mongoConnect = jest.fn().mockRejectedValue(new Error('mongo unavailable'));
    const { database } = loadDatabase({ mongoConnect });

    await expect(database.connectMongoDB()).rejects.toThrow('mongo unavailable');
    expect(mongoConnect).toHaveBeenCalledTimes(1);
  });

  it('rejects production startup when REDIS_URL is missing', async () => {
    process.env.REDIS_URL = '';
    const { database } = loadDatabase();

    await expect(database.connectRedis()).rejects.toThrow('REDIS_URL');
    expect(database.isUsingMemoryRedis()).toBe(false);
  });

  it('rejects Redis connection failures without switching to MemoryRedis', async () => {
    const { database, fakeRedis } = loadDatabase({
      redis: { connect: jest.fn().mockRejectedValue(new Error('redis unavailable')) },
    });

    await expect(database.connectRedis()).rejects.toThrow('redis unavailable');
    expect(fakeRedis.connect).toHaveBeenCalledTimes(1);
    expect(database.isUsingMemoryRedis()).toBe(false);
  });

  it('rejects an invalid Redis ping without switching to MemoryRedis', async () => {
    const { database, fakeRedis } = loadDatabase({
      redis: { ping: jest.fn().mockResolvedValue('NOT_PONG') },
    });

    await expect(database.connectRedis()).rejects.toThrow('unexpected Redis ping response');
    expect(fakeRedis.ping).toHaveBeenCalledTimes(1);
    expect(database.isUsingMemoryRedis()).toBe(false);
  });

  it('uses real MongoDB and Redis only after both probes succeed', async () => {
    const { database, fakeRedis, mongoConnect } = loadDatabase();

    const mongo = await database.connectMongoDB();
    const redis = await database.connectRedis();

    expect(mongoConnect).toHaveBeenCalledTimes(1);
    expect(mongo).toBeDefined();
    expect(redis).toBe(fakeRedis);
    expect(database.isUsingMemoryRedis()).toBe(false);
  });
});
