import { Request, Response } from "express";
import { VisitorContact, Operator, Section, Department, PhoneDirectory } from "../models";
import { Op } from "sequelize";

/**
 * 1. Tüm Ziyaretçi İletişim Kişilerini Getir (Ayarlar Ekranı İçin)
 * GET /api/visitor-contacts
 */
export const getAllContacts = async (req: Request, res: Response): Promise<Response> => {
  try {
    const contacts = await VisitorContact.findAll({
      order: [
        ["departmentName", "ASC"],
        ["isDefault", "DESC"],
        ["sortOrder", "ASC"],
        ["fullName", "ASC"],
      ],
    });

    // Benzersiz departman listesi
    const departments = Array.from(
      new Set(contacts.map((c) => c.departmentName))
    ).sort((a, b) => a.localeCompare(b, "tr"));

    return res.status(200).json({
      success: true,
      contacts,
      departments,
      totalCount: contacts.length,
    });
  } catch (error: unknown) {
    console.error("getAllContacts Hatası:", error);
    const msg = error instanceof Error ? error.message : "Görüşülecek kişiler yüklenemedi.";
    return res.status(500).json({ success: false, message: msg });
  }
};

/**
 * 2. Ziyaretçi Formları İçin Aktif Kişileri Getir (Public / Güvenlik Formu İçin)
 * GET /api/visitor-contacts/active
 */
export const getActiveContacts = async (req: Request, res: Response): Promise<Response> => {
  try {
    const contacts = await VisitorContact.findAll({
      where: { isActive: true },
      attributes: [
        "id",
        "departmentName",
        "fullName",
        "title",
        "phoneExtension",
        "isDefault",
        "sortOrder",
      ],
      order: [
        ["departmentName", "ASC"],
        ["isDefault", "DESC"],
        ["fullName", "ASC"],
      ],
    });

    // Departman listesi
    const departments = Array.from(
      new Set(contacts.map((c) => c.departmentName))
    ).sort((a, b) => a.localeCompare(b, "tr"));

    // Departman bazlı varsayılan kişi haritası
    const defaultByDepartment: Record<string, string> = {};
    for (const c of contacts) {
      if (c.isDefault && !defaultByDepartment[c.departmentName]) {
        defaultByDepartment[c.departmentName] = c.fullName;
      }
    }

    return res.status(200).json({
      success: true,
      contacts,
      departments,
      defaultByDepartment,
    });
  } catch (error: unknown) {
    console.error("getActiveContacts Hatası:", error);
    const msg = error instanceof Error ? error.message : "Aktif kişiler yüklenemedi.";
    return res.status(500).json({ success: false, message: msg });
  }
};

/**
 * 3. Yeni Ziyaretçi Muhatabı Ekle
 * POST /api/visitor-contacts
 */
export const createContact = async (req: Request, res: Response): Promise<Response> => {
  try {
    const {
      departmentName,
      fullName,
      title,
      phoneExtension,
      email,
      isDefault = false,
      isActive = true,
      sortOrder = 0,
    } = req.body;

    if (!departmentName || !departmentName.trim()) {
      return res.status(400).json({ success: false, message: "Lütfen Bölüm / Departman adını belirtiniz." });
    }

    if (!fullName || !fullName.trim()) {
      return res.status(400).json({ success: false, message: "Lütfen Görüşülecek Kişi Ad ve Soyadını belirtiniz." });
    }

    const trimmedDept = departmentName.trim();
    const trimmedName = fullName.trim();

    // Aynı departmanda bu kişi zaten var mı?
    const existing = await VisitorContact.findOne({
      where: {
        departmentName: trimmedDept,
        fullName: trimmedName,
      },
    });

    if (existing) {
      return res.status(409).json({
        success: false,
        message: `"${trimmedName}" zaten "${trimmedDept}" bölümünde tanımlı.`,
      });
    }

    // Eğer bu kişi varsayılan olarak seçildiyse veya o departmandaki ilk kişiyse
    const countInDept = await VisitorContact.count({ where: { departmentName: trimmedDept } });
    const shouldBeDefault = isDefault || countInDept === 0;

    if (shouldBeDefault) {
      // O departmandaki diğer kişilerin varsayılan durumunu kaldır
      await VisitorContact.update(
        { isDefault: false },
        { where: { departmentName: trimmedDept } }
      );
    }

    const contact = await VisitorContact.create({
      departmentName: trimmedDept,
      fullName: trimmedName,
      title: title?.trim() || null,
      phoneExtension: phoneExtension?.trim() || null,
      email: email?.trim() || null,
      isDefault: shouldBeDefault,
      isActive,
      sortOrder: Number(sortOrder) || 0,
    });

    return res.status(201).json({
      success: true,
      message: `"${contact.fullName}" başarıyla eklendi.`,
      contact,
    });
  } catch (error: unknown) {
    console.error("createContact Hatası:", error);
    const msg = error instanceof Error ? error.message : "Kişi eklenemedi.";
    return res.status(500).json({ success: false, message: msg });
  }
};

/**
 * 4. Ziyaretçi Muhatabını Güncelle
 * PUT /api/visitor-contacts/:id
 */
export const updateContact = async (req: Request, res: Response): Promise<Response> => {
  try {
    const { id } = req.params;
    const {
      departmentName,
      fullName,
      title,
      phoneExtension,
      email,
      isDefault,
      isActive,
      sortOrder,
    } = req.body;

    const contact = await VisitorContact.findByPk(Number(id));
    if (!contact) {
      return res.status(404).json({ success: false, message: "Kayıt bulunamadı." });
    }

    const targetDept = departmentName !== undefined ? departmentName.trim() : contact.departmentName;

    // Eğer isDefault true yapılıyorsa aynı departmandaki diğer kayıtların default'unu sıfırla
    if (isDefault === true) {
      await VisitorContact.update(
        { isDefault: false },
        {
          where: {
            departmentName: targetDept,
            id: { [Op.ne]: contact.id },
          },
        }
      );
    }

    await contact.update({
      departmentName: targetDept,
      fullName: fullName !== undefined ? fullName.trim() : contact.fullName,
      title: title !== undefined ? (title?.trim() || null) : contact.title,
      phoneExtension: phoneExtension !== undefined ? (phoneExtension?.trim() || null) : contact.phoneExtension,
      email: email !== undefined ? (email?.trim() || null) : contact.email,
      isDefault: isDefault !== undefined ? isDefault : contact.isDefault,
      isActive: isActive !== undefined ? isActive : contact.isActive,
      sortOrder: sortOrder !== undefined ? Number(sortOrder) : contact.sortOrder,
    });

    return res.status(200).json({
      success: true,
      message: "Bilgiler başarıyla güncellendi.",
      contact,
    });
  } catch (error: unknown) {
    console.error("updateContact Hatası:", error);
    const msg = error instanceof Error ? error.message : "Güncelleme yapılamadı.";
    return res.status(500).json({ success: false, message: msg });
  }
};

/**
 * 5. Tek Tıkla Bu Kişiyi Departmanın Varsayılanı Yap
 * PATCH /api/visitor-contacts/:id/set-default
 */
export const setDefaultContact = async (req: Request, res: Response): Promise<Response> => {
  try {
    const { id } = req.params;
    const contact = await VisitorContact.findByPk(Number(id));
    if (!contact) {
      return res.status(404).json({ success: false, message: "Kayıt bulunamadı." });
    }

    // Aynı departmandaki herkesi default=false yap
    await VisitorContact.update(
      { isDefault: false },
      { where: { departmentName: contact.departmentName } }
    );

    // Bu kişiyi default=true yap
    await contact.update({ isDefault: true, isActive: true });

    return res.status(200).json({
      success: true,
      message: `"${contact.fullName}", ${contact.departmentName} bölümü için varsayılan muhatap olarak belirlendi.`,
      contact,
    });
  } catch (error: unknown) {
    console.error("setDefaultContact Hatası:", error);
    const msg = error instanceof Error ? error.message : "Varsayılan kişi ayarlanamadı.";
    return res.status(500).json({ success: false, message: msg });
  }
};

/**
 * 6. Ziyaretçi Muhatabını Sil
 * DELETE /api/visitor-contacts/:id
 */
export const deleteContact = async (req: Request, res: Response): Promise<Response> => {
  try {
    const { id } = req.params;
    const contact = await VisitorContact.findByPk(Number(id));
    if (!contact) {
      return res.status(404).json({ success: false, message: "Kayıt bulunamadı." });
    }

    const wasDefault = contact.isDefault;
    const dept = contact.departmentName;

    await contact.destroy();

    // Eğer silinen kişi varsayılan idiyse ve departmanda başka kişi kaldıysa ilk kişiyi default yap
    if (wasDefault) {
      const remaining = await VisitorContact.findOne({
        where: { departmentName: dept },
        order: [["sortOrder", "ASC"], ["fullName", "ASC"]],
      });
      if (remaining) {
        await remaining.update({ isDefault: true });
      }
    }

    return res.status(200).json({
      success: true,
      message: `"${contact.fullName}" başarıyla silindi.`,
    });
  } catch (error: unknown) {
    console.error("deleteContact Hatası:", error);
    const msg = error instanceof Error ? error.message : "Kayıt silinemedi.";
    return res.status(500).json({ success: false, message: msg });
  }
};

function normalizeText(str: string): string {
  if (!str) return "";
  return str
    .replace(/\(.*?\)/g, "") // Parantez içindeki (mobil), (masa) vb. sil
    .replace(/İ/g, "i").replace(/I/g, "ı").replace(/ı/g, "i")
    .replace(/ğ/g, "g").replace(/Ğ/g, "g")
    .replace(/ü/g, "u").replace(/Ü/g, "u")
    .replace(/ş/g, "s").replace(/Ş/g, "s")
    .replace(/ö/g, "o").replace(/Ö/g, "o")
    .replace(/ç/g, "c").replace(/Ç/g, "c")
    .toLowerCase()
    .replace(/\s+/g, "") // Boşlukları temizle (Satın Alma === Satınalma)
    .trim();
}

function cleanPersonName(rawName: string): string {
  if (!rawName) return "";
  const withoutParens = rawName.replace(/\(.*?\)/g, "").trim();
  return withoutParens
    .split(/\s+/)
    .map((word) => {
      const lower = word.toLocaleLowerCase("tr-TR");
      return lower.charAt(0).toLocaleUpperCase("tr-TR") + lower.slice(1);
    })
    .join(" ");
}

/**
 * 7. Şirket Personeli & Bölüm Listesi Önerisi (Ayarlar Ekranında Hızlı Seçim İçin)
 * GET /api/visitor-contacts/suggestions
 */
export const getSuggestions = async (req: Request, res: Response): Promise<Response> => {
  try {
    // 1. Mevcut Sections listesi
    const sections = await Section.findAll({
      where: { is_active: true },
      attributes: ["id", "name"],
      order: [["name", "ASC"]],
    });

    // 2. Telefon Rehberi (Dahili Numaralar)
    const directoryEntries = await PhoneDirectory.findAll({
      attributes: ["name", "number", "department"],
    });

    // Rehberdeki temizlenmiş isimler ve dahili numaralar haritası
    const phoneMap = new Map<string, string>();
    for (const d of directoryEntries) {
      if (d.name && d.number) {
        const norm = normalizeText(d.name);
        if (norm && !phoneMap.has(norm)) {
          phoneMap.set(norm, d.number.trim());
        }
      }
    }

    // 3. Mevcut Operator listesi (Ad, Soyad, Bölüm)
    const operators = await Operator.findAll({
      where: { is_active: 1 },
      attributes: ["id_dec", "name", "surname"],
      include: [
        { model: Section, attributes: ["id", "name"] },
        { model: Department, attributes: ["id", "name"] },
      ],
      order: [
        ["name", "ASC"],
        ["surname", "ASC"],
      ],
      limit: 1000,
    });

    const staff: Array<{
      id: string;
      fullName: string;
      sectionName: string | null;
      departmentName: string | null;
      phoneExtension: string | null;
    }> = [];

    const addedNormNames = new Set<string>();

    for (const op of operators as any[]) {
      const fName = `${op.name} ${op.surname}`.trim();
      const norm = normalizeText(fName);
      const phoneExt = phoneMap.get(norm) || null;
      addedNormNames.add(norm);

      staff.push({
        id: op.id_dec,
        fullName: fName,
        sectionName: op.Section?.name || null,
        departmentName: op.Department?.name || null,
        phoneExtension: phoneExt,
      });
    }

    // 4. Dahili rehberdeki kişileri de staff listesine ekle (zaten dahili numarası hazır!)
    for (const d of directoryEntries) {
      const rawName = d.name?.trim();
      if (!rawName) continue;

      const norm = normalizeText(rawName);
      if (!norm || addedNormNames.has(norm)) {
        // Zaten eklendiyse ve dahili no atanmamışsa güncelle
        if (norm && d.number) {
          const existing = staff.find((s) => normalizeText(s.fullName) === norm);
          if (existing && !existing.phoneExtension) {
            existing.phoneExtension = d.number.trim();
          }
        }
        continue;
      }

      addedNormNames.add(norm);
      const cleaned = cleanPersonName(rawName);
      const deptName = d.department ? cleanPersonName(d.department) : null;

      staff.push({
        id: `phone_${d.number || Math.random()}`,
        fullName: cleaned,
        sectionName: deptName,
        departmentName: deptName,
        phoneExtension: d.number ? d.number.trim() : null,
      });
    }

    // Departman isimleri listesi (Sections + PhoneDirectory Departmanları)
    const sectionNames = new Set(sections.map((s) => s.name));
    for (const d of directoryEntries) {
      if (d.department?.trim()) {
        sectionNames.add(cleanPersonName(d.department.trim()));
      }
    }

    // İsme göre alfabetik sırala
    staff.sort((a, b) => a.fullName.localeCompare(b.fullName, "tr"));

    return res.status(200).json({
      success: true,
      sections: Array.from(sectionNames).sort((a, b) => a.localeCompare(b, "tr")),
      staff,
    });
  } catch (error: unknown) {
    console.error("getSuggestions Hatası:", error);
    // Hata durumunda boş liste dön ki sayfa çökmesin
    return res.status(200).json({
      success: true,
      sections: [
        "Satınalma",
        "İnsan Kaynakları",
        "Muhasebe & Finans",
        "Kalite Güvence",
        "Bilgi İşlem (IT)",
        "Satış & Pazarlama",
        "Yönetim / Fabrika Müdürlüğü",
      ],
      staff: [],
    });
  }
};
