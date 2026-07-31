import mongoose from 'mongoose';
import { Course } from '../models/Course';
import { connectMongoDB, closeDatabases } from '../config/database';
import { buildCourseImportPayload, selectCourseDefinitions } from '../services/course-import.service';

interface CliOptions {
  source: string;
  ids?: string[];
  publish: boolean;
  dryRun: boolean;
}

function parseArgs(argv: string[]): CliOptions {
  const value = (name: string) => {
    const direct = argv.find((arg) => arg.startsWith(`${name}=`));
    if (direct) return direct.slice(name.length + 1);
    const index = argv.indexOf(name);
    return index >= 0 ? argv[index + 1] : undefined;
  };
  const source = value('--source') || process.env.NEXMIND_COURSES_ROOT;
  if (!source) throw new Error('必须通过 --source 或 NEXMIND_COURSES_ROOT 指定 courses 目录');
  const ids = value('--ids')?.split(',').map((id) => id.trim()).filter(Boolean);
  return {
    source,
    ids,
    publish: argv.includes('--publish'),
    dryRun: argv.includes('--dry-run'),
  };
}

export async function runCourseImport(argv = process.argv.slice(2)): Promise<void> {
  const options = parseArgs(argv);
  const definitions = selectCourseDefinitions(options.ids);
  const payloads = definitions.map((definition) => buildCourseImportPayload(options.source, definition));

  if (options.dryRun) {
    console.log(JSON.stringify(payloads.map((course) => ({
      id: course.sourceCourseId,
      title: course.title,
      price: course.price,
      requiredPlan: course.requiredPlan,
      chapters: course.chapters.length,
      topicsContentCharacters: course.chapters.reduce((sum, chapter) => sum + chapter.content.length, 0),
    })), null, 2));
    return;
  }

  await connectMongoDB();
  if (mongoose.connection.readyState !== 1) {
    throw new Error('MongoDB 未连接，拒绝导入课程');
  }

  for (const payload of payloads) {
    const update: Record<string, unknown> = { ...payload };
    if (options.publish) update.isPublished = true;
    const insertDefaults: Record<string, unknown> = { enrolledStudents: 0, rating: 0 };
    if (!options.publish) insertDefaults.isPublished = false;
    await Course.findOneAndUpdate(
      { sourceCourseId: payload.sourceCourseId },
      { $set: update, $setOnInsert: insertDefaults },
      { upsert: true, new: true, setDefaultsOnInsert: true },
    );
    console.log(`COURSE_IMPORTED ${payload.sourceCourseId} ${payload.title}`);
  }
}

if (require.main === module) {
  runCourseImport()
    .then(() => closeDatabases())
    .catch(async (error) => {
      console.error(error instanceof Error ? error.message : error);
      await closeDatabases();
      process.exitCode = 1;
    });
}
