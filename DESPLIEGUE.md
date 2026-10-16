# Poner CleanDose en producción

```
 Celulares (app)  ──HTTP──►  Servidor 149.130.170.232:8080  ◄──HTTP──  ESP32 (Wi-Fi del lugar)
                              guarda todo y sirve la app                prende la bomba
```

El servidor (`server/index.js`) no necesita librerías: solo Node 20 o superior. Sirve la app ya compilada y la API en el mismo puerto.

## Instalación actual (16 oct 2026)

**La app que usa la gente: https://expoclean.vercel.app** (Vercel publica solo en cada push a `main`).
Vercel no tiene la API: `vercel.json` reenvía `/api/*` a `http://149.130.170.232:8080` (puente). Así el navegador
habla solo https con Vercel, y Vercel habla con el servidor. El ESP32 va directo al servidor por http.

Ya está corriendo en `http://149.130.170.232:8080` (Oracle Linux 9, usuario `opc`), como servicio `cleandose`:

- Código: `/opt/cleandose` (solo `dist/`, `server/`, `src/lib/catalogo.js`, `src/lib/traza.js`, `src/lib/fijos.js` y `package.json`; menos de 1 MB).
- Datos: `/var/lib/cleandose/estado.json`.
- Token: en `/etc/systemd/system/cleandose.service` (no está en el repositorio).
- Ver estado y registros: `sudo systemctl status cleandose` y `sudo journalctl -u cleandose -f`.

Para actualizar desde una compu con el repositorio (compila aquí y sube solo lo necesario, sin llenar el disco del servidor):

```bash
pnpm build
tar -czf cleandose.tgz package.json dist server/index.js server/cleandose.service src/lib/catalogo.js src/lib/traza.js src/lib/fijos.js
scp cleandose.tgz opc@149.130.170.232:/tmp/
ssh opc@149.130.170.232 "sudo rm -rf /opt/cleandose/dist && sudo tar -xzf /tmp/cleandose.tgz -C /opt/cleandose && sudo systemctl restart cleandose && rm /tmp/cleandose.tgz"
```

Si alguna vez hay que instalarlo desde cero en otro servidor, siguen los pasos de abajo.

## 1. En tu servidor (una sola vez)

Conéctate por SSH y ejecuta (Ubuntu; en Oracle Linux cambia `apt` por `dnf`):

```bash
# Node 22
curl -fsSL https://deb.nodesource.com/setup_22.x | sudo -E bash -
sudo apt install -y nodejs git
sudo npm install -g pnpm

# Código y usuario del servicio
sudo useradd --system --home /var/lib/cleandose --create-home cleandose
sudo git clone https://github.com/marcado993/expoclean.git /opt/cleandose
cd /opt/cleandose && sudo pnpm install && sudo pnpm build

# Servicio (cambia CAMBIA_ESTE_TOKEN por el token del ESP32)
sudo cp server/cleandose.service /etc/systemd/system/
sudo nano /etc/systemd/system/cleandose.service
sudo systemctl daemon-reload && sudo systemctl enable --now cleandose

# Abrir el puerto 8080 en el firewall del sistema
sudo iptables -I INPUT -p tcp --dport 8080 -j ACCEPT
sudo netfilter-persistent save   # en Ubuntu de Oracle Cloud
```

Si es Oracle Cloud, abre también el puerto **8080 (TCP)** en la consola: *Networking → Virtual Cloud Networks → tu VCN → Security Lists → Add Ingress Rule*, origen `0.0.0.0/0`.

Comprueba: abre `http://149.130.170.232:8080` en el celular. Debe salir "¿Quién eres?".

## 2. El token

Es una clave que comparten el servidor y el ESP32, para que nadie más pueda hacerse pasar por la máquina. Debe ser **el mismo** en:

- `CLEANDOSE_TOKEN=...` en `/etc/systemd/system/cleandose.service`
- `const char* TOKEN = "...";` en `firmware/cleandose/cleandose.ino`

## 3. ESP32

En `firmware/cleandose/cleandose.ino` cambia `WIFI_SSID`, `WIFI_PASS` y `TOKEN`. `SERVIDOR` ya apunta a `http://149.130.170.232:8080`. Súbelo con el Arduino IDE (necesita la librería **ArduinoJson**). El LED azul de la placa se prende cuando está conectado al servidor; en *Máquina y operarios* el administrador ve "Máquina conectada".

Ahora mismo hay una sola bomba: los 4 compartimentos prenden el **GPIO 22**. Cuando haya 4 bombas, cambia `PIN_BOMBA` a `{22, 21, 19, 18}`.

## 4. Primer uso

1. Abre la app y entra como **administrador**.
2. En **Máquina y operarios**, agrega a los operarios.
3. En **Asignación de espacios**, crea las zonas (nombre, m², tipo de superficie).
4. Un operario entra con su nombre, va a **Configuración CleanDose** y elige qué producto tiene cada compartimento.
5. Listo: **Escanear área → Continuar → Dispensar**.

## Actualizar

```bash
cd /opt/cleandose && sudo git pull && sudo pnpm install && sudo pnpm build && sudo systemctl restart cleandose
```

Los datos viven en `/var/lib/cleandose/estado.json`: haz una copia antes de tocar el servidor.

## Calibrar la bomba

Los segundos de bomba salen de los mL de producto y del caudal (`CAUDAL_ML_S` en `src/lib/catalogo.js`, 1.6 mL/s de fábrica). Para calibrar: en *Máquina y operarios* toca **Probar bomba 3 s** varias veces sobre un vaso medidor, divide los mL por los segundos y pon ese número.
