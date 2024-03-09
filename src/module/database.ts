import { MongoClient } from 'mongodb';
import { config } from 'dotenv';

config();

const url = `mongodb+srv://${process.env.DB_USER}:${process.env.DB_PWD}@cluster0.sp3gbda.mongodb.net/`;
let connectDB: Promise<MongoClient>;

if (!global._mongo) {
  global._mongo = new MongoClient(url).connect();
}
connectDB = global._mongo;
export { connectDB };
