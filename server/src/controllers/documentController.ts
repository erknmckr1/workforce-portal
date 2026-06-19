import { Request, Response } from "express";
import { IntranetDocument, Operator } from "../models";
import path from "path";
import fs from "fs";

// Tüm dökümanları getir (Creator bilgisiyle birlikte)
export const getDocuments = async (req: Request, res: Response): Promise<Response> => {
  try {
    const documents = await IntranetDocument.findAll({
      include: [
        {
          model: Operator,
          as: "Creator",
          attributes: ["name", "surname"],
        },
      ],
      order: [["created_at", "DESC"]],
    });

    return res.status(200).json(documents);
  } catch (error) {
    console.error("getDocuments Hatası:", error);
    return res.status(500).json({ message: "Dökümanlar listelenirken bir hata oluştu." });
  }
};

// Döküman Yükle (Admin/İK Yetkisiyle)
export const uploadDocument = async (req: Request, res: Response): Promise<Response> => {
  try {
    const { title, description, category } = req.body;

    if (!req.file) {
      return res.status(400).json({ message: "Lütfen bir PDF dosyası seçin." });
    }

    if (!title || !category) {
      // Yüklenen geçici dosyayı temizleyelim
      if (req.file.path && fs.existsSync(req.file.path)) {
        fs.unlinkSync(req.file.path);
      }
      return res.status(400).json({ message: "Başlık ve Kategori alanları zorunludur." });
    }

    const createdBy = req.user?.id_dec;
    if (!createdBy) {
      if (req.file.path && fs.existsSync(req.file.path)) {
        fs.unlinkSync(req.file.path);
      }
      return res.status(401).json({ message: "Oturum açmış kullanıcı bulunamadı." });
    }

    // Veritabanına kaydet
    const document = await IntranetDocument.create({
      title,
      description: description || null,
      category,
      fileName: req.file.filename,
      filePath: `/uploads/documents/${req.file.filename}`, // Statik dosya erişim yolu
      fileSize: req.file.size,
      isActive: true,
      created_by: createdBy,
    });

    // Creator bilgilerini ekleyip dönelim
    const savedDoc = await IntranetDocument.findByPk(document.id, {
      include: [
        {
          model: Operator,
          as: "Creator",
          attributes: ["name", "surname"],
        },
      ],
    });

    return res.status(201).json({
      message: "Döküman başarıyla yüklendi.",
      data: savedDoc,
    });
  } catch (error) {
    console.error("uploadDocument Hatası:", error);
    // Hata durumunda yüklenen dosya varsa silelim
    if (req.file && req.file.path && fs.existsSync(req.file.path)) {
      fs.unlinkSync(req.file.path);
    }
    return res.status(500).json({ message: "Döküman yüklenirken sunucu hatası oluştu." });
  }
};

// Döküman Sil (Admin/İK Yetkisiyle)
export const deleteDocument = async (req: Request, res: Response): Promise<Response> => {
  try {
    const { id } = req.params;

    const document = await IntranetDocument.findByPk(parseInt(id as string, 10));
    if (!document) {
      return res.status(404).json({ message: "Döküman bulunamadı." });
    }

    // Fiziksel dosyayı diskten silelim
    const storagePath =
      process.env.DOCUMENT_STORAGE_PATH ||
      path.join(__dirname, "../../uploads/documents");
    const fullPath = path.join(storagePath, document.fileName);

    if (fs.existsSync(fullPath)) {
      try {
        fs.unlinkSync(fullPath);
      } catch (err) {
        console.error("Fiziksel dosya silinemedi:", err);
        // Dosya bulunamamış veya kilitli olabilir, veritabanından yine de silmeye çalışacağız
      }
    }

    // Veritabanı kaydını silelim
    await document.destroy();

    return res.status(200).json({ message: "Döküman başarıyla silindi." });
  } catch (error) {
    console.error("deleteDocument Hatası:", error);
    return res.status(500).json({ message: "Döküman silinirken bir hata oluştu." });
  }
};
