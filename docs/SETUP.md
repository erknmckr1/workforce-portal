# Workforce Portal — Proje Kurulum Rehberi

## Teknoloji Stack

| Katman             | Teknoloji                    | Açıklama                               |
| ------------------ | ---------------------------- | -------------------------------------- |
| **Frontend**       | Vite + React                 | SPA (Single Page Application)          |
| **Dil**            | TypeScript                   | Tip güvenliği                          |
| **UI Kütüphanesi** | Shadcn/ui + Tailwind CSS     | Hızlı ve özelleştirilebilir bileşenler |
| **State (UI)**     | Zustand                      | Popup, tab, sidebar gibi UI durumları  |
| **State (Server)** | TanStack React Query         | API veri çekme, cache, loading state   |
| **Routing**        | React Router DOM             | Sayfa yönlendirme                      |
| **Backend**        | Express.js                   | REST API + MVC mimarisi                |
| **ORM**            | Sequelize                    | MSSQL veritabanı yönetimi              |
| **Veritabanı**     | Microsoft SQL Server (MSSQL) | İlişkisel veritabanı                   |
| **Auth**           | JWT (JSON Web Token)         | Kimlik doğrulama + yetkilendirme       |
| **Gerçek Zamanlı** | Socket.io                    | İzin tablosu anlık güncelleme          |
| **E-Posta**        | Nodemailer                   | Onay bildirimleri                      |

---

## Proje Yapısı

```
workforce-portal/
├── client/                    ← Vite + React (Frontend)
│   ├── src/
│   │   ├── components/
│   │   ├── pages/
│   │   ├── stores/            ← Zustand store'ları
│   │   ├── hooks/             ← Custom hooks (TanStack Query)
│   │   ├── lib/               ← Yardımcı fonksiyonlar
│   │   ├── App.tsx
│   │   └── main.tsx
│   ├── package.json
│   ├── tailwind.config.js
│   ├── tsconfig.json
│   └── vite.config.ts
│
├── server/                    ← Express.js (Backend)
│   ├── src/
│   │   ├── config/
│   │   │   └── database.ts    ← Sequelize MSSQL bağlantısı
│   │   ├── models/            ← Sequelize modelleri
│   │   ├── routes/            ← API endpoint tanımları
│   │   ├── controllers/       ← İstek yönetimi (req → service → res)
│   │   ├── services/          ← İş mantığı (DB işlemleri)
│   │   ├── middleware/        ← Auth, validation, error handling
│   │   └── server.ts          ← Ana Express sunucu
│   ├── .env                   ← Ortam değişkenleri (DB bilgileri)
│   ├── package.json
│   └── tsconfig.json
│
├── .gitignore
├── Source.md                  ← Mevcut sistem frontend analizi
├── Source_DB.md               ← Yeni DB şeması (13 tablo)
├── Source_Flow.md             ← İş akışı ve veri akışı
├── Source_V2.md               ← Yeni mimari kurgu
└── README.md
```

---

## Kurulum Adımları

### 1. Frontend (Vite + React + TypeScript)

```powershell
cd workforce-portal
npm create vite@latest client -- --template react-ts
cd client
npm install
```

**Test:** `npm run dev` → `http://localhost:5173`

### 2. Backend (Express + TypeScript)

```powershell
cd workforce-portal
mkdir server
cd server
npm init -y
```

**Ana bağımlılıklar:**

```powershell
npm install express sequelize tedious dotenv cors cookie-parser
```

**TypeScript + geliştirme bağımlılıkları:**

```powershell
npm install -D typescript ts-node nodemon @types/express @types/node @types/cors @types/cookie-parser
```

**TypeScript konfigürasyonu:**

```powershell
npx tsc --init
```

### 3. .env Dosyası (server/.env)

```env
PORT=3003
DB_HOST=localhost
DB_PORT=1433
DB_NAME=MDS_TEST
DB_USER=sa
DB_PASSWORD=sifre
DB_DIALECT=mssql
SECRET_KEY=super_secret_jwt_key
```

### 4. Veritabanı Oluşturma

SSMS veya sqlcmd ile:

```sql
CREATE DATABASE MDS_TEST;
```

### 5. Sunucuyu Çalıştırma

```powershell
cd server
npm run dev
```

**Beklenen çıktı:**

```
✅ MSSQL veritabanına bağlantı başarılı.
✅ Tüm modeller senkronize edildi.
🚀 Server çalışıyor: http://localhost:3003
```

**Health check:** Tarayıcıda `http://localhost:3003/api/health` açılırsa API çalışıyor demektir.

---

## İleride Kurulacaklar

| Paket          | Ne zaman?                 | Komut                                                                    |
| -------------- | ------------------------- | ------------------------------------------------------------------------ |
| Tailwind CSS   | UI geliştirmeye başlarken | `cd client && npm install -D tailwindcss @tailwindcss/vite`              |
| Shadcn/ui      | UI geliştirmeye başlarken | `npx shadcn-ui@latest init`                                              |
| React Router   | Routing eklerken          | `cd client && npm install react-router-dom`                              |
| Zustand        | State yönetimi eklerken   | `cd client && npm install zustand`                                       |
| TanStack Query | API entegrasyonunda       | `cd client && npm install @tanstack/react-query`                         |
| Axios          | API çağrılarında          | `cd client && npm install axios`                                         |
| Socket.io      | Gerçek zamanlı özellikte  | Server: `npm install socket.io` / Client: `npm install socket.io-client` |
| JWT            | Auth geliştirirken        | `cd server && npm install jsonwebtoken @types/jsonwebtoken`              |
| Nodemailer     | Mail sistemi eklerken     | `cd server && npm install nodemailer @types/nodemailer`                  |
| bcrypt         | Şifre hash'leme           | `cd server && npm install bcrypt @types/bcrypt`                          |

---

## npm Scripts

### Client (Vite)

| Komut             | Ne yapar?                       |
| ----------------- | ------------------------------- |
| `npm run dev`     | Geliştirme sunucusu (port 5173) |
| `npm run build`   | Production build (dist/)        |
| `npm run preview` | Build'i önizleme                |

### Server (Express)

| Komut           | Ne yapar?                                          |
| --------------- | -------------------------------------------------- |
| `npm run dev`   | Nodemon ile geliştirme (otomatik yeniden başlatma) |
| `npm run build` | TypeScript → JavaScript derleme (dist/)            |
| `npm start`     | Production çalıştırma                              |

---

## MVC Yapısı (Backend)

```
İstek Akışı:

Client → Route → Controller → Service → Model (DB) → Service → Controller → Response

Route:       Endpoint tanımı        (/api/leave/create)
Controller:  İsteği alır, doğrular  (req.body'yi kontrol et)
Service:     İş mantığını çalıştırır (bakiye hesapla, mail gönder)
Model:       DB ile konuşur          (Sequelize query)
```

**Örnek akış — İzin oluşturma:**

```
POST /api/leave/create
  → leaveRoutes.ts       (route tanımı + auth middleware)
  → leaveController.ts   (req.body'den verileri al, validation)
  → leaveService.ts      (izin oluştur, onaycı belirle, mail gönder)
  → LeaveRecord.ts       (Sequelize model, DB'ye INSERT)
  → Response: { status: 201, data: { id: 42, ... } }
```
