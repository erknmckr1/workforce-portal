import timecureSequelize from "./src/config/timecureDatabase";
import ExternalMovement from "./src/models/ExternalMovement";
import { Op } from "sequelize";

async function test() {
    try {
        await timecureSequelize.authenticate();

        const todayStart = new Date();
        todayStart.setUTCHours(0, 0, 0, 0);

        console.log("todayStart used:", todayStart.toISOString());

        const lastExit = await ExternalMovement.findOne({
            where: {
                KisiId: 305,
                KabulGirisCikis: 2,
                Zaman: { [Op.lt]: todayStart },
            },
            order: [["Zaman", "DESC"]],
            attributes: ["Zaman"],
            logging: console.log,
        });

        console.log("lastExit found:", lastExit?.toJSON());

    } catch (e) {
        console.error(e);
    } finally {
        process.exit(0);
    }
}
test();
