import nodemailer from "nodemailer";
import jwt from "jsonwebtoken";

export type EmailDeliveryResult =
    | { status: "SENT"; messageId?: string; accepted: string[]; rejected: string[] }
    | { status: "FAILED"; errorMessage: string };

// NodeMail taşıyıcı ayarları
const transporter = nodemailer.createTransport({
    // @ts-ignore
    host: process.env.EMAIL_HOST || "smtp-mail.outlook.com", // Hotmail/Outlook ayarı varsayılan
    port: process.env.EMAIL_PORT ? parseInt(process.env.EMAIL_PORT) : 587,
    secure: false, // TLS
    auth: {
        user: process.env.EMAIL_USERNAME,
        pass: process.env.EMAIL_PASSWORD
    },
    tls: {
        ciphers: 'SSLv3'
    }
});

// E-posta Onay Tokenı Üretir (Süresiz)
export const generateEmailActionToken = (leaveId: number, approverId: string, action: "approve" | "reject") => {
    return jwt.sign(
        { leave_id: leaveId, approver_id: approverId, action },
        process.env.SECRET_KEY || "super_secret_jwt_key_degistir"
    ); // expiresIn kullanmıyoruz, böylece süre sınırı olmuyor
};

/**
 * Yöneticiye onay mailini gönderir
 */
export const sendLeaveApprovalEmail = async (
    toEmail: string,
    approverName: string,
    employeeName: string,
    startDate: Date,
    endDate: Date,
    reason: string,
    leaveId: number,
    approverId: string
): Promise<EmailDeliveryResult> => {
    // Tokenları Üret
    const approveToken = generateEmailActionToken(leaveId, approverId, "approve");
    const rejectToken = generateEmailActionToken(leaveId, approverId, "reject");

    // E-posta Linklerini Oluştur (Burası canlıda kendi domaine göre ayarlanabilir)
    const baseUrl = process.env.API_BASE_URL || "http://localhost:3003"; 
    const approveLink = `${baseUrl}/api/leave/email-action?token=${approveToken}`;
    const rejectLink = `${baseUrl}/api/leave/email-action?token=${rejectToken}`;

    // Tarih Formatı
    const fdStart = new Date(startDate).toLocaleDateString("tr-TR");
    const fdEnd = new Date(endDate).toLocaleDateString("tr-TR");

    // HTML Şablonu (Modern & Profesyonel Tasarım)
    const htmlContent = `
    <!DOCTYPE html>
    <html lang="tr">
    <head>
        <meta charset="UTF-8">
        <style>
            .email-container {
                font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;
                background-color: #f4f7f9;
                padding: 40px 20px;
                color: #333;
            }
            .card {
                max-width: 550px;
                margin: 0 auto;
                background: #ffffff;
                border-radius: 16px;
                overflow: hidden;
                box-shadow: 0 10px 30px rgba(0,0,0,0.08);
            }
            .header {
                background: linear-gradient(135deg, #1e3a8a 0%, #3b82f6 100%);
                padding: 30px;
                text-align: center;
                color: white;
            }
            .header h2 { margin: 0; font-size: 22px; letter-spacing: 0.5px; }
            .content { padding: 35px; }
            .greeting { font-size: 18px; font-weight: 600; color: #1e293b; margin-bottom: 10px; }
            .description { color: #64748b; font-size: 15px; border-left: 3px solid #3b82f6; padding-left: 15px; margin: 20px 0; }
            
            .info-table { width: 100%; background: #f8fafc; border-radius: 12px; padding: 15px; margin: 25px 0; border-collapse: separate; border-spacing: 0 10px; }
            .info-label { color: #94a3b8; font-size: 12px; text-transform: uppercase; font-weight: 700; width: 40%; }
            .info-value { color: #334155; font-size: 15px; font-weight: 600; }

            .actions { text-align: center; margin-top: 35px; display: flex; justify-content: center; gap: 15px; }
            .btn {
                display: inline-block;
                padding: 14px 28px;
                border-radius: 10px;
                text-decoration: none;
                font-weight: 700;
                font-size: 14px;
                transition: all 0.3s ease;
                margin: 0 8px;
            }
            .btn-approve { background-color: #10b981; color: white; box-shadow: 0 4px 12px rgba(16, 185, 129, 0.25); }
            .btn-reject { background-color: #ef4444; color: white; box-shadow: 0 4px 12px rgba(239, 68, 68, 0.25); }
            
            .footer {
                text-align: center;
                padding: 25px;
                font-size: 12px;
                color: #94a3b8;
                background: #f8fafc;
                border-top: 1px solid #f1f5f9;
            }
        </style>
    </head>
    <body class="email-container">
        <div class="card">
            <div class="header">
                <h2>İzin Onay Yönetimi</h2>
            </div>
            <div class="content">
                <div class="greeting">Merhaba Sayın ${approverName},</div>
                <div class="description">
                    Ekibinizden <strong>${employeeName}</strong> bir izin talebinde bulundu. Talebi panelimize gitmeden e-posta üzerinden hızlıca yönetebilirsiniz.
                </div>

                <table class="info-table">
                    <tr>
                        <td class="info-label">Personel</td>
                        <td class="info-value">${employeeName}</td>
                    </tr>
                    <tr>
                        <td class="info-label">İzin Sebebi</td>
                        <td class="info-value">${reason}</td>
                    </tr>
                    <tr>
                        <td class="info-label">Başlangıç</td>
                        <td class="info-value">${fdStart}</td>
                    </tr>
                    <tr>
                        <td class="info-label">Bitiş Tarihi</td>
                        <td class="info-value">${fdEnd}</td>
                    </tr>
                </table>

                <div class="actions">
                    <a href="${approveLink}" class="btn btn-approve">İzni Onayla</a>
                    <a href="${rejectLink}" class="btn btn-reject">İzni Reddet</a>
                </div>
            </div>
            <div class="footer">
                Bu e-posta <strong>...</strong> üzerinden otomatik olarak oluşturulmuştur.<br>
                © ${new Date().getFullYear()} Midas Hediyelik Eşya.
            </div>
        </div>
    </body>
    </html>
    `;

    try {
        const info = await transporter.sendMail({
            from: process.env.EMAIL_FROM || process.env.EMAIL_USERNAME,
            to: toEmail,
            subject: `İzin Onayı Gerekli: ${employeeName}`,
            html: htmlContent
        });
        const accepted = (info.accepted || []).map(String);
        const rejected = (info.rejected || []).map(String);

        if (accepted.length === 0) {
            return {
                status: "FAILED",
                errorMessage: rejected.length > 0
                    ? `SMTP alıcıyı reddetti: ${rejected.join(", ")}`
                    : "SMTP gönderimi kabul etmedi.",
            };
        }

        console.log(`İzin onay maili gönderildi -> ${toEmail}`);
        return {
            status: "SENT",
            messageId: info.messageId,
            accepted,
            rejected,
        };
    } catch (error) {
        console.error("Mail gönderme hatası:", error);
        return {
            status: "FAILED",
            errorMessage: error instanceof Error ? error.message : String(error),
        };
    }
};

/**
 * Taşlama Gram Uyarı e-postası gönderir
 */
export const sendScrapWeightWarningEmail = async (
    orderNo: string,
    materialNo: string,
    systemGram: number,
    resultGram: number,
    percentDiff: number
): Promise<EmailDeliveryResult> => {
    const toEmail = process.env.SCRAP_WARNING_EMAIL || "msatis@midas.com.tr";

    const formattedDiff = percentDiff > 0 ? `+${percentDiff.toFixed(2)}` : percentDiff.toFixed(2);

    const htmlContent = `
    <!DOCTYPE html>
    <html lang="tr">
    <head>
        <meta charset="UTF-8">
        <style>
            .email-container {
                font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;
                background-color: #f4f7f9;
                padding: 40px 20px;
                color: #333;
            }
            .card {
                max-width: 550px;
                margin: 0 auto;
                background: #ffffff;
                border-radius: 16px;
                overflow: hidden;
                box-shadow: 0 10px 30px rgba(0,0,0,0.08);
            }
            .header {
                background: linear-gradient(135deg, #ef4444 0%, #b91c1c 100%);
                padding: 30px;
                text-align: center;
                color: white;
            }
            .header h2 { margin: 0; font-size: 22px; letter-spacing: 0.5px; }
            .content { padding: 35px; }
            .warning-msg { font-size: 16px; font-weight: 600; color: #b91c1c; margin-bottom: 20px; }
            
            .info-table { width: 100%; background: #f8fafc; border-radius: 12px; padding: 15px; margin: 25px 0; border-collapse: separate; border-spacing: 0 10px; }
            .info-label { color: #94a3b8; font-size: 12px; text-transform: uppercase; font-weight: 700; width: 40%; }
            .info-value { color: #334155; font-size: 15px; font-weight: 600; }
            
            .footer {
                text-align: center;
                padding: 25px;
                font-size: 12px;
                color: #94a3b8;
                background: #f8fafc;
                border-top: 1px solid #f1f5f9;
            }
        </style>
    </head>
    <body class="email-container">
        <div class="card">
            <div class="header">
                <h2>Taşlama Gram Uyarı</h2>
            </div>
            <div class="content">
                <div class="warning-msg">Dikkat: Taşlama işleminde tolerans dışı gramaj farkı tespit edilmiştir!</div>
                
                <table class="info-table">
                    <tr>
                        <td class="info-label">Sipariş No</td>
                        <td class="info-value">${orderNo}</td>
                    </tr>
                    <tr>
                        <td class="info-label">Malzeme Kodu</td>
                        <td class="info-value">${materialNo}</td>
                    </tr>
                    <tr>
                        <td class="info-label">Sistem Gram (Birim)</td>
                        <td class="info-value">${systemGram.toFixed(4)} g</td>
                    </tr>
                    <tr>
                        <td class="info-label">Sonuç Gram (Tartılan)</td>
                        <td class="info-value">${resultGram.toFixed(4)} g</td>
                    </tr>
                    <tr>
                        <td class="info-label">% Fark</td>
                        <td class="info-value" style="color: #ef4444;">%${formattedDiff}</td>
                    </tr>
                </table>
            </div>
            <div class="footer">
                Bu e-posta sistem üzerinden otomatik olarak oluşturulmuştur.<br>
                © ${new Date().getFullYear()} Midas Hediyelik Eşya.
            </div>
        </div>
    </body>
    </html>
    `;

    try {
        const info = await transporter.sendMail({
            from: process.env.EMAIL_FROM || process.env.EMAIL_USERNAME,
            to: toEmail,
            subject: `Taşlama Gram Uyarı - Sipariş: ${orderNo}`,
            html: htmlContent
        });
        console.log(`Taşlama Gram Uyarı maili gönderildi -> ${toEmail}`);
        return {
            status: "SENT",
            messageId: info.messageId,
            accepted: (info.accepted || []).map(String),
            rejected: (info.rejected || []).map(String)
        };
    } catch (error) {
        console.error("Mail gönderme hatası:", error);
        return {
            status: "FAILED",
            errorMessage: error instanceof Error ? error.message : String(error)
        };
    }
};
