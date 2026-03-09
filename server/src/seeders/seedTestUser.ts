import { sequelize, Operator } from "../models";
import bcrypt from "bcryptjs";

const seedTestUser = async () => {
    try {
        await sequelize.authenticate();
        console.log("Database connected for seeding...");

        await sequelize.sync();

        // 123456 şifresini hashleyelim
        const hashedPassword = await bcrypt.hash("123456", 10);

        // Sisteme "1001" sicil numaralı bir test kullanıcısı ekleyelim
        const [user, created] = await Operator.findOrCreate({
            where: { id_dec: "1001" },
            defaults: {
                id_dec: "1001",
                id_hex: "A1B2C3D4", // Kiosk'ta okutulacak kartın Hex ID'si
                name: "Ahmet",
                surname: "Yılmaz",
                op_password: hashedPassword, // Sadece Beyaz Yaka / Normal girişte kullanılacak
                role_id: 1, // 1: Personel
                leave_balance: 14.00, // Varsayılan 14 gün bakiye
                is_active: true
            }
        });

        if (created) {
            console.log(" Test user 'Ahmet Yılmaz' created successfully!");
            console.log("   - Login ID (Sicil No): 1001");
            console.log("   - Password: 123456");
            console.log("   - Kiosk Hex ID: A1B2C3D4");
        } else {
            console.log(" Test user '1001' already exists.");
            
            // Mevcut kullanıcının şifresini bilhassa 123456 yapalım ki test edelim
            await user.update({ op_password: hashedPassword });
            console.log(" Updated existing user's password to '123456'.");
        }

        process.exit(0);
    } catch (error) {
        console.error(" Seeding failed:", error);
        process.exit(1);
    }
};

seedTestUser();
