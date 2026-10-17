// CleanDose — firmware ESP32 por BLUETOOTH (BLE)
//
// El ESP32 solo prende bombas. La app (Chrome en Android) se conecta por Bluetooth, manda la
// orden y guarda el registro en el servidor con el internet del celular. El ESP32 NO necesita Wi-Fi.
//
// Mensajes cortos (caben en 20 bytes):
//   App → ESP32 (característica ORDEN, escribir):
//     G;<id>;<compartimento>;<segundos>   dosificar      ej. G;k3x9q2ab;1;12
//     S;<id>                              detener esa dosis
//   ESP32 → App (característica ESTADO, notificar y leer):
//     L                     libre
//     D;<id>;<resta_ms>     dosificando (se repite cada medio segundo)
//     H;<id>                hecha
//     P;<id>                parada por el operario
//     O;<resta_ms>          ocupado con otra dosis
//     E;<id>                orden inválida
//   Una dosis a la vez. Si llega la misma orden dos veces (mismo id), no se repite.
//
// Conexión AHORA (un solo relé y una bomba): los 4 compartimentos prenden el GPIO 22.
//   Relé: IN → GPIO 22 · VCC → VIN (5 V) · GND → GND · bomba en COM / NO con su fuente.
// Cuando haya 4 bombas, cambia PIN_BOMBA a {22, 21, 19, 18}.
//
// No necesita librerías extra: usa el Bluetooth que ya trae el ESP32 en el Arduino IDE.
//
// LED azul de la placa:
//   parpadeo lento ............ esperando que un celular se conecte
//   4 parpadeos y fijo ........ celular conectado
// Monitor Serie (115200): [INICIO] [OK] [ORDEN] [ERROR] en cada paso.

#include <BLEDevice.h>
#include <BLEServer.h>
#include <BLE2902.h>

#define SERVICIO "7f3a0001-5c2e-4b8a-9f1d-3c6e2a1b4d00"
#define ORDEN    "7f3a0002-5c2e-4b8a-9f1d-3c6e2a1b4d00"
#define ESTADO   "7f3a0003-5c2e-4b8a-9f1d-3c6e2a1b4d00"

const int N = 4;
const int PIN_BOMBA[N] = {22, 22, 22, 22};   // por ahora todos al mismo relé
const bool RELE_ACTIVO_BAJO = false;         // tu módulo se activa con HIGH. Si queda prendido solo, pon true
const long SEG_MAX = 120;
const int PIN_LED = 2;
const bool DEBUG_BLE = true;      // true = mensajes extra en el Monitor Serie para probar la conexión Bluetooth

BLEServer* servidor;
BLECharacteristic* chEstado;
volatile bool conectado = false;
volatile bool recienConectado = false;
volatile bool hayOrden = false;
String orden = "";

int activo = -1;                  // compartimento dosificando (0..3) o -1
unsigned long hastaMs = 0;
String idActual = "";             // dosis en curso o la última terminada
String estadoFinal = "L";               // último estado final, para responder órdenes repetidas
unsigned long ultimoAviso = 0;
unsigned long ultimoLatido = 0;   // para el mensaje de depuración cada 5 s
int conexiones = 0;               // cuántas veces se conectó un celular desde que arrancó

void bomba(int i, bool prendida) {
  digitalWrite(PIN_BOMBA[i], prendida == RELE_ACTIVO_BAJO ? LOW : HIGH);
}

void enviar(const String& s) {
  if (DEBUG_BLE) { Serial.print("[DEBUG] -> app: "); Serial.println(s); }
  chEstado->setValue((uint8_t*)s.c_str(), s.length());
  if (conectado) chEstado->notify();
}

long restaMs() { return activo >= 0 ? max(0L, (long)(hastaMs - millis())) : 0; }

void terminar(const char* como) {
  bomba(activo, false);
  Serial.print("[ORDEN] Bomba OFF (");
  Serial.print(como[0] == 'H' ? "dosis terminada" : "detenida desde la app");
  Serial.println(")");
  activo = -1;
  estadoFinal = String(como) + ";" + idActual;
  enviar(estadoFinal);
}

class AlConectar : public BLEServerCallbacks {
  void onConnect(BLEServer*) override { conectado = true; recienConectado = true; conexiones++; }
  void onDisconnect(BLEServer* s) override {
    conectado = false;
    s->startAdvertising();              // vuelve a anunciarse para el siguiente celular
  }
};

class AlEscribir : public BLECharacteristicCallbacks {
  void onWrite(BLECharacteristic* c) override {
    orden = String(c->getValue().c_str());
    hayOrden = true;                    // se procesa en loop(), no aquí
  }
};

// Separa "G;id;1;12" en partes.
String parte(const String& s, int n) {
  int desde = 0;
  for (int i = 0; i < n; i++) {
    desde = s.indexOf(';', desde) + 1;
    if (desde == 0) return "";
  }
  int hasta = s.indexOf(';', desde);
  return hasta < 0 ? s.substring(desde) : s.substring(desde, hasta);
}

void procesar(const String& o) {
  String tipo = parte(o, 0);
  String id = parte(o, 1);
  if (tipo == "S") {
    if (activo >= 0 && id == idActual) terminar("P");
    return;
  }
  if (tipo != "G" || id.length() == 0) return;

  if (id == idActual) {                 // la misma orden otra vez: no se repite
    if (activo >= 0) enviar("D;" + id + ";" + String(restaMs()));
    else enviar(estadoFinal);
    return;
  }
  if (activo >= 0) {
    enviar("O;" + String(restaMs()));
    return;
  }
  int c = parte(o, 2).toInt();
  long seg = parte(o, 3).toInt();
  if (c < 1 || c > N || seg < 1 || seg > SEG_MAX) {
    Serial.print("[ERROR] Orden invalida: ");
    Serial.println(o);
    enviar("E;" + id);
    return;
  }
  idActual = id;
  activo = c - 1;
  hastaMs = millis() + seg * 1000UL;
  bomba(activo, true);
  Serial.print("[ORDEN] Bomba ");
  Serial.print(c);
  Serial.print(" ON por ");
  Serial.print(seg);
  Serial.println(" s");
  enviar("D;" + id + ";" + String(restaMs()));
  ultimoAviso = millis();
}

void setup() {
  Serial.begin(115200);
  for (int i = 0; i < N; i++) {
    bomba(i, false);                    // antes de pinMode: no hace clic al arrancar
    pinMode(PIN_BOMBA[i], OUTPUT);
  }
  pinMode(PIN_LED, OUTPUT);
  delay(300);
  Serial.println();
  Serial.println("[INICIO] CleanDose arrancando. Rele apagado.");

  BLEDevice::init("CleanDose");
  if (DEBUG_BLE) {
    Serial.print("[DEBUG] Direccion Bluetooth del ESP32: ");
    Serial.println(BLEDevice::getAddress().toString().c_str());
  }
  servidor = BLEDevice::createServer();
  servidor->setCallbacks(new AlConectar());
  BLEService* servicio = servidor->createService(SERVICIO);
  BLECharacteristic* chOrden = servicio->createCharacteristic(ORDEN, BLECharacteristic::PROPERTY_WRITE);
  chOrden->setCallbacks(new AlEscribir());
  chEstado = servicio->createCharacteristic(ESTADO, BLECharacteristic::PROPERTY_READ | BLECharacteristic::PROPERTY_NOTIFY);
  chEstado->addDescriptor(new BLE2902());
  chEstado->setValue("L");
  servicio->start();
  BLEAdvertising* anuncio = BLEDevice::getAdvertising();
  anuncio->addServiceUUID(SERVICIO);
  anuncio->setScanResponse(true);
  BLEDevice::startAdvertising();
  Serial.println("[OK] Bluetooth listo. Busca 'CleanDose' desde la app.");
  if (DEBUG_BLE) {
    Serial.println("[DEBUG] Anunciando el servicio 7f3a0001-... con el nombre 'CleanDose'.");
    Serial.println("[DEBUG] En el celular (Chrome): Conectar maquina. Si no aparece, usa 'Ver todos los dispositivos'.");
    Serial.println("[DEBUG] Para comprobar sin la app: instala 'nRF Connect' y busca 'CleanDose'.");
  }
}

void loop() {
  if (recienConectado) {
    recienConectado = false;
    Serial.println("==============================================");
    Serial.println("[OK] CELULAR CONECTADO POR BLUETOOTH");
    Serial.println("     Toca un lugar en la app para dosificar.");
    Serial.println("==============================================");
    for (int i = 0; i < 4; i++) { digitalWrite(PIN_LED, HIGH); delay(120); digitalWrite(PIN_LED, LOW); delay(120); }
    enviar(activo >= 0 ? String("D;") + idActual + ";" + String(restaMs()) : String("L"));
  }
  static bool estabaConectado = false;
  if (estabaConectado && !conectado) Serial.println("[INFO] Celular desconectado. Esperando otro...");
  estabaConectado = conectado;

  if (hayOrden) {
    hayOrden = false;
    if (DEBUG_BLE) { Serial.print("[DEBUG] <- app: "); Serial.println(orden); }
    procesar(orden);
  }

  if (DEBUG_BLE && millis() - ultimoLatido >= 5000) {
    ultimoLatido = millis();
    if (conectado) {
      Serial.print("[DEBUG] Celular conectado (conexion numero ");
      Serial.print(conexiones);
      Serial.println("). Esperando ordenes.");
    } else {
      Serial.println("[DEBUG] Anunciando como 'CleanDose', esperando que un celular se conecte...");
    }
  }

  if (activo >= 0) {
    if ((long)(millis() - hastaMs) >= 0) terminar("H");   // se apaga sola aunque el celular se desconecte
    else if (millis() - ultimoAviso >= 500) {
      enviar("D;" + idActual + ";" + String(restaMs()));
      ultimoAviso = millis();
    }
  }

  // LED: fijo si hay celular conectado, parpadeo lento si espera.
  digitalWrite(PIN_LED, conectado ? HIGH : (millis() / 700) % 2);
  delay(10);
}
