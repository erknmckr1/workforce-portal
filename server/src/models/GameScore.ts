import { DataTypes, Model } from "sequelize";
import sequelize from "../config/database";

export class GameScore extends Model {
  public id!: number;
  public player_name!: string;
  public operator_id?: string;
  public user_id?: number;
  public score!: number;
  public locationReached?: string;
}

GameScore.init(
  {
    id: {
      type: DataTypes.INTEGER,
      autoIncrement: true,
      primaryKey: true,
    },
    player_name: {
      type: DataTypes.STRING(100),
      allowNull: false,
    },
    operator_id: {
      type: DataTypes.STRING(255),
      allowNull: true,
    },
    user_id: {
      type: DataTypes.INTEGER,
      allowNull: true,
    },
    score: {
      type: DataTypes.INTEGER,
      allowNull: false,
    },
    locationReached: {
      type: DataTypes.STRING(50),
      allowNull: true,
    },
  },
  {
    sequelize,
    modelName: "GameScore",
    tableName: "game_scores",
    timestamps: true,
    createdAt: "created_at",
    updatedAt: false,
  }
);
