import { DataTypes, Model } from "sequelize";
import sequelize from "../config/database";

export class GameSession extends Model {
  public id!: string;
  public operator_id!: string;
  public seed!: string;
  public status!: "ACTIVE" | "FINISHED" | "EXPIRED" | "REJECTED";
  public score?: number;
  public duration_ms?: number;
  public locationReached?: string;
  public suspicious_reason?: string | null;
  public started_at!: Date;
  public expires_at!: Date;
  public finished_at?: Date;
}

GameSession.init(
  {
    id: {
      type: DataTypes.UUID,
      defaultValue: DataTypes.UUIDV4,
      primaryKey: true,
    },
    operator_id: {
      type: DataTypes.STRING(255),
      allowNull: false,
    },
    seed: {
      type: DataTypes.STRING(100),
      allowNull: false,
    },
    status: {
      type: DataTypes.STRING(20),
      allowNull: false,
      defaultValue: "ACTIVE",
    },
    score: {
      type: DataTypes.INTEGER,
      allowNull: true,
    },
    duration_ms: {
      type: DataTypes.INTEGER,
      allowNull: true,
    },
    locationReached: {
      type: DataTypes.STRING(50),
      allowNull: true,
    },
    suspicious_reason: {
      type: DataTypes.STRING(255),
      allowNull: true,
    },
    started_at: {
      type: DataTypes.DATE,
      allowNull: false,
      defaultValue: DataTypes.NOW,
    },
    expires_at: {
      type: DataTypes.DATE,
      allowNull: false,
    },
    finished_at: {
      type: DataTypes.DATE,
      allowNull: true,
    },
  },
  {
    sequelize,
    modelName: "GameSession",
    tableName: "game_sessions",
    timestamps: false,
  },
);
