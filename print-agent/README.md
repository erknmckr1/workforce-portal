# Workforce Zebra Yerel Yazdırma Ajanı (Local Print Agent)

Bu küçük servis, **Workforce Portal** merkezi bir sunucuda (`192.168.3.5` vb.) çalışırken, etiket yazdırma komutlarının **kullanıcının yerel bilgisayarına bağlı Zebra yazıcıdan (`MIDAS_BARKOD`) hiç tarayıcı penceresi açılmadan** doğrudan yazdırılmasını sağlar.

## Nasıl Kullanılır?
1. Zebra yazıcının USB ile bağlı olduğu bilgisayarda `start-agent.bat` dosyasını çift tıklayıp çalıştırın.
2. Web portalında (`/mes/qr-generator`) **"Etiketi Yazdır"** butonuna bastığınızda etiket anında Zebra yazıcıdan çıkar.

## Windows Açılışında Otomatik Başlatma (İsteğe Bağlı)
Bilgisayar her açıldığında servisin arka planda otomatik çalışmasını isterseniz:
1. Klavyeden `Windows + R` tuşlarına basıp `shell:startup` yazın ve Enter'a basın.
2. Açılan klasörün içine `start-agent-silent.vbs` dosyasının kısayolunu kopyalayın.
3. Artık bilgisayar açıldığında servis arka planda sessizce hazır bekler.
