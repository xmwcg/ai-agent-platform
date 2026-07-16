import type { Server } from 'http';
import { bootstrap, BootstrapDependencies } from './index';

const ORIGINAL_NODE_ENV = process.env.NODE_ENV;

function dependencySet(events: string[] = []): jest.Mocked<BootstrapDependencies> {
  const step = <T>(name: string, result: T) => jest.fn(async () => {
    events.push(name);
    return result;
  });

  return {
    validateEnv: jest.fn(() => { events.push('validate'); }),
    connectMongo: step('mongo', undefined),
    connectRedis: step('redis', undefined),
    loadMcp: step('mcp', undefined),
    reloadProviders: step('providers', undefined),
    startMediaWorker: step('worker', undefined),
    startHttpServer: jest.fn(() => {
      events.push('listen');
      return {} as Server;
    }),
  };
}

describe('bootstrap production startup order', () => {
  beforeEach(() => {
    process.env.NODE_ENV = 'production';
  });

  afterAll(() => {
    process.env.NODE_ENV = ORIGINAL_NODE_ENV;
  });

  it('does not connect or listen when environment validation fails', async () => {
    const dependencies = dependencySet();
    dependencies.validateEnv.mockImplementation(() => { throw new Error('invalid production env'); });

    await expect(bootstrap({ dependencies })).rejects.toThrow('invalid production env');
    expect(dependencies.connectMongo).not.toHaveBeenCalled();
    expect(dependencies.startHttpServer).not.toHaveBeenCalled();
  });

  it('does not start later services or listen when MongoDB fails', async () => {
    const dependencies = dependencySet();
    dependencies.connectMongo.mockRejectedValue(new Error('mongo down'));

    await expect(bootstrap({ dependencies })).rejects.toThrow('mongo down');
    expect(dependencies.connectRedis).not.toHaveBeenCalled();
    expect(dependencies.startHttpServer).not.toHaveBeenCalled();
  });

  it('does not start workers or listen when Redis fails', async () => {
    const dependencies = dependencySet();
    dependencies.connectRedis.mockRejectedValue(new Error('redis down'));

    await expect(bootstrap({ dependencies })).rejects.toThrow('redis down');
    expect(dependencies.loadMcp).not.toHaveBeenCalled();
    expect(dependencies.startHttpServer).not.toHaveBeenCalled();
  });

  it.each([
    ['MCP', 'loadMcp'],
    ['AI provider', 'reloadProviders'],
    ['media worker', 'startMediaWorker'],
  ] as const)('fails closed before listen when production %s startup fails', async (_label, key) => {
    const dependencies = dependencySet();
    dependencies[key].mockRejectedValue(new Error(`${key} failed`));

    await expect(bootstrap({ dependencies })).rejects.toThrow(`${key} failed`);
    expect(dependencies.startHttpServer).not.toHaveBeenCalled();
  });

  it('starts HTTP only after every production dependency succeeds', async () => {
    const events: string[] = [];
    const dependencies = dependencySet(events);

    const server = await bootstrap({ dependencies });

    expect(server).toBeDefined();
    expect(events).toEqual(['validate', 'mongo', 'redis', 'mcp', 'providers', 'worker', 'listen']);
  });

  it('can run the full startup gate without binding a port', async () => {
    const dependencies = dependencySet();

    await expect(bootstrap({ listen: false, dependencies })).resolves.toBeUndefined();
    expect(dependencies.startMediaWorker).toHaveBeenCalledTimes(1);
    expect(dependencies.startHttpServer).not.toHaveBeenCalled();
  });

  it('keeps development usable when an optional managed dependency is unavailable', async () => {
    process.env.NODE_ENV = 'development';
    const dependencies = dependencySet();
    dependencies.loadMcp.mockRejectedValue(new Error('local database is optional'));
    dependencies.reloadProviders.mockRejectedValue(new Error('local providers unavailable'));
    dependencies.startMediaWorker.mockRejectedValue(new Error('local worker unavailable'));

    await expect(bootstrap({ listen: false, dependencies })).resolves.toBeUndefined();
  });
});
