import { DataTypes, Model, Optional } from "sequelize";
import sequelize from "../config/database";

export interface WorkLogAttributes {
  id: number;
  operator_id: string; // Kim başlattı? (id_dec)
  order_no: string;    // Hangi sipariş? (SAP ORDER_ID)
  
  // Konum ve Süreç Bilgileri
  section_id?: string | null;
  area_name?: string | null;
  field?: string | null;
  process_id?: string | null;
  process_name?: string | null;
  machine_name?: string | null;
  
  // Zaman ve Durum
  status: number; // 1: Başladı, 2: Duraklatıldı, 3: İptal, 4: Tamamlandı
  start_date: Date;
  end_date?: Date | null;
  
  // Üretim Verileri (İş Bittiğinde Dolacak)
  produced_qty_gr?: number | null; // Üretilen Gramaj
  produced_qty_pcs?: number | null; // Üretilen Adet
  scrap_qty_gr?: number | null;     // Hurda Gramaj
  
  // Tamir Verileri (Eğer kalite vb. bölümdeyse dolacak)
  // Ekstra/Dinamik Veriler (Her bölüm kendi özel ihtiyacına göre JSON formatında veri basabilir)
  additional_data?: any | null; // Örn Kalite: {"reasons": [{"id":1, "gr": 5}]}, Cila: {"count": 50}
  
  // Durdurma/İptal Nedeni
  cancel_reason_id?: string | null;
  stop_reason_id?: string | null;
  cancelled_by?: string | null;
  cancelled_at?: Date | null;
  
  // Açıklama
  finish_description?: string | null;
}

export interface WorkLogCreationAttributes extends Optional<WorkLogAttributes, "id" | "start_date" | "status"> {}

export class WorkLog extends Model<WorkLogAttributes, WorkLogCreationAttributes> implements WorkLogAttributes {
  public id!: number;
  public operator_id!: string;
  public order_no!: string;
  public section_id!: string | null;
  public area_name!: string | null;
  public field!: string | null;
  public process_id!: string | null;
  public process_name!: string | null;
  public machine_name!: string | null;
  
  public status!: number;
  public start_date!: Date;
  public end_date!: Date | null;
  
  public produced_qty_gr!: number | null;
  public produced_qty_pcs!: number | null;
  public scrap_qty_gr!: number | null;
  
  public additional_data!: any | null;
  
  public cancel_reason_id!: string | null;
  public stop_reason_id!: string | null;
  public cancelled_by!: string | null;
  public cancelled_at!: Date | null;
  public finish_description!: string | null;
}

WorkLog.init(
  {
    id: {
      type: DataTypes.INTEGER,
      autoIncrement: true,
      primaryKey: true,
    },
    operator_id: {
      type: DataTypes.STRING,
      allowNull: false,
    },
    order_no: {
      type: DataTypes.STRING(50),
      allowNull: false,
    },
    section_id: {
      type: DataTypes.STRING,
      allowNull: true,
    },
    area_name: {
      type: DataTypes.STRING,
      allowNull: true,
    },
    field: {
      type: DataTypes.STRING,
      allowNull: true,
    },
    process_id: {
      type: DataTypes.STRING,
      allowNull: true,
    },
    process_name: {
      type: DataTypes.STRING,
      allowNull: true,
    },
    machine_name: {
      type: DataTypes.STRING,
      allowNull: true,
    },
    status: {
      type: DataTypes.INTEGER,
      allowNull: false,
      defaultValue: 1, // Standart olarak 1 (Started) başlar
    },
    start_date: {
      type: DataTypes.DATE,
      allowNull: false,
      defaultValue: DataTypes.NOW,
    },
    end_date: {
      type: DataTypes.DATE,
      allowNull: true,
    },
    produced_qty_gr: {
      type: DataTypes.DECIMAL(10, 2),
      allowNull: true,
    },
    produced_qty_pcs: {
      type: DataTypes.INTEGER,
      allowNull: true,
    },
    scrap_qty_gr: {
      type: DataTypes.DECIMAL(10, 2),
      allowNull: true,
    },
    additional_data: {
      type: DataTypes.TEXT, // MSSQL'de native JSON tipi olmadığı için TEXT (NVARCHAR(MAX)) kullanıyoruz.
      allowNull: true,
      get() {
        const value = this.getDataValue("additional_data" as keyof WorkLogAttributes);
        return value ? JSON.parse(value as string) : null;
      },
      set(value: any) {
        this.setDataValue("additional_data" as keyof WorkLogAttributes, value ? JSON.stringify(value) : null);
      }
    },
    cancel_reason_id: {
      type: DataTypes.STRING,
      allowNull: true,
    },
    stop_reason_id: {
      type: DataTypes.STRING,
      allowNull: true,
    },
    cancelled_by: {
      type: DataTypes.STRING,
      allowNull: true,
    },
    cancelled_at: {
      type: DataTypes.DATE,
      allowNull: true,
    },
    finish_description: {
      type: DataTypes.TEXT,
      allowNull: true,
    },
  },
  {
    sequelize,
    tableName: "work_logs",
    timestamps: false, // create_date ve update_date'i kapatıyoruz, kendimiz yöneteceğiz
  }
);
