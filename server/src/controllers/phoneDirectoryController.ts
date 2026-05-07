import { Request, Response } from "express";
import { PhoneDirectory } from "../models/PhoneDirectory";
import { Op } from "sequelize";

export const getPhoneDirectory = async (req: Request, res: Response) => {
  try {
    const { search } = req.query;
    
    let whereClause = {};
    if (search) {
      whereClause = {
        [Op.or]: [
          { name: { [Op.like]: `%${search}%` } },
          { number: { [Op.like]: `%${search}%` } },
          { department: { [Op.like]: `%${search}%` } },
        ],
      };
    }

    const directory = await PhoneDirectory.findAll({
      where: whereClause,
      order: [["name", "ASC"]],
    });

    res.status(200).json(directory);
  } catch (error) {
    console.error("Error fetching phone directory:", error);
    res.status(500).json({ message: "Rehber getirilirken bir hata oluştu." });
  }
};

export const createPhoneEntry = async (req: Request, res: Response) => {
  try {
    const { number, name, department } = req.body;
    const entry = await PhoneDirectory.create({ number, name, department });
    res.status(201).json(entry);
  } catch (error) {
    res.status(500).json({ message: "Kayıt oluşturulurken bir hata oluştu." });
  }
};

export const updatePhoneEntry = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const { number, name, department } = req.body;
    await PhoneDirectory.update({ number, name, department }, { where: { id } });
    res.status(200).json({ message: "Kayıt güncellendi." });
  } catch (error) {
    res.status(500).json({ message: "Kayıt güncellenirken bir hata oluştu." });
  }
};

export const deletePhoneEntry = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    await PhoneDirectory.destroy({ where: { id } });
    res.status(200).json({ message: "Kayıt silindi." });
  } catch (error) {
    res.status(500).json({ message: "Kayıt silinirken bir hata oluştu." });
  }
};
