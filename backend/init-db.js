require('dotenv').config();
const mysql = require('mysql2/promise');
const fs = require('fs');
const path = require('path');

async function initializeDatabase() {
    console.log('Connecting to MySQL...');
    try {
        // Connect WITHOUT specifying a database so we can create it
        const connection = await mysql.createConnection({
            host: process.env.DB_HOST || '127.0.0.1',
            port: process.env.DB_PORT || 3306,
            user: process.env.DB_USER || 'root',
            password: process.env.DB_PASSWORD || '',
            multipleStatements: true // Required to run multiple queries from the SQL file
        });

        console.log('Reading schema.sql...');
        const schemaPath = path.join(__dirname, 'models', 'schema.sql');
        const schema = fs.readFileSync(schemaPath, 'utf8');

        console.log('Executing schema...');
        await connection.query(schema);

        console.log('✅ Database and tables created successfully!');
        process.exit(0);
    } catch (err) {
        console.error('❌ Error initializing database:', err.message);
        console.error('Make sure XAMPP MySQL is running and your .env credentials (DB_USER, DB_PASSWORD) are correct.');
        process.exit(1);
    }
}

initializeDatabase();
