// MongoDB 双重编码修复迁移脚本
// 用法: node fix-encoding-migration.js
const { MongoClient } = require('mongodb');

const MONGO_URI = process.env.MONGODB_URI || 'mongodb://ai-platform-mongodb:27017/ai_agent_platform';

function fixDoubleEncoding(str) {
  if (!str) return str;
  const hasHighBytes = /[\x80-\xFF]/.test(str);
  if (!hasHighBytes) return str;
  try {
    return Buffer.from(str, 'latin1').toString('utf8');
  } catch {
    return str;
  }
}

async function main() {
  const client = new MongoClient(MONGO_URI);
  await client.connect();
  const db = client.db();
  const collections = ['knowledges'];
  let totalFixed = 0;

  for (const colName of collections) {
    const col = db.collection(colName);
    const cursor = col.find({});
    let batchCount = 0;
    const batch = [];

    for await (const doc of cursor) {
      const changed = {};
      for (const field of ['title', 'summary', 'content', 'description']) {
        if (typeof doc[field] === 'string') {
          const fixed = fixDoubleEncoding(doc[field]);
          if (fixed !== doc[field]) {
            changed[field] = fixed;
          }
        }
      }
      if (Object.keys(changed).length > 0) {
        batch.push({ updateOne: { filter: { _id: doc._id }, update: { $set: changed } } });
        batchCount++;
      }

      if (batch.length >= 50) {
        await col.bulkWrite(batch);
        totalFixed += batch.length;
        console.log(`[knowledges] 已修复 ${batchCount} 条 (累计: ${totalFixed})`);
        batch.length = 0;
      }
    }

    if (batch.length > 0) {
      await col.bulkWrite(batch);
      totalFixed += batch.length;
      console.log(`[knowledges] 已修复 ${batchCount} 条 (累计: ${totalFixed})`);
    }
  }

  console.log(`\n迁移完成，共修复 ${totalFixed} 条文档`);
  await client.close();
}

main().catch((err) => { console.error(err); process.exit(1); });