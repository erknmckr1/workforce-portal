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

  // Migration for it_requests table: add resolved_at
  const itRequestColumns = await queryInterface.describeTable("it_requests");
  if (!itRequestColumns["resolved_at"]) {
    await queryInterface.addColumn("it_requests", "resolved_at", {
      type: DataTypes.DATE,
      allowNull: true
    });
    console.log("Schema updated: it_requests.resolved_at");
  }

  // Migration for scrap_measurements table: add weighed_quantity, weighed_weight, result_weight
  const scrapColumns = await queryInterface.describeTable("scrap_measurements");
  if (!scrapColumns["weighed_quantity"]) {
    await queryInterface.addColumn("scrap_measurements", "weighed_quantity", {
      type: DataTypes.INTEGER,
      allowNull: true,
    });
    console.log("Schema updated: scrap_measurements.weighed_quantity");
  }
  if (!scrapColumns["weighed_weight"]) {
    await queryInterface.addColumn("scrap_measurements", "weighed_weight", {
      type: DataTypes.FLOAT,
      allowNull: true,
    });
    console.log("Schema updated: scrap_measurements.weighed_weight");
  }
  if (!scrapColumns["result_weight"]) {
    await queryInterface.addColumn("scrap_measurements", "result_weight", {
      type: DataTypes.FLOAT,
      allowNull: true,
    });
    console.log("Schema updated: scrap_measurements.result_weight");
  }

  // Migration for measurements table: add gold_setting, gold_pure_scrap, measurement_diff, weighed_quantity, weighed_weight, result_weight
  const measureColumns = await queryInterface.describeTable("measurements");
  if (!measureColumns["gold_setting"]) {
    await queryInterface.addColumn("measurements", "gold_setting", {
      type: DataTypes.FLOAT,
      allowNull: true,
    });
    console.log("Schema updated: measurements.gold_setting");
  }
  if (!measureColumns["gold_pure_scrap"]) {
    await queryInterface.addColumn("measurements", "gold_pure_scrap", {
      type: DataTypes.FLOAT,
      allowNull: true,
    });
    console.log("Schema updated: measurements.gold_pure_scrap");
  }
  if (!measureColumns["measurement_diff"]) {
    await queryInterface.addColumn("measurements", "measurement_diff", {
      type: DataTypes.FLOAT,
      allowNull: true,
    });
    console.log("Schema updated: measurements.measurement_diff");
  }
  if (!measureColumns["weighed_quantity"]) {
    await queryInterface.addColumn("measurements", "weighed_quantity", {
      type: DataTypes.INTEGER,
      allowNull: true,
    });
    console.log("Schema updated: measurements.weighed_quantity");
  }
  if (!measureColumns["weighed_weight"]) {
    await queryInterface.addColumn("measurements", "weighed_weight", {
      type: DataTypes.FLOAT,
      allowNull: true,
    });
    console.log("Schema updated: measurements.weighed_weight");
  }
  if (!measureColumns["result_weight"]) {
    await queryInterface.addColumn("measurements", "result_weight", {
      type: DataTypes.FLOAT,
      allowNull: true,
    });
    console.log("Schema updated: measurements.result_weight");
  }

  // Migration for mes_parti_logs table
  try {
    const partiColumns = await queryInterface.describeTable("mes_parti_logs");

    if (!partiColumns["action_label"]) {
      await queryInterface.addColumn("mes_parti_logs", "action_label", {
        type: DataTypes.STRING(50),
        allowNull: true,
      });
      console.log("Schema updated: mes_parti_logs.action_label");
    }

    if (!partiColumns["action_type"]) {
      await queryInterface.addColumn("mes_parti_logs", "action_type", {
        type: DataTypes.INTEGER,
        allowNull: true,
      });
      console.log("Schema updated: mes_parti_logs.action_type");
    }

    if (!partiColumns["islem_label"]) {
      await queryInterface.addColumn("mes_parti_logs", "islem_label", {
        type: DataTypes.STRING(100),
        allowNull: true,
      });
      console.log("Schema updated: mes_parti_logs.islem_label");
    }

    if (!partiColumns["operator_name"]) {
      await queryInterface.addColumn("mes_parti_logs", "operator_name", {
        type: DataTypes.STRING(150),
        allowNull: true,
      });
      console.log("Schema updated: mes_parti_logs.operator_name");
    }

    if (!partiColumns["record_date"]) {
      await queryInterface.addColumn("mes_parti_logs", "record_date", {
        type: DataTypes.DATE,
        allowNull: true,
      });
      console.log("Schema updated: mes_parti_logs.record_date");
    }
  } catch (err) {
    // Tablo henüz yoksa oluştur
    console.log("mes_parti_logs tablosu bulunamadı, oluşturuluyor...");
    const { MesPartiLog } = await import("../models");
    console.log("Schema updated: mes_parti_logs table created.");
  }

  try {
    const { SystemAuditLog } = await import("../models");
    await SystemAuditLog.sync();
    console.log("Schema verified: system_audit_logs table ready.");
  } catch (err) {
    console.error("system_audit_logs sync error:", err);
  }
};

