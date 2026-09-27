-- Separate database used by the integration test suite (npm run test:integration).
CREATE DATABASE IF NOT EXISTS dhaka_resident_test
  CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
GRANT ALL PRIVILEGES ON dhaka_resident_test.* TO 'dhaka'@'%';
FLUSH PRIVILEGES;
