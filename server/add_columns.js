const { Sequelize } = require('sequelize');

const sequelize = new Sequelize('MDSN', 'sa', 'PWork2024!', {
  host: '192.168.3.5',
  dialect: 'mssql',
  dialectOptions: {
    options: {
      encrypt: false,
      trustServerCertificate: true,
    },
  },
});

async function run() {
  try {
    await sequelize.query("ALTER TABLE work_logs ADD setup_start_date DATETIME, setup_end_date DATETIME, setup_operator_id VARCHAR(50);");
    console.log('Columns added');
  } catch (err) {
    console.error(err);
  } finally {
    await sequelize.close();
  }
}

run();
