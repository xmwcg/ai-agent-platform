import axios from 'axios';
import fs from 'fs/promises';
import { execFile } from 'child_process';
import { AgnesProvider } from './agnes.provider';

jest.mock('axios');
jest.mock('child_process', () => ({ execFile: jest.fn() }));
jest.mock('fs/promises', () => ({
  mkdir: jest.fn().mockResolvedValue(undefined),
  writeFile: jest.fn().mockResolvedValue(undefined),
  copyFile: jest.fn().mockResolvedValue(undefined),
  rm: jest.fn().mockResolvedValue(undefined),
}));
jest.mock('../media-gen.shared', () => ({
  genTaskId: jest.fn(() => 'local-task'),
  persistTask: jest.fn().mockResolvedValue(undefined),
  retrieveTask: jest.fn(),
}));

const mockedAxios = axios as jest.Mocked<typeof axios>;

describe('AgnesProvider video duration', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    process.env.AGNES_API_KEY = 'test-key';
    process.env.AGNES_API_BASE = 'https://agnes.example/v1';
    mockedAxios.post
      .mockResolvedValueOnce({ data: { task_id: 'segment-one' } })
      .mockResolvedValueOnce({ data: { task_id: 'segment-two' } });
  });

  afterEach(() => {
    delete process.env.AGNES_API_KEY;
    delete process.env.AGNES_API_BASE;
  });

  it('splits a 30-second square 30fps video into valid Agnes frame-limited segments', async () => {
    jest.useFakeTimers();
    mockedAxios.post.mockResolvedValueOnce({ data: { task_id: 'segment-three' } });
    const provider = new AgnesProvider();
    const resultPromise = provider.generate({
      type: 'text2video',
      prompt: 'AIbak platform overview',
      duration: 30,
      size: '1024x1024',
      frameRate: 30,
    });
    await jest.runAllTimersAsync();
    const result = await resultPromise;

    expect(result.status).toBe('processing');
    expect(result.segmentTaskIds).toEqual(['segment-one', 'segment-two', 'segment-three']);
    expect(mockedAxios.post).toHaveBeenCalledTimes(3);
    expect(mockedAxios.post).toHaveBeenNthCalledWith(
      1,
      'https://apihub.agnes-ai.com/v1/videos',
      expect.objectContaining({ num_frames: 441, frame_rate: 30, width: 1024, height: 1024 }),
      expect.any(Object),
    );
    expect(mockedAxios.post).toHaveBeenNthCalledWith(
      2,
      'https://apihub.agnes-ai.com/v1/videos',
      expect.objectContaining({ num_frames: 441, frame_rate: 30, width: 1024, height: 1024 }),
      expect.any(Object),
    );
    expect(mockedAxios.post).toHaveBeenNthCalledWith(
      3,
      'https://apihub.agnes-ai.com/v1/videos',
      expect.objectContaining({ num_frames: 17, frame_rate: 30, width: 1024, height: 1024 }),
      expect.any(Object),
    );
    jest.useRealTimers();
  });

  it('copies persisted local segments instead of downloading relative URLs', async () => {
    (execFile as unknown as jest.Mock).mockImplementation((_file, _args, _options, callback) => {
      callback(null, '', '');
    });
    const provider = new AgnesProvider() as any;

    const outputUrl = await provider.mergeSegmentVideos([
      '/generated/agnes/segment-one.mp4',
      '/generated/agnes/segment-two.mp4',
    ], 'parent-task');

    expect(outputUrl).toBe('/generated/videos/parent-task.mp4');
    expect(fs.copyFile).toHaveBeenCalledTimes(2);
    expect(mockedAxios.get).not.toHaveBeenCalled();
  });
});
