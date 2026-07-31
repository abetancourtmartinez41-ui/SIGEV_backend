export default () => ({
  port: parseInt(process.env.PORT || '3000', 10),
  database: {
    host: process.env.DB_HOST || 'localhost',
    port: parseInt(process.env.DB_PORT || '5432', 10),
    username: process.env.DB_USERNAME || 'postgres',
    password: process.env.DB_PASSWORD || 'postgres',
    database: process.env.DB_NAME || 'sigev',
  },
  jwt: {
    secret: process.env.JWT_SECRET || 'super-secret-key-change-in-production',
    expiresIn: process.env.JWT_EXPIRATION || '8h',
  },
  fee: {
    rate: parseFloat(process.env.FEE_RATE || '0.0825'),
    applyOn: (process.env.FEE_APPLY_ON || 'base') as 'base' | 'total_with_taxes',
  },
  upload: {
    dest: process.env.UPLOAD_DEST || './uploads',
    maxFileSize: parseInt(process.env.MAX_FILE_SIZE || '10485760', 10),
  },
});
