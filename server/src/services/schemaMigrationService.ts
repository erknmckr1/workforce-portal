import { DataTypes } from "sequelize";
import sequelize from "../config/database";

const leaveActivityLogColumns = {
  target_user_id: { type: DataTypes.STRING(255), allowNull: true },
  channel: { type: DataTypes.STRING(30), allowNull: true },
  delivery_status: { type: DataTypes.STRING(30), allowNull: true },
  recipient_address: { type: DataTypes.STRING(255), allowNull: true },
  error_message: { type: DataTypes.STRING(1000), allowNull: true },
  metadata: { type: DataTypes.TEXT, allowNull: true },
};

export const ensureApplicationSchema = async () => {
  const queryInterface = sequelize.getQueryInterface();
  const existingColumns = await queryInterface.describeTable("leave_activity_logs");

  for (const [columnName, definition] of Object.entries(leaveActivityLogColumns)) {
    if (!existingColumns[columnName]) {
      await queryInterface.addColumn("leave_activity_logs", columnName, definition);
      console.log(`Schema updated: leave_activity_logs.${columnName}`);
    }
  }
};
