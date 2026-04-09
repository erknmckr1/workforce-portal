import express from "express";
import https from "https";

const router = express.Router();

// Nadir Döviz sitesini proxy üzerinden çekiyoruz.
// Böylece CORS engeli aşılır ve client-side'da kaynak URL görünmez.
router.get("/rates", async (_req, res) => {
  try {
    const data = await new Promise<string>((resolve, reject) => {
      https.get(
        "https://finans.truncgil.com/today.json",
        {
          headers: {
            "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64)",
            "Accept": "application/json",
          },
        },
        (response) => {
          let body = "";
          response.on("data", (chunk) => (body += chunk));
          response.on("end", () => resolve(body));
          response.on("error", reject);
        }
      ).on("error", reject);
    });

    const parsed = JSON.parse(data);

    // Sadece ilgilendiğimiz kurları filtrele
    const filtered = {
      update_date: parsed["Update_Date"] || "",
      USD: parsed["USD"],
      EUR: parsed["EUR"],
      GBP: parsed["GBP"],
      "gram-altin": parsed["gram-altin"],
      "gram-gumus": parsed["gumus"],
      CHF: parsed["CHF"],
    };

    res.json({ success: true, data: filtered });
  } catch (err) {
    console.error("Döviz proxy hatası:", err);
    res.status(500).json({ success: false, message: "Döviz verisi çekilemedi." });
  }
});

export default router;
