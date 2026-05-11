import { DataTypes, Model } from "sequelize";
import sequelize from "../config/database";

export class GameProfile extends Model {
  public operator_id!: string;
  public nickname!: string;
  public best_score!: number;
}

GameProfile.init(
  {
    operator_id: {
      type: DataTypes.STRING(255),
      primaryKey: true,
    },
    nickname: {
      type: DataTypes.STRING(100),
      allowNull: false,
      unique: true
    },
    best_score: {
      type: DataTypes.INTEGER,
      defaultValue: 0,
    },
  },
  {
    sequelize,
    modelName: "GameProfile",
    tableName: "game_profiles",
    timestamps: true,
    createdAt: "created_at",
    updatedAt: "updated_at",
  }
);
