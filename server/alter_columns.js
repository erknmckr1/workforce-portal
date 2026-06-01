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
    await sequelize.query("ALTER TABLE work_logs ALTER COLUMN setup_start_date DATETIMEOFFSET;");
    await sequelize.query("ALTER TABLE work_logs ALTER COLUMN setup_end_date DATETIMEOFFSET;");
    console.log('Columns altered');
  } catch (err) {
    console.error(err);
  } finally {
    await sequelize.close();
  }
}

run();
