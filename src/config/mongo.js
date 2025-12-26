const { MongoClient, GridFSBucket } = require('mongodb');

let client;
let db;
let bucket;

async function connectMongo(uri, dbName) {
  if (client && client.topology && client.topology.isConnected()) {
    return { client, db, bucket };
  }
  client = new MongoClient(uri, {
    maxPoolSize: 10,
  });
  await client.connect();
  db = client.db(dbName);
  bucket = new GridFSBucket(db, { bucketName: 'uploads' });
  return { client, db, bucket };
}

function getBucket() {
  if (!bucket) throw Object.assign(new Error('MongoDB not connected'), { status: 500 });
  return bucket;
}

function getDb() {
  if (!db) throw Object.assign(new Error('MongoDB not connected'), { status: 500 });
  return db;
}

async function disconnectMongo() {
  try {
    if (client) await client.close();
  } finally {
    client = undefined;
    db = undefined;
    bucket = undefined;
  }
}

module.exports = { connectMongo, getBucket, getDb, disconnectMongo };
