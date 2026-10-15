import { DataTypes, Model, Optional } from "sequelize";
import sequelize from "../config/database";

export interface VisitorAttributes {
  id: number;
  fullName: string;
  company?: string | null;
  phone?: string | null;
  visitedPersonOrDept: string;
  visitPurpose?: string | null;
  originProvince: string;
  originDistrict: string;
  transportMode: string;
  vehiclePassengerCount?: number | null;
  licensePlate?: string | null;
  entryTime: Date;
  exitTime?: Date | null;
  isInside: boolean;
  source: string;
  notes?: string | null;
  kvkkApproved: boolean;
  createdAt?: Date;
  updatedAt?: Date;
}

export type VisitorCreationAttributes = Optional<
  VisitorAttributes,
  | "id"
  | "company"
  | "phone"
  | "visitPurpose"
  | "vehiclePassengerCount"
  | "licensePlate"
  | "entryTime"
  | "exitTime"
  | "isInside"
  | "source"
  | "notes"
  | "kvkkApproved"
  | "createdAt"
  | "updatedAt"
>;

export class Visitor
  extends Model<VisitorAttributes, VisitorCreationAttributes>
  implements VisitorAttributes
{
  public id!: number;
  public fullName!: string;
  public company!: string | null;
  public phone!: string | null;
  public visitedPersonOrDept!: string;
  public visitPurpose!: string | null;
  public originProvince!: string;
  public originDistrict!: string;
  public transportMode!: string;
  public vehiclePassengerCount!: number | null;
  public licensePlate!: string | null;
  public entryTime!: Date;
  public exitTime!: Date | null;
  public isInside!: boolean;
  public source!: string;
  public notes!: string | null;
  public kvkkApproved!: boolean;

  public readonly createdAt!: Date;
  public readonly updatedAt!: Date;
}

Visitor.init(
  {
    id: {
      type: DataTypes.INTEGER,
      autoIncrement: true,
      primaryKey: true,
    },
    fullName: {
      type: DataTypes.STRING(150),
      allowNull: false,
      field: "full_name",
    },
    company: {
      type: DataTypes.STRING(200),
      allowNull: true,
      field: "company",
    },
    phone: {
      type: DataTypes.STRING(50),
      allowNull: true,
      field: "phone",
    },
    visitedPersonOrDept: {
      type: DataTypes.STRING(200),
      allowNull: false,
      field: "visited_person_or_dept",
    },
    visitPurpose: {
      type: DataTypes.STRING(200),
      allowNull: true,
      field: "visit_purpose",
    },
    originProvince: {
      type: DataTypes.STRING(100),
      allowNull: false,
      field: "origin_province",
    },
    originDistrict: {
      type: DataTypes.STRING(100),
      allowNull: false,
      field: "origin_district",
    },
    transportMode: {
      type: DataTypes.STRING(50),
      allowNull: false,
      field: "transport_mode",
    },
    vehiclePassengerCount: {
      type: DataTypes.INTEGER,
      allowNull: true,
      field: "vehicle_passenger_count",
    },
    licensePlate: {
      type: DataTypes.STRING(50),
      allowNull: true,
      field: "license_plate",
    },
    entryTime: {
      type: DataTypes.DATE,
      allowNull: false,
      defaultValue: DataTypes.NOW,
      field: "entry_time",
    },
    exitTime: {
      type: DataTypes.DATE,
      allowNull: true,
      field: "exit_time",
    },
    isInside: {
      type: DataTypes.BOOLEAN,
      allowNull: false,
      defaultValue: true,
      field: "is_inside",
    },
    source: {
      type: DataTypes.STRING(50),
      allowNull: false,
      defaultValue: "Güvenlik – Manuel Kayıt",
      field: "source",
    },
    notes: {
      type: DataTypes.STRING(1000),
      allowNull: true,
      field: "notes",
    },
    kvkkApproved: {
      type: DataTypes.BOOLEAN,
      allowNull: false,
      defaultValue: true,
      field: "kvkk_approved",
    },
  },
  {
    sequelize,
    tableName: "visitors",
    timestamps: true,
    indexes: [
      {
        name: "idx_visitors_is_inside",
        fields: ["is_inside"],
      },
      {
        name: "idx_visitors_entry_time",
        fields: ["entry_time"],
      },
      {
        name: "idx_visitors_full_name",
        fields: ["full_name"],
      },
      {
        name: "idx_visitors_license_plate",
        fields: ["license_plate"],
      },
    ],
  }
);

export default Visitor;
