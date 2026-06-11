import type { Transaction } from "sequelize";
import { LeaveActivityLog, Operator } from "../models";
import { sendLeaveApprovalEmail } from "./emailService";

interface SendLeaveApprovalEmailAndLogParams {
  leaveId: number;
  performedBy: string;
  recipientUserId: string;
  employeeName: string;
  startDate: Date | string;
  endDate: Date | string;
  reason: string;
  approvalStage: 1 | 2;
  transaction?: Transaction;
}

const serializeMetadata = (metadata: Record<string, unknown>) =>
  JSON.stringify(metadata);

const getErrorMessage = (error: unknown) =>
  error instanceof Error ? error.message : String(error);

const createUnexpectedFailureLog = async (
  params: SendLeaveApprovalEmailAndLogParams,
  error: unknown,
) => {
  try {
    await LeaveActivityLog.create({
      leave_record_id: params.leaveId,
      performed_by: params.performedBy,
      target_user_id: params.recipientUserId,
      action: "EMAIL_FAILED",
      channel: "EMAIL",
      delivery_status: "FAILED",
      details: `${params.approvalStage}. onaycı için e-posta işlemi tamamlanamadı.`,
      error_message: getErrorMessage(error).slice(0, 1000),
      metadata: serializeMetadata({
        approval_stage: params.approvalStage,
        failure_type: "UNEXPECTED_PROCESSING_ERROR",
      }),
    }, { transaction: params.transaction });
  } catch (logError) {
    console.error("E-posta işlem hatası günlüğe yazılamadı:", logError);
  }
};

const processLeaveApprovalEmail = async ({
  leaveId,
  performedBy,
  recipientUserId,
  employeeName,
  startDate,
  endDate,
  reason,
  approvalStage,
  transaction,
}: SendLeaveApprovalEmailAndLogParams) => {
  const recipient = await Operator.findByPk(recipientUserId, { transaction });
  const recipientName = recipient
    ? `${recipient.getDataValue("name")} ${recipient.getDataValue("surname")}`
    : recipientUserId;
  const recipientEmail = recipient?.getDataValue("email")?.trim();

  if (!recipient) {
    await LeaveActivityLog.create({
      leave_record_id: leaveId,
      performed_by: performedBy,
      target_user_id: recipientUserId,
      action: "EMAIL_SKIPPED",
      channel: "EMAIL",
      delivery_status: "SKIPPED",
      details: `${approvalStage}. onaycı bulunamadığı için e-posta gönderilmedi.`,
      error_message: "Alıcı kullanıcı kaydı bulunamadı.",
      metadata: serializeMetadata({ approval_stage: approvalStage, skip_reason: "RECIPIENT_NOT_FOUND" }),
    }, { transaction });
    return;
  }

  if (!recipientEmail) {
    await LeaveActivityLog.create({
      leave_record_id: leaveId,
      performed_by: performedBy,
      target_user_id: recipientUserId,
      action: "EMAIL_SKIPPED",
      channel: "EMAIL",
      delivery_status: "SKIPPED",
      details: `${recipientName} kullanıcısının e-posta adresi olmadığı için gönderim yapılmadı.`,
      metadata: serializeMetadata({ approval_stage: approvalStage, skip_reason: "NO_EMAIL_ADDRESS" }),
    }, { transaction });
    return;
  }

  const result = await sendLeaveApprovalEmail(
    recipientEmail,
    recipientName,
    employeeName,
    new Date(startDate),
    new Date(endDate),
    reason,
    leaveId,
    recipientUserId,
  );

  if (result.status === "SENT") {
    await LeaveActivityLog.create({
      leave_record_id: leaveId,
      performed_by: performedBy,
      target_user_id: recipientUserId,
      action: "EMAIL_SENT",
      channel: "EMAIL",
      delivery_status: "SENT",
      recipient_address: recipientEmail,
      details: `${approvalStage}. onaycı ${recipientName} için e-posta SMTP sunucusuna gönderildi.`,
      metadata: serializeMetadata({
        approval_stage: approvalStage,
        message_id: result.messageId,
        accepted: result.accepted,
        rejected: result.rejected,
      }),
    }, { transaction });
    return;
  }

  await LeaveActivityLog.create({
    leave_record_id: leaveId,
    performed_by: performedBy,
    target_user_id: recipientUserId,
    action: "EMAIL_FAILED",
    channel: "EMAIL",
    delivery_status: "FAILED",
    recipient_address: recipientEmail,
    details: `${approvalStage}. onaycı ${recipientName} için e-posta gönderilemedi.`,
    error_message: result.errorMessage.slice(0, 1000),
    metadata: serializeMetadata({ approval_stage: approvalStage }),
  }, { transaction });
};

export const sendLeaveApprovalEmailAndLog = async (
  params: SendLeaveApprovalEmailAndLogParams,
) => {
  try {
    await processLeaveApprovalEmail(params);
  } catch (error) {
    console.error("İzin onay e-postası işlenirken beklenmeyen hata:", error);
    await createUnexpectedFailureLog(params, error);
  }
};
