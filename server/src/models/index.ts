import sequelize from "../config/database";
import { Section, Department, JobTitle, Role, Permission, RolePermission } from "./lookups";
import { LeaveStatus, LeaveReason, LeaveDurationType } from "./leaveLookups";
import { Operator } from "./Operator";
import { LeaveRecord } from "./LeaveRecord";
import { LeaveBalanceLog } from "./LeaveBalanceLog";
import { LeaveActivityLog } from "./LeaveActivityLog";
import Notification from "./Notification";
// --- Lookups & Operator Associations ---
Section.hasMany(Department, { foreignKey: "section_id" });
Department.belongsTo(Section, { foreignKey: "section_id" });

Role.belongsToMany(Permission, { through: RolePermission, foreignKey: "role_id" });
Permission.belongsToMany(Role, { through: RolePermission, foreignKey: "permission_id" });

Operator.belongsTo(Role, { foreignKey: "role_id" });
Role.hasMany(Operator, { foreignKey: "role_id" });

Operator.belongsTo(Section, { foreignKey: "section" });
Section.hasMany(Operator, { foreignKey: "section" });

Operator.belongsTo(Department, { foreignKey: "department" });
Department.hasMany(Operator, { foreignKey: "department" });

Operator.belongsTo(JobTitle, { foreignKey: "title" });
JobTitle.hasMany(Operator, { foreignKey: "title" });

Operator.belongsTo(Operator, { as: "Auth1", foreignKey: "auth1" });
Operator.belongsTo(Operator, { as: "Auth2", foreignKey: "auth2" });

// --- LeaveRecord Associations ---
LeaveRecord.belongsTo(Operator, { as: "User", foreignKey: "user_id" });
Operator.hasMany(LeaveRecord, { as: "Leaves", foreignKey: "user_id" });

LeaveRecord.belongsTo(Operator, { as: "Approver1", foreignKey: "auth1_user_id" });
LeaveRecord.belongsTo(Operator, { as: "Approver2", foreignKey: "auth2_user_id" });
LeaveRecord.belongsTo(Operator, { as: "Creator", foreignKey: "created_by" });
LeaveRecord.belongsTo(Operator, { as: "Canceller", foreignKey: "cancelled_by" });

LeaveRecord.belongsTo(LeaveReason, { foreignKey: "leave_reason_id" });
LeaveReason.hasMany(LeaveRecord, { foreignKey: "leave_reason_id" });

LeaveRecord.belongsTo(LeaveStatus, { foreignKey: "leave_status_id" });
LeaveStatus.hasMany(LeaveRecord, { foreignKey: "leave_status_id" });

LeaveRecord.belongsTo(LeaveDurationType, { foreignKey: "leave_duration_type_id" });
LeaveDurationType.hasMany(LeaveRecord, { foreignKey: "leave_duration_type_id" });

// --- LeaveBalanceLog Associations ---
LeaveBalanceLog.belongsTo(Operator, { foreignKey: "user_id" });
Operator.hasMany(LeaveBalanceLog, { foreignKey: "user_id" });

LeaveBalanceLog.belongsTo(LeaveRecord, { foreignKey: "leave_record_id" });
LeaveRecord.hasMany(LeaveBalanceLog, { foreignKey: "leave_record_id" });

// --- LeaveActivityLog Associations ---
LeaveActivityLog.belongsTo(LeaveRecord, { foreignKey: "leave_record_id" });
LeaveRecord.hasMany(LeaveActivityLog, { foreignKey: "leave_record_id" });

LeaveActivityLog.belongsTo(Operator, { foreignKey: "performed_by" });
LeaveActivityLog.belongsTo(LeaveStatus, { as: "OldStatus", foreignKey: "old_status_id" });
LeaveActivityLog.belongsTo(LeaveStatus, { as: "NewStatus", foreignKey: "new_status_id" });

// --- Notification Associations ---
Notification.belongsTo(Operator, { as: "User", foreignKey: "user_id" });
Operator.hasMany(Notification, { as: "Notifications", foreignKey: "user_id" });

Notification.belongsTo(LeaveRecord, { as: "Leave", foreignKey: "related_id" });

export {
    sequelize,
    Section,
    Department,
    JobTitle,
    Role,
    Permission,
    RolePermission,
    Operator,
    LeaveStatus,
    LeaveReason,
    LeaveDurationType,
    LeaveRecord,
    LeaveBalanceLog,
    LeaveActivityLog,
    Notification
};
