import { DataTypes, Model } from "sequelize";
import sequelize from "../config/database";

export enum PartiActionType {
  BASLA = 1,
  BITIR = 2,
  DURDUR = 3,
  IPTAL = 4,
}

export const PARTI_ACTION_LABELS: Record<number, string> = {
  [PartiActionType.BASLA]: "BAŞLADI",
  [PartiActionType.BITIR]: "BİTTİ",
  [PartiActionType.DURDUR]: "DURDURULDU",
  [PartiActionType.IPTAL]: "İPTAL EDİLDİ",
};

export interface MesPartiLogAttributes {
  id?: number;
  parti_no: string;
  alt_parti: string;
  islem_id: string;
  islem_label?: string | null;
  action_type: number; // 1: BAŞLA, 2: BİTİR, 3: DURDUR, 4: İPTAL ...
  action_label?: string | null;
  operator_id: string;
  operator_name?: string | null;
  record_date?: Date;
  createdAt?: Date;
  updatedAt?: Date;
}

export class MesPartiLog extends Model<MesPartiLogAttributes> implements MesPartiLogAttributes {
  public id!: number;
  public parti_no!: string;
  public alt_parti!: string;
  public islem_id!: string;
  public islem_label!: string | null;
  public action_type!: number;
  public action_label!: string | null;
  public operator_id!: string;
  public operator_name!: string | null;
  public record_date!: Date;
  public readonly createdAt!: Date;
  public readonly updatedAt!: Date;
}

MesPartiLog.init(
  {
    id: {
      type: DataTypes.INTEGER,
      primaryKey: true,
      autoIncrement: true,
    },
    parti_no: {
      type: DataTypes.STRING(50),
      allowNull: false,
    },
    alt_parti: {
      type: DataTypes.STRING(50),
      allowNull: false,
    },
    islem_id: {
      type: DataTypes.STRING(10),
      allowNull: false,
    },
    islem_label: {
      type: DataTypes.STRING(100),
      allowNull: true,
    },
    action_type: {
      type: DataTypes.INTEGER,
      allowNull: false,
      comment: "1: BAŞLA, 2: BİTİR, 3: DURDUR, 4: İPTAL",
    },
    action_label: {
      type: DataTypes.STRING(50),
      allowNull: true,
    },
    operator_id: {
      type: DataTypes.STRING(50),
      allowNull: false,
    },
    operator_name: {
      type: DataTypes.STRING(150),
      allowNull: true,
    },
    record_date: {
      type: DataTypes.DATE,
      allowNull: false,
      defaultValue: DataTypes.NOW,
    },
  },
  {
    sequelize,
    tableName: "mes_parti_logs",
    timestamps: true,
    indexes: [
      {
        name: "idx_mes_parti_logs_parti_no",
        fields: ["parti_no"],
      },
      {
        name: "idx_mes_parti_logs_operator_id",
        fields: ["operator_id"],
      },
      {
        name: "idx_mes_parti_logs_record_date",
        fields: ["record_date"],
      },
      {
        name: "idx_mes_parti_logs_action_type",
        fields: ["action_type"],
      },
    ],
  }
);

export default MesPartiLog;
