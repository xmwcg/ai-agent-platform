declare const __store: Map<string, string>;
declare const memoryRedis: {
    get: jest.Mock<Promise<string>, [k: string], any>;
    set: jest.Mock<Promise<string>, [k: string, v: any], any>;
    incrby: jest.Mock<Promise<number>, [k: string, by: number], any>;
    expire: jest.Mock<Promise<number>, [], any>;
    del: jest.Mock<Promise<number>, [k: string], any>;
    on: jest.Mock<any, any, any>;
    quit: jest.Mock<Promise<string>, [], any>;
};
//# sourceMappingURL=setup.d.ts.map