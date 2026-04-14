const { Client } = require('pg');

exports.handler = async (event) => {
  const client = new Client({
    host: 'aurora-base44.cluster-cshqaci8y43o.us-east-1.rds.amazonaws.com',
    port: 5432,
    database: 'postgres',
    user: 'postgres',
    password: 'Jm3Rn#t*5QXZToSVLCCkmP:EAH5W',
    ssl: { rejectUnauthorized: false },
  });

  try {
    await client.connect();
    await client.query('CREATE DATABASE kaizen');
    await client.end();
    return { statusCode: 200, body: JSON.stringify({ message: 'Database kaizen created' }) };
  } catch (err) {
    if (err.code === '42P04') {
      return { statusCode: 200, body: JSON.stringify({ message: 'Database kaizen already exists' }) };
    }
    return { statusCode: 500, body: JSON.stringify({ error: err.message }) };
  }
};
